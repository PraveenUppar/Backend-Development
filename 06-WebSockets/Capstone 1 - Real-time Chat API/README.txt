Capstone 1 - Real-time Chat API
=================================

You've now seen the three individual pieces: reconnection semantics,
scaling across instances, and testing Socket.io handlers. This project
predates those three files - it's the real, hands-on chat backend that
01-03 were extracted FROM, combining a small REST API with Socket.io.

Description
-----------
No database - messages live in memory, capped at the last 50 per room
(rooms.js). Two halves:

  1. REST (server.js): GET /rooms lists available rooms (seeded: general,
     random, backend); GET /rooms/:name/messages returns the last 50
     messages for a room; GET /rooms/:name/active-users (bonus) reports
     how many sockets are currently in a room via
     io.sockets.adapter.rooms.
  2. Socket.io (server.js): "join" to join a room, "message" to send a
     message (broadcast to the room AND pushed into the in-memory
     history), "typing" to broadcast "X is typing..." to others in the
     room (not back to the sender), and on disconnect, broadcast to
     whatever room the user was in that they left.

Setup: npm install, then node server.js. Drive the Socket.io side with the
socket.io-client snippet at the bottom of server.js.

Requirements (all implemented in server.js / rooms.js)
------------------------------------------------------------
- Basic auth: the socket handshake must carry a `username`
  (socket.handshake.auth.username) - a missing/blank username rejects the
  connection before "connection" ever fires.
- "message" payloads are validated with Zod (room + non-empty text)
  before touching the in-memory history or broadcasting anything.
- "typing" broadcasts to OTHERS in the room only (socket.to(), not
  io.to()) - the sender must never receive its own typing event, per
  practice/practice3.js in ../06-WebSockets.
- Each room's history is capped at 50 messages (rooms.js's MAX_HISTORY) -
  the oldest message is dropped once a room exceeds that, not left to
  grow unbounded.
- Centralized error middleware (middleware/errorHandler.js) handles REST
  errors; a 404 handler catches any route that didn't match above it.

Bonus (not yet implemented - extend the project with these)
--------------------------------------------------------------
- Apply 01-reconnection.js's pattern here: have the client persist a
  stable id and re-emit "join" on every "connect" (not just the first),
  since today a reconnecting client silently loses its room membership
  exactly as topic 1 describes.
- Apply 02-scaling-multi-instance.js's Redis adapter so this server could
  actually run as more than one instance behind a load balancer without
  splitting rooms across processes.
- Add tests following 03-testing-websockets.js's pattern - spin up this
  real server on an ephemeral port and drive "join"/"message"/"typing"
  with socket.io-client instead of only manually curl-ing the REST side.
