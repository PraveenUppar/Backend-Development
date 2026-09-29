// Caching/Redis 4 - Atomic INCR
// Builds on 03-sliding-window-rate-limiter.js.
// Needs: Redis running (docker run -d -p 6379:6379 redis)
// Run: node 04-atomic-incr.js
// Then: curl -X POST http://localhost:4214/views/product-123

const express = require("express");
const Redis = require("ioredis");

const app = express();
app.use(express.json());
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// ============================================
// Atomic INCR - why read-then-write has a race condition INCR doesn't
// ============================================

// If you do this instead of using INCR:
//   const current = await redis.get("counter");          // read
//   await redis.set("counter", Number(current) + 1);      // write
// ...two concurrent requests can both read the same "current" value before
// either writes, so both compute current+1 and one increment is silently
// lost. This is a classic read-modify-write race, and it happens even
// against Redis because the RACE is in YOUR code (two round trips), not in
// Redis itself.

app.post("/views/:productId", async (req, res) => {
  // atomic: read+increment+write happens as one indivisible operation
  const views = await redis.incr(`views:${req.params.productId}`);
  res.json({ success: true, data: { productId: req.params.productId, views } });
});

// Redis is single-threaded for command execution, so INCR (and INCRBY,
// HINCRBY, ZINCRBY) can never interleave with another client's command -
// there's no window where two increments both read the same starting value.
// Use INCR/HINCRBY for counters instead of get-then-set, any time multiple
// requests/processes might touch the same key concurrently.

const PORT = 4214;
app.listen(PORT, () => console.log(`Atomic INCR demo running on http://localhost:${PORT}`));
