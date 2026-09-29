// WebSockets 1 - Reconnection: What Survives, What Doesn't
// ../14-websockets-socketio.js already covers why WebSockets exist, the
// connection lifecycle, custom events, rooms, and a JWT auth middleware
// sketch. This picks up where that one stops.
// Run: node 01-reconnection.js
// Then connect with socket.io-client (needs socket.io-client installed):
//   const { io } = require("socket.io-client");
//   const socket = io("http://localhost:4611", { auth: { token: "demo-token" } });
//   socket.on("connect", () => socket.emit("chat:join", "general"));
//   socket.on("chat:joined", (data) => console.log("joined:", data));

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

// ============================================
// Reconnection - what survives, what doesn't
// ============================================

// Socket.io's client reconnects automatically (exponential backoff, no
// wiring required on your part) - but "reconnected" does NOT mean "picked
// up where it left off". Losing the transport gives the client a BRAND
// NEW socket.id when it comes back, and the server treats it as a fresh
// connection: Socket.io automatically removes a dead socket from every
// room it was in, and any per-connection state you attached (like
// `socket.user` in the io.use() middleware below) is gone with it.
//
// What's LOST: room membership, and anything you stored ON the socket
// object itself.
// What's PRESERVED: whatever the CLIENT remembers and chooses to redo
// (which room it thinks it's in), plus any server-side state that lives
// OUTSIDE the socket - e.g. the Capstone chat server's `rooms` Map in
// rooms.js keeps message history independent of any one connection, which
// is why a reconnecting client can still fetch it via the "joined" event
// payload (`socket.emit("joined", { room, history: getMessages(roomName) })`).
//
// That's why you almost always need the CLIENT to re-emit "join" after a
// reconnect, rather than assuming the server remembers - listen on the
// general "connect" event (fires on first connect AND every reconnect),
// not just once at startup:
//
//   const socket = io("http://localhost:4611", { auth: { token } });
//   let currentRoom = "general";
//
//   socket.on("connect", () => {
//     // Runs on first connect AND after every automatic reconnect - the
//     // server has zero memory of this room membership for a new socket.id.
//     socket.emit("chat:join", currentRoom);
//   });
//
//   socket.on("disconnect", (reason) => {
//     console.log("dropped:", reason); // "transport close", "ping timeout", etc.
//   });

function createChatServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: "*" } });

  app.get("/health", (req, res) => res.json({ success: true, data: "ok" }));

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));
    socket.user = token; // real app: jwt.verify(token, JWT_SECRET)
    next();
  });

  io.on("connection", (socket) => {
    // Every "chat:join" is idempotent and unconditional - it doesn't matter
    // whether this is the client's first connect or its fifth reconnect,
    // because this socket object has never been in any room until it asks.
    socket.on("chat:join", (room) => {
      socket.join(room);
      socket.to(room).emit("chat:system", `${socket.user} joined ${room}`);
      socket.emit("chat:joined", { room });
    });

    socket.on("chat:message", ({ room, text }) => {
      io.to(room).emit("chat:message", { user: socket.user, text, at: new Date().toISOString() });
    });

    socket.on("disconnect", () => {
      // No manual room cleanup needed here - Socket.io already removed this
      // socket from every room it was in. If this were the ONLY copy of the
      // client's session state (instead of just a room name the client
      // remembers), that state would be gone for good at this point.
    });
  });

  return { app, server, io };
}

module.exports = createChatServer;

const PORT = 4611;
if (require.main === module) {
  const { server } = createChatServer();
  server.listen(PORT, () => console.log(`Reconnection demo running on http://localhost:${PORT}`));
}
