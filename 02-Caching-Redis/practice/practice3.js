// Practice 3: Login Lockout with Sliding Window + Expiration (topics 03 + 05)
// Needs: Redis running (docker run -d -p 6379:6379 redis)
// Run: node practice/practice3.js
// Then: curl -X POST http://localhost:4223/login -H "Content-Type: application/json" -d "{\"username\":\"ann\",\"password\":\"wrong\"}"

const express = require("express");
const Redis = require("ioredis");

const app = express();
app.use(express.json());
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// Exercise: after 5 failed logins for the same username within 5 minutes,
// lock the account out for 5 minutes. Combines the sliding-window counter
// (03) with an explicit lockout key that expires on its own (05) - no cron
// job needed to lift the lockout, TTL does it.

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60_000;
const LOCKOUT_SECONDS = 5 * 60;

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const lockKey = `lockout:${username}`;
  const attemptsKey = `login-attempts:${username}`;

  const locked = await redis.exists(lockKey);
  if (locked) {
    const ttl = await redis.ttl(lockKey);
    return res.status(423).json({ success: false, message: `Account locked. Try again in ${ttl}s.` });
  }

  const correct = password === "correct-password"; // stand-in for a real check
  if (correct) {
    await redis.del(attemptsKey); // successful login clears the slate
    return res.json({ success: true, data: "logged in" });
  }

  const now = Date.now();
  await redis.zremrangebyscore(attemptsKey, 0, now - WINDOW_MS);
  await redis.zadd(attemptsKey, now, `${now}-${Math.random()}`);
  await redis.expire(attemptsKey, Math.ceil(WINDOW_MS / 1000));
  const failures = await redis.zcard(attemptsKey);

  if (failures >= MAX_ATTEMPTS) {
    await redis.set(lockKey, "1", "EX", LOCKOUT_SECONDS);
    return res.status(423).json({ success: false, message: `Too many failed attempts. Locked for ${LOCKOUT_SECONDS}s.` });
  }

  res.status(401).json({ success: false, message: `Invalid credentials (${failures}/${MAX_ATTEMPTS} attempts)` });
});

const PORT = 4223;
app.listen(PORT, () => console.log(`Practice 3 running on http://localhost:${PORT}`));
