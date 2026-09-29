// WebSockets with Socket.io - real-time events and rooms
// Run: node 14-websockets-socketio.js
// Test: open two terminals with `node` and use socket.io-client, or a simple HTML page with the socket.io client script

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app); // Socket.io attaches to the raw HTTP server, not the Express app directly
const io = new Server(server, { cors: { origin: "*" } });

// ============================================
// Why WebSockets instead of REST here?
// ============================================

// REST is request/response: the client always asks first. Some features
// need the SERVER to push data without being asked - a chat message
// arriving, a live notification, a live score update. A WebSocket is a
// persistent two-way connection that makes that possible.

// ============================================
// Connection lifecycle
// ============================================

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // ============================================
  // Listening for a custom event from this client
  // ============================================

  socket.on("chat:message", ({ room, text, user }) => {
    console.log(`[${room}] ${user}: ${text}`);

    // Broadcast to everyone in the room EXCEPT the sender
    socket.to(room).emit("chat:message", { user, text, at: new Date().toISOString() });
  });

  // ============================================
  // Rooms - group sockets so events only go to relevant clients
  // ============================================

  // Without rooms, io.emit() would blast every event to every connected
  // client, even ones in a totally different chat channel.

  socket.on("chat:join", (room) => {
    socket.join(room);
    socket.to(room).emit("chat:system", `A user joined ${room}`);
  });

  socket.on("chat:leave", (room) => {
    socket.leave(room);
    socket.to(room).emit("chat:system", `A user left ${room}`);
  });

  // ============================================
  // Cleanup on disconnect
  // ============================================

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// ============================================
// Authenticating socket connections (JWT from the handshake)
// ============================================

// Socket.io middleware runs once per connection, before "connection" fires.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error("Authentication required"));
  }
  // In a real app: const payload = jwt.verify(token, JWT_SECRET); socket.user = payload;
  next();
});

app.get("/health", (req, res) => res.json({ success: true, data: "ok" }));

const PORT = 4014;
server.listen(PORT, () => console.log(`Socket.io demo running on http://localhost:${PORT}`));

// ============================================
// Client-side usage (for reference - this runs in the browser/frontend)
// ============================================

// const socket = io("http://localhost:4014", { auth: { token: "..." } });
// socket.emit("chat:join", "general");
// socket.emit("chat:message", { room: "general", text: "hi", user: "Praveen" });
// socket.on("chat:message", (msg) => console.log(msg));
