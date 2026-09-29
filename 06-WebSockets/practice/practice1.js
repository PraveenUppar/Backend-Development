// Practice 1: Server-Assisted Rejoin After Reconnect (topic 01)
// Run: node practice/practice1.js
// Then connect with socket.io-client twice using the SAME clientId to see
// the second connection get auto-rejoined without emitting "chat:join" itself:
//   const { io } = require("socket.io-client");
//   const socket = io("http://localhost:4621", { auth: { token: "t", clientId: "device-abc" } });
//   socket.on("chat:auto-joined", (d) => console.log("auto-joined:", d));

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Exercise: 01-reconnection.js relies on the CLIENT re-emitting "chat:join"
// after every reconnect, because the server has no memory tied to a new
// socket.id. Here, the client sends a stable `clientId` (something IT
// persists, e.g. in localStorage) in the handshake instead of relying on
// socket.id. The server keeps a Map from clientId -> last known room, so a
// reconnecting client with the SAME clientId gets automatically rejoined
// server-side, without needing to remember or re-send anything itself.

const lastRoomByClientId = new Map(); // clientId -> room name

io.use((socket, next) => {
  const { token, clientId } = socket.handshake.auth || {};
  if (!token || !clientId) return next(new Error("token and clientId are required"));
  socket.user = token;
  socket.clientId = clientId;
  next();
});

io.on("connection", (socket) => {
  const previousRoom = lastRoomByClientId.get(socket.clientId);
  if (previousRoom) {
    socket.join(previousRoom);
    socket.emit("chat:auto-joined", { room: previousRoom, reason: "reconnect" });
  }

  socket.on("chat:join", (room) => {
    socket.join(room);
    lastRoomByClientId.set(socket.clientId, room);
    socket.emit("chat:joined", { room });
  });

  socket.on("disconnect", () => {
    // Deliberately NOT deleting lastRoomByClientId here - that's the whole
    // point. It outlives this one socket so the NEXT connection with the
    // same clientId can use it.
  });
});

const PORT = 4621;
server.listen(PORT, () => console.log(`Practice 1 running on http://localhost:${PORT}`));
