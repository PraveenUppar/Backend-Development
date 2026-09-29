// Caching/Redis 5 - Key Expiration Mechanics
// Builds on 04-atomic-incr.js.
// Needs: Redis running (docker run -d -p 6379:6379 redis)
// Run: node 05-key-expiration.js
// Then: curl http://localhost:4215/ttl-demo

const express = require("express");
const Redis = require("ioredis");

const app = express();
app.use(express.json());
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// ============================================
// Key expiration mechanics - EXPIRE / PEXPIRE / TTL
// ============================================

app.get("/ttl-demo", async (req, res) => {
  await redis.set("demo:key", "value");
  await redis.expire("demo:key", 30); // expires in 30 seconds

  const ttl = await redis.ttl("demo:key"); // seconds left, -1 = no TTL, -2 = doesn't exist
  const pttl = await redis.pttl("demo:key"); // same, in milliseconds

  res.json({ success: true, data: { ttlSeconds: ttl, pttlMs: pttl } });
});

// A few things worth knowing:
// - SET has a shortcut for setting value + TTL in one round trip:
//   redis.set(key, value, "EX", 30) - preferred over a separate SET then
//   EXPIRE (one command instead of two, no gap where the key briefly has no TTL).
// - Expiration is passive+active in Redis: a read on an expired key acts as
//   if it's gone immediately, AND Redis also actively sweeps expired keys in
//   the background so memory gets reclaimed even for keys nobody reads again.
// - Setting a new value with a plain SET (no EX/PX) on an existing key
//   CLEARS its TTL unless you pass "KEEPTTL" - a common gotcha when you mean
//   to "update the value but keep the same expiry".

const PORT = 4215;
app.listen(PORT, () => console.log(`Key expiration demo running on http://localhost:${PORT}`));
