// Caching/Redis 3 - Sliding-Window Rate Limiter
// Builds on 02-session-storage.js.
// Needs: Redis running (docker run -d -p 6379:6379 redis)
// Run: node 03-sliding-window-rate-limiter.js
// Then: curl http://localhost:4213/limited-route (repeat 6+ times fast to trip the limit)

const express = require("express");
const Redis = require("ioredis");

const app = express();
app.use(express.json());
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// ============================================
// Sliding-window rate limiter with ZADD + ZREMRANGEBYSCORE + ZCARD
// ============================================

// A naive/fixed-window limiter ("max N per clock minute") has a burst
// problem at the boundary: a client can send N requests at 12:00:59 and
// another N at 12:01:00 - 2N requests in two seconds, both "within limits."
// A sliding window fixes this by looking at a rolling range of time ending
// NOW, not a fixed clock bucket.

async function checkSlidingWindow(clientId, limit = 5, windowMs = 60_000) {
  const key = `ratelimit:${clientId}`;
  const now = Date.now();

  await redis.zremrangebyscore(key, 0, now - windowMs); // drop entries that aged out
  const count = await redis.zcard(key); // how many requests are still "live"

  if (count >= limit) return { allowed: false, retryAfterMs: windowMs };

  await redis.zadd(key, now, `${now}-${Math.random()}`); // unique member per request
  await redis.expire(key, Math.ceil(windowMs / 1000)); // let the key self-clean if idle
  return { allowed: true };
}

app.get("/limited-route", async (req, res) => {
  const clientId = req.ip;
  const result = await checkSlidingWindow(clientId, 5, 60_000);
  if (!result.allowed) {
    res.set("Retry-After", String(Math.ceil(result.retryAfterMs / 1000)));
    return res.status(429).json({ success: false, message: "Too many requests" });
  }
  res.json({ success: true, data: "ok" });
});

// The member needs to be unique per request (timestamp alone can collide if
// two requests land in the same millisecond) - `${now}-${random}` or a uuid
// both work. This costs more memory than a single INCR counter (one entry
// per request in the window) but gives an accurate rolling count with no
// boundary-burst loophole.

const PORT = 4213;
app.listen(PORT, () => console.log(`Sliding-window rate limiter demo running on http://localhost:${PORT}`));
