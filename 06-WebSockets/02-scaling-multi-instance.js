// WebSockets 2 - Scaling Socket.io Across Multiple Instances
// Builds on 01-reconnection.js (reuses its createChatServer factory).
// Needs: @socket.io/redis-adapter + redis packages, and REDIS_URL set, to
// actually exercise the adapter - the server still runs fine without them
// (it just skips attaching the adapter, same as a single-instance setup).
// Run: node 02-scaling-multi-instance.js

const createChatServer = require("./01-reconnection");

// ============================================
// Scaling Socket.io across multiple server instances
// ============================================

// A socket is only "in a room" on the ONE process that accepted its
// connection. Run two instances (A and B) behind a load balancer: client 1
// connects to A, client 2 connects to B. `socket.join("general")` on A only
// updates A's in-memory adapter (a plain Map living in A's RAM). When A
// does `io.to("general").emit(...)`, that reaches only sockets connected
// to A - B has never heard of "general" having client 1 in it, so client 2
// never gets the message, even though both clients think they're in the
// same room. This isn't a bug you can code around in a single process -
// it's a direct consequence of the default adapter having no cross-process
// communication.
//
// Two pieces to the real fix:
//
// a) Sticky sessions - the load balancer must route every request from a
//    given client to the SAME instance for the life of the connection
//    (session affinity via cookie or source-IP hash). This matters most
//    when the long-polling transport fallback is in play, where a single
//    logical connection's handshake could otherwise get split across
//    instances mid-negotiation. It does NOT by itself solve the room
//    problem below - it just keeps one client's OWN traffic on one server.
//
// b) The @socket.io/redis-adapter - every instance shares the same Redis
//    and swaps the default in-memory adapter for a Redis-backed one:

async function attachRedisAdapterIfConfigured(io) {
  if (!process.env.REDIS_URL) return; // opt-in - the demo runs fine without Redis

  const { createAdapter } = require("@socket.io/redis-adapter");
  const { createClient } = require("redis");

  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();
  await Promise.all([pubClient.connect(), subClient.connect()]);

  io.adapter(createAdapter(pubClient, subClient));
  console.log("Socket.io using the Redis adapter - safe to run multiple instances now");
}

// Why this fixes it: each instance STILL only tracks its own directly
// connected sockets locally - Redis doesn't become a giant shared "who's in
// what room" table. What it buys you is a shared broadcast bus: when
// instance A does `io.to("general").emit(...)`, the Redis adapter
// publishes that emit on a Redis pub/sub channel. EVERY instance
// subscribed to that channel (including B) receives it and forwards it to
// whichever of ITS OWN local sockets are in "general". That's why the fix
// is pub/sub (a messaging pattern) and not "move the rooms Map into Redis"
// - you still need each instance's own live socket objects to actually
// push the event down their open connections.
//
// Applied to the Capstone chat server: today its `socketRooms` Map and
// rooms.js's message history both live in one process's RAM. Running two
// instances of that server without the Redis adapter would mean two chat
// servers that silently drop messages to whichever half of your users
// landed on the other instance - exactly the split-brain problem above.

const PORT = 4612;
if (require.main === module) {
  const { server, io } = createChatServer();
  attachRedisAdapterIfConfigured(io).catch((err) =>
    console.error("Redis adapter setup failed:", err.message)
  );
  server.listen(PORT, () => console.log(`Scaling demo running on http://localhost:${PORT}`));
}

module.exports = { attachRedisAdapterIfConfigured };
