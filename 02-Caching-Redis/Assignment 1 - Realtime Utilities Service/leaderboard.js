// Leaderboard backed by a single Redis sorted set - member = player
// name, score = points. See ../Notes.txt topic 1 for why sorted sets
// are the right structure for "top N" / "rank of X" queries.

function createLeaderboard(redis, key = "leaderboard") {
  // ZINCRBY is atomic, so two requests scoring the same player at the
  // same time still both land correctly - no lost updates.
  async function addScore(player, points) {
    const newScore = await redis.zincrby(key, points, player);
    return Number(newScore);
  }

  // highest score first, top N. WITHSCORES comes back flattened:
  // [member, score, member, score, ...] - pair it back up.
  async function getTopN(n) {
    const raw = await redis.zrevrange(key, 0, n - 1, "WITHSCORES");
    const result = [];
    for (let i = 0; i < raw.length; i += 2) {
      result.push({ player: raw[i], score: Number(raw[i + 1]) });
    }
    return result;
  }

  async function getRank(player) {
    // zrevrank = rank counting from the HIGHEST score, 0-based; null if
    // the player isn't on the board at all
    const rank = await redis.zrevrank(key, player);
    if (rank === null) return null;

    const score = await redis.zscore(key, player);
    return { player, rank: rank + 1, score: Number(score) }; // 1-based for humans
  }

  return { addScore, getTopN, getRank };
}

module.exports = { createLeaderboard };
