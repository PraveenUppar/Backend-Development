const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  // Don't let a missing Redis crash the whole app during learning/testing -
  // just log and let cache calls fail soft (see cacheGet/cacheSet below).
  maxRetriesPerRequest: 1,
  lazyConnect: true,
});

redis.on("error", (err) => console.error("Redis error:", err.message));

async function cacheGet(key) {
  try {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null; // cache is an optimization, never let it break a request
  }
}

async function cacheSet(key, value, ttlSeconds = 30) {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // ignore - see cacheGet
  }
}

async function cacheDelByPrefix(prefix) {
  try {
    const keys = await redis.keys(`${prefix}*`);
    if (keys.length) await redis.del(keys);
  } catch {
    // ignore
  }
}

module.exports = { redis, cacheGet, cacheSet, cacheDelByPrefix };
