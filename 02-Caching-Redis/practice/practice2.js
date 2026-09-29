// Practice 2: Session-Scoped Counters (topics 02 + 04)
// Needs: Redis running (docker run -d -p 6379:6379 redis)
// Run: node practice/practice2.js
// Then: curl -X POST http://localhost:4222/login -H "Content-Type: application/json" -d "{\"userId\":\"demo-user\"}"

const express = require("express");
const crypto = require("crypto");
const Redis = require("ioredis");

const app = express();
app.use(express.json());
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// Exercise: track how many API calls a session has made, alongside the
// session itself. The counter lives on the SAME hash as the session data
// and is incremented with HINCRBY (atomic) instead of a separate read+set -
// two requests hitting /calls at the same instant must not lose a count.

const SESSION_TTL_SECONDS = 60 * 60; // 1h

app.post("/login", async (req, res) => {
  const sessionId = crypto.randomUUID();
  await redis.hset(`session:${sessionId}`, { userId: req.body.userId || "demo-user", callCount: 0 });
  await redis.expire(`session:${sessionId}`, SESSION_TTL_SECONDS);
  res.json({ success: true, data: { sessionId } });
});

app.post("/calls", async (req, res) => {
  const sessionId = req.headers["x-session-id"];
  const exists = await redis.exists(`session:${sessionId}`);
  if (!exists) return res.status(401).json({ success: false, message: "No valid session" });

  const callCount = await redis.hincrby(`session:${sessionId}`, "callCount", 1); // atomic
  await redis.expire(`session:${sessionId}`, SESSION_TTL_SECONDS); // reset TTL on activity
  res.json({ success: true, data: { callCount } });
});

const PORT = 4222;
app.listen(PORT, () => console.log(`Practice 2 running on http://localhost:${PORT}`));
