Assignment 1 - Realtime Utilities Service
============================================

You've now seen the five individual pieces: sorted sets, session storage,
sliding-window rate limiting, atomic INCR, and key expiration. This
assignment combines three of them into one deployable-shaped service
instead of five separate demo servers.

Description
-----------
A small Express + ioredis service with three independent features, each
in its own module:

  1. Sliding-window rate limiting (rateLimiter.js) - GET /ping is limited
     to 5 requests per 10-second rolling window per client IP.
  2. Redis-backed sessions (sessionStore.js) - POST /login, GET /me,
     POST /logout. The server holds the session truth, so /logout is
     just a key delete.
  3. Sorted-set leaderboard (leaderboard.js) - POST /leaderboard/score,
     GET /leaderboard/top/:n, GET /leaderboard/rank/:player.

Requirements (all implemented in the modules above / server.js)
--------------------------------------------------------------------
- Rate limiting must use a sliding window (ZADD + ZREMRANGEBYSCORE +
  ZCARD), not a fixed clock bucket, and must return 429 with a
  Retry-After header once the limit is hit.
- Sessions are stored as a Redis HASH with a 24h TTL that resets on every
  authenticated request to /me (sliding session expiry, not a fixed
  login-time cutoff).
- Leaderboard scoring must be atomic (ZINCRBY) so two concurrent score
  updates for the same player are never lost.
- Every route funnels unexpected errors to the centralized error handler
  at the bottom of server.js instead of leaking a stack trace or hanging.

Bonus (not yet implemented - extend the project with these)
--------------------------------------------------------------
- Make the rate limiter key off the authenticated session (once logged
  in) instead of IP, falling back to IP for anonymous requests - so one
  NAT'd office network doesn't share a single rate-limit bucket.
- Add a GET /leaderboard/around/:player endpoint that returns the player
  plus the 2 ranks above and below them (a "your neighbors" view), using
  ZREVRANK to find the player's position first.
- Add a DELETE /sessions/all/:userId that scans for and deletes every
  session belonging to one user (a real "log out everywhere" button),
  using SCAN with a pattern instead of KEYS (which blocks Redis on a
  large keyspace).
