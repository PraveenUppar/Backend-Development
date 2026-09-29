// In-memory room + message-history store, shared by the REST routes and
// the Socket.io handlers in server.js. No database for this assignment -
// everything resets when the process restarts, and each room only keeps
// its last MAX_HISTORY messages.

const ROOM_NAMES = ["general", "random", "backend"];
const MAX_HISTORY = 50;

const rooms = new Map();
ROOM_NAMES.forEach((name) => rooms.set(name, { name, messages: [] }));

function roomExists(name) {
  return rooms.has(name);
}

function listRooms() {
  return Array.from(rooms.values()).map((room) => ({
    name: room.name,
    messageCount: room.messages.length,
  }));
}

function getMessages(name) {
  const room = rooms.get(name);
  return room ? room.messages : null;
}

function addMessage(name, message) {
  const room = rooms.get(name);
  if (!room) return null;
  room.messages.push(message);
  if (room.messages.length > MAX_HISTORY) {
    room.messages.shift();
  }
  return message;
}

module.exports = { ROOM_NAMES, MAX_HISTORY, roomExists, listRooms, getMessages, addMessage };
