// Practice 1: Sorted Sets for a Trending List (topic 01)
// Needs: Redis running (docker run -d -p 6379:6379 redis)
// Run: node practice/practice1.js
// Then: curl -X POST http://localhost:4221/articles/article-42/view

const express = require("express");
const Redis = require("ioredis");

const app = express();
app.use(express.json());
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// Exercise: a "trending articles" list is the same shape as a leaderboard -
// unique member (article id), score (view count) - so reuse the sorted-set
// pattern instead of inventing a new one.

app.post("/articles/:id/view", async (req, res) => {
  const score = await redis.zincrby("trending:articles", 1, req.params.id);
  res.json({ success: true, data: { articleId: req.params.id, views: Number(score) } });
});

app.get("/articles/trending/:n", async (req, res) => {
  const raw = await redis.zrevrange("trending:articles", 0, Number(req.params.n) - 1, "WITHSCORES");
  const top = [];
  for (let i = 0; i < raw.length; i += 2) top.push({ articleId: raw[i], views: Number(raw[i + 1]) });
  res.json({ success: true, data: top });
});

// curl -X POST .../articles/article-42/view (repeat a few times)
// curl .../articles/trending/5 -> top 5 by view count, highest first

const PORT = 4221;
app.listen(PORT, () => console.log(`Practice 1 running on http://localhost:${PORT}`));
