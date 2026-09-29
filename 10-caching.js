// Caching with Redis
// Needs: Redis running (docker run -d -p 6379:6379 redis)
// Run: node 10-caching.js
// Then: curl http://localhost:4010/products (first call slow, second call fast)

const express = require("express");
const Redis = require("ioredis");

const app = express();
app.use(express.json());

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// ============================================
// Why cache?
// ============================================

// Some data is expensive to compute/fetch (a heavy DB query, an external
// API call) but doesn't change every second. Caching stores the RESULT
// so the next request can skip the expensive work entirely.

// ============================================
// Cache-aside pattern (the most common one)
// ============================================

// 1. Check the cache first.
// 2. If found (a "hit"), return it immediately.
// 3. If not found (a "miss"), do the real work, THEN store the result in
//    the cache for next time, with an expiry (TTL) so it doesn't go stale forever.

app.get("/products", async (req, res) => {
  const cacheKey = "products:all";

  const cached = await redis.get(cacheKey);
  if (cached) {
    console.log("Cache HIT");
    return res.json({ success: true, data: JSON.parse(cached), cached: true });
  }

  console.log("Cache MISS - running the slow query");
  const products = await simulateSlowDbQuery();

  // EX 30 = expire after 30 seconds
  await redis.set(cacheKey, JSON.stringify(products), "EX", 30);

  res.json({ success: true, data: products, cached: false });
});

const PORT = 4010;
app.listen(PORT, () =>
  console.log(`Caching demo running on http://localhost:${PORT}`),
);
