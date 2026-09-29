// Real-time Chat API
// Setup: npm install
// Run: node server.js
// Then: curl http://localhost:5007/rooms
// See README.txt for the full brief, and the socket.io-client snippet at
// the bottom of this file to drive the Socket.io side.

require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { z } = require("zod");
const { errorHandler, NotFoundError, asyncHandler } = require("./middleware/errorHandler");
const { roomExists, listRooms, getMessages, addMessage } = require("./rooms");

const app = express();
const server = http.createServer(app); // Socket.io attaches to the raw HTTP server
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());

app.get("/health", (req, res) => res.json({ success: true, data: "ok" }));

// ============================================
// REST endpoints
// ============================================

// GET /rooms
app.get("/rooms", (req, res) => {
  res.json({ success: true, data: listRooms() });
});

// GET /rooms/:name/messages - last 50 messages for a room
app.get(
  "/rooms/:name/messages",
  asyncHandler(async (req, res) => {
    const messages = getMessages(req.params.name);
    if (messages === null) throw new NotFoundError("Room");
    res.json({ success: true, data: messages });
  })
);

// GET /rooms/:name/active-users - bonus, backed by Socket.io's own room adapter
app.get(
  "/rooms/:name/active-users",
  asyncHandler(async (req, res) => {
    if (!roomExists(req.params.name)) throw new NotFoundError("Room");
    const socketsInRoom = io.sockets.adapter.rooms.get(req.params.name);
    res.json({
      success: true,
      data: { room: req.params.name, activeUsers: socketsInRoom ? socketsInRoom.size : 0 },
    });
  })
);

// 404 for anything that didn't match a route above
app.use((req, res, next) => {
  next(new NotFoundError("Route"));
});

// centralized error middleware - must be registered last
app.use(errorHandler);

// ============================================
// Socket.io auth - handshake must carry a username, or the connection
// is rejected before "connection" ever fires.
// ============================================

io.use((socket, next) => {
  const username = socket.handshake.auth?.username;
  if (!username || typeof username !== "string" || !username.trim()) {
    return next(new Error("A username is required to connect"));
  }
  socket.username = username.trim();
  next();
});

// Tracks which single room each socket is currently sitting in, so we know
// what to announce on "join" (leaving the old room) and on disconnect.
const socketRooms = new Map(); // socket.id -> room name

const messageSchema = z.object({
  room: z.string().min(1, "Room is required"),
  text: z.string().min(1, "Message text cannot be empty"),
});

io.on("connection", (socket) => {
  console.log(`${socket.username} connected (${socket.id})`);

  // ============================================
  // join - move this socket into a room
  // ============================================
  socket.on("join", (roomName) => {
    if (!roomExists(roomName)) {
      return socket.emit("error", { message: `Room "${roomName}" does not exist` });
    }

    const previousRoom = socketRooms.get(socket.id);
    if (previousRoom && previousRoom !== roomName) {
      socket.leave(previousRoom);
      socket.to(previousRoom).emit("system", { message: `${socket.username} left ${previousRoom}` });
    }

    socket.join(roomName);
    socketRooms.set(socket.id, roomName);

    socket.to(roomName).emit("system", { message: `${socket.username} joined ${roomName}` });
    socket.emit("joined", { room: roomName, history: getMessages(roomName) });
  });

  // ============================================
  // message - send + persist into in-memory history
  // ============================================
  socket.on("message", (payload) => {
    const result = messageSchema.safeParse(payload);
    if (!result.success) {
      return socket.emit("error", {
        message: result.error.issues.map((i) => i.message).join(", "),
      });
    }

    const { room, text } = result.data;
    if (!roomExists(room)) {
      return socket.emit("error", { message: `Room "${room}" does not exist` });
    }

    const message = { user: socket.username, text, at: new Date().toISOString() };
    addMessage(room, message);

    // Broadcast to everyone in the room, sender included, so every client
    // renders the message from the same event.
    io.to(room).emit("message", message);
  });

  // ============================================
  // typing - broadcast to others in the room, never back to the sender
  // ============================================
  socket.on("typing", (roomName) => {
    if (!roomName || !roomExists(roomName)) return;
    socket.to(roomName).emit("typing", { message: `${socket.username} is typing...` });
  });

  // ============================================
  // disconnect - announce departure to whatever room this socket was in
  // ============================================
  socket.on("disconnect", () => {
    const room = socketRooms.get(socket.id);
    if (room) {
      socket.to(room).emit("system", { message: `${socket.username} left ${room}` });
      socketRooms.delete(socket.id);
    }
    console.log(`${socket.username} disconnected (${socket.id})`);
  });
});

const PORT = process.env.PORT || 5007;
server.listen(PORT, () => console.log(`Real-time Chat API running on http://localhost:${PORT}`));

// ============================================
// Try it out
// ============================================
//
// REST:
// curl http://localhost:5007/rooms
// curl http://localhost:5007/rooms/general/messages
// curl http://localhost:5007/rooms/general/active-users
//
// Socket.io (save as a .js file and run with `node`, needs socket.io-client):
//
// const { io } = require("socket.io-client");
// const socket = io("http://localhost:5007", { auth: { username: "Praveen" } });
//
// socket.on("connect", () => socket.emit("join", "general"));
// socket.on("joined", (data) => console.log("joined:", data));
// socket.on("system", (msg) => console.log("system:", msg.message));
// socket.on("message", (msg) => console.log(`${msg.user}: ${msg.text}`));
// socket.on("typing", (msg) => console.log("typing:", msg.message));
// socket.on("error", (err) => console.log("error:", err.message));
// socket.on("connect_error", (err) => console.log("connect_error:", err.message));
//
// setTimeout(() => socket.emit("message", { room: "general", text: "hello everyone" }), 500);
// setTimeout(() => socket.emit("typing", "general"), 800);
