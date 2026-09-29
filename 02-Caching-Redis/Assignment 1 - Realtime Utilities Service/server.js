// Realtime Utilities Service
// Needs: Redis running (docker run -d -p 6379:6379 redis)
// Run: node server.js
//
// Demonstrates three ioredis patterns beyond basic get/set caching:
//   1. Sliding-window rate limiting (rateLimiter.js)   -> GET /ping
//   2. Redis-backed sessions (sessionStore.js)          -> POST /login, GET /me
//   3. Sorted-set leaderboard (leaderboard.js)          -> /leaderboard/*

require("dotenv").config();
const express = require("express");
const Redis = require("ioredis");

const { createRateLimiter } = require("./rateLimiter");
const { createSessionStore } = require("./sessionStore");
const { createLeaderboard } = require("./leaderboard");

const app = express();
app.use(express.json());

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

const sessions = createSessionStore(redis);
const leaderboard = createLeaderboard(redis);

// ============================================
// 1. Rate limiting
// ============================================
// 5 requests per 10-second sliding window, per client IP. Hit this more
// than 5 times in 10 seconds and you'll get a 429 with Retry-After.
const demoLimiter = createRateLimiter(redis, {
  windowMs: 10_000,
  max: 5,
  keyPrefix: "ratelimit:demo",
});

app.get("/ping", demoLimiter, (req, res) => {
  res.json({ success: true, data: "pong" });
});

// ============================================
// 2. Sessions
// ============================================

app.post("/login", async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "userId is required" });
    }

    const sessionId = await sessions.createSession(userId);
    res.status(201).json({ success: true, data: { sessionId } });
  } catch (err) {
    next(err);
  }
});

app.get("/me", async (req, res, next) => {
  try {
    const sessionId = req.header("x-session-id");
    const session = await sessions.getSession(sessionId);

    if (!session) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired session" });
    }

    res.json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
});

app.post("/logout", async (req, res, next) => {
  try {
    const sessionId = req.header("x-session-id");
    await sessions.destroySession(sessionId);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
});

// ============================================
// 3. Leaderboard
// ============================================

app.post("/leaderboard/score", async (req, res, next) => {
  try {
    const { player, points } = req.body;
    if (!player || typeof points !== "number") {
      return res.status(400).json({
        success: false,
        message: "player (string) and points (number) are required",
      });
    }

    const score = await leaderboard.addScore(player, points);
    res.json({ success: true, data: { player, score } });
  } catch (err) {
    next(err);
  }
});

app.get("/leaderboard/top/:n", async (req, res, next) => {
  try {
    const n = Number(req.params.n) || 10;
    const top = await leaderboard.getTopN(n);
    res.json({ success: true, data: top });
  } catch (err) {
    next(err);
  }
});

app.get("/leaderboard/rank/:player", async (req, res, next) => {
  try {
    const result = await leaderboard.getRank(req.params.player);
    if (!result) {
      return res
        .status(404)
        .json({ success: false, message: "Player not on the leaderboard" });
    }
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// centralized error handler - keeps the routes above free of try/catch
// noise for the "something unexpected broke" case
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: "Something went wrong" });
});

const PORT = process.env.PORT || 4020;
app.listen(PORT, () =>
  console.log(`Realtime Utilities Service running on http://localhost:${PORT}`),
);
