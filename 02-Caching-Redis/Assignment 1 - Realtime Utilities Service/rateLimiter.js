// Sliding-window rate limiter, backed by a Redis sorted set.
//
// Why not just INCR a counter per time-bucket (fixed window)? Because a
// fixed window resets at a clock boundary, so a client can send `max`
// requests at 0:59 and another `max` at 1:00 - 2x the limit in a couple
// seconds, both technically "within" their own window. A sliding window
// looks at a rolling range of time ending NOW, so there's no boundary to
// game. See ../Notes.txt topic 3 for the full walkthrough.

function createRateLimiter(
  redis,
  { windowMs = 60_000, max = 10, keyPrefix = "ratelimit" } = {},
) {
  return async function rateLimiter(req, res, next) {
    // one bucket per client - IP is a simple stand-in here; swap for a
    // user id or API key if requests are authenticated.
    const clientId = req.ip;
    const key = `${keyPrefix}:${clientId}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      // 1. drop anything that's aged out of the window - it no longer counts
      await redis.zremrangebyscore(key, 0, windowStart);

      // 2. how many requests are still "live" in the window?
      const count = await redis.zcard(key);

      if (count >= max) {
        // the oldest surviving entry tells us when a slot frees up
        const oldest = await redis.zrange(key, 0, 0, "WITHSCORES");
        const oldestScore = oldest.length ? Number(oldest[1]) : now;
        const retryAfterMs = Math.max(0, oldestScore + windowMs - now);
        const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));

        res.set("Retry-After", String(retryAfterSec));
        return res.status(429).json({
          success: false,
          message: `Too many requests. Try again in ${retryAfterSec}s.`,
        });
      }

      // 3. record this request. Member must be unique per request - the
      // timestamp alone can collide if two requests land in the same ms.
      const member = `${now}-${Math.random().toString(36).slice(2)}`;
      await redis.zadd(key, now, member);
      // let the whole key expire on its own if this client goes quiet,
      // instead of leaving an empty-but-present key around forever
      await redis.expire(key, Math.ceil(windowMs / 1000));

      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { createRateLimiter };
