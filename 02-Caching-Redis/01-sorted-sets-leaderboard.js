// Caching/Redis 1 - Sorted Sets (ZADD / ZRANGE / ZINCRBY)
// ../10-caching.js already covers WHY caching helps, the cache-aside
// pattern, cache invalidation on writes, and basic ioredis GET/SET. This
// picks up where that one stops - the data structures beyond a plain key.
// Needs: Redis running (docker run -d -p 6379:6379 redis)
// Run: node 01-sorted-sets-leaderboard.js
// Then: curl -X POST http://localhost:4211/leaderboard/score -H "Content-Type: application/json" -d "{\"player\":\"ann\",\"points\":10}"

const express = require("express");
const Redis = require("ioredis");

const app = express();
app.use(express.json());
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// ============================================
// Sorted Sets - ZADD / ZRANGE / ZINCRBY
// ============================================

// A Sorted Set is a set of unique members where every member also has a
// "score" (a float). Redis keeps it sorted by score internally, so reading
// "top N" or "rank of X" is fast (log-time) no matter how big the set gets -
// you're not sorting an array yourself every request.

app.post("/leaderboard/score", async (req, res) => {
  const { player, points } = req.body;
  const newScore = await redis.zincrby("leaderboard", points, player); // atomic +=
  res.json({ success: true, data: { player, score: Number(newScore) } });
});

app.get("/leaderboard/top/:n", async (req, res) => {
  // highest score first, WITHSCORES to also get the numbers back
  const raw = await redis.zrevrange("leaderboard", 0, Number(req.params.n) - 1, "WITHSCORES");
  const top = [];
  for (let i = 0; i < raw.length; i += 2) top.push({ player: raw[i], score: Number(raw[i + 1]) });
  res.json({ success: true, data: top });
});

app.get("/leaderboard/rank/:player", async (req, res) => {
  const rank = await redis.zrevrank("leaderboard", req.params.player); // 0-based, 0 = highest
  if (rank === null) return res.status(404).json({ success: false, message: "Player not found" });
  res.json({ success: true, data: { player: req.params.player, rank: rank + 1 } });
});

// This is the natural fit for leaderboards/rankings, but the same structure
// is useful anywhere you need "top N by some number" without a DB query -
// trending posts by view count, most-active users this week, etc. Score
// doesn't have to be a game score; it's often a timestamp (see the rate
// limiter in 03-sliding-window-rate-limiter.js).

const PORT = 4211;
app.listen(PORT, () => console.log(`Sorted sets / leaderboard demo running on http://localhost:${PORT}`));
