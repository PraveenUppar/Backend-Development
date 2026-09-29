// Redis-backed sessions: the server holds the truth, so logging a user
// out (or killing a compromised session) is just deleting a key - no
// blocklist needed like you'd have to bolt onto stateless JWTs.
// See ../Notes.txt topic 2 for the JWT vs session trade-off.

const crypto = require("crypto");

const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24h of inactivity before it expires

function createSessionStore(redis) {
  function sessionKey(sessionId) {
    return `session:${sessionId}`;
  }

  // stores the session as a HASH (small object) with a TTL - Redis
  // cleans it up on its own, no cron job required
  async function createSession(userId) {
    const sessionId = crypto.randomUUID();
    await redis.hset(sessionKey(sessionId), {
      userId: String(userId),
      createdAt: Date.now().toString(),
    });
    await redis.expire(sessionKey(sessionId), SESSION_TTL_SECONDS);
    return sessionId;
  }

  async function getSession(sessionId) {
    if (!sessionId) return null;

    const data = await redis.hgetall(sessionKey(sessionId));
    // ioredis returns {} (not null) for a missing/expired hash key
    if (!data || Object.keys(data).length === 0) return null;

    return data;
  }

  async function destroySession(sessionId) {
    if (!sessionId) return;
    await redis.del(sessionKey(sessionId));
  }

  return { createSession, getSession, destroySession };
}

module.exports = { createSessionStore, SESSION_TTL_SECONDS };
