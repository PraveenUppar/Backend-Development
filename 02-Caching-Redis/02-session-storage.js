// Caching/Redis 2 - Session Storage
// Builds on 01-sorted-sets-leaderboard.js.
// Needs: Redis running (docker run -d -p 6379:6379 redis)
// Run: node 02-session-storage.js
// Then: curl -X POST http://localhost:4212/login -H "Content-Type: application/json" -d "{\"userId\":\"demo-user\"}"

const express = require("express");
const crypto = require("crypto");
const Redis = require("ioredis");

const app = express();
app.use(express.json());
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// ============================================
// Redis for session storage - why, and TTL-based expiry
// ============================================

// JWTs are stateless - the server doesn't store anything, it just verifies a
// signature. Great for scaling, but you CAN'T revoke a single token early
// (log a user out everywhere) without extra machinery. A server-side session
// in Redis flips that: the server holds the truth, so revoking is just
// deleting a key.

const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24h

app.post("/login", async (req, res) => {
  const sessionId = crypto.randomUUID();
  await redis.hset(`session:${sessionId}`, { userId: req.body.userId || "demo-user", createdAt: Date.now() });
  await redis.expire(`session:${sessionId}`, SESSION_TTL_SECONDS);
  res.json({ success: true, data: { sessionId } });
});

app.get("/me", async (req, res) => {
  const sessionId = req.headers["x-session-id"];
  const session = await redis.hgetall(`session:${sessionId}`); // {} if expired/missing
  if (!session.userId) return res.status(401).json({ success: false, message: "No valid session" });
  await redis.expire(`session:${sessionId}`, SESSION_TTL_SECONDS); // reset TTL on activity
  res.json({ success: true, data: session });
});

// Trade-off to know: sessions need a lookup on every request (a network hop
// to Redis) where a JWT is verified in-process with no I/O. In practice that
// hop is sub-millisecond to a local/nearby Redis, and you get instant
// revocation in exchange - usually a good trade for anything where "log this
// user out right now" needs to actually work.

const PORT = 4212;
app.listen(PORT, () => console.log(`Session storage demo running on http://localhost:${PORT}`));
