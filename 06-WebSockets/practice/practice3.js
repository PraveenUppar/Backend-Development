// Practice 3: Testing a "typing" Event (topic 03)
// Run: npx jest practice/practice3.js
// Needs: jest and socket.io-client installed.

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const Client = require("socket.io-client");

// Exercise: 03-testing-websockets.js tests "join" and "message" but not a
// "broadcast to others, never back to sender" event like "typing". Write
// that test here - it needs a THIRD client in the room to prove the
// sender itself does NOT get its own typing event back.

function createServerWithTyping() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: "*" } });

  io.on("connection", (socket) => {
    socket.on("chat:join", (room) => socket.join(room));
    socket.on("chat:typing", (room) => {
      socket.to(room).emit("chat:typing", { user: socket.id }); // to(), not io.to() - excludes the sender
    });
  });

  return { server, io };
}

describe("typing indicator", () => {
  let server, io, alice, bob, port;

  beforeAll((done) => {
    ({ server, io } = createServerWithTyping());
    server.listen(() => {
      port = server.address().port;
      alice = Client(`http://localhost:${port}`);
      bob = Client(`http://localhost:${port}`);
      let connected = 0;
      const onConnect = () => {
        connected += 1;
        if (connected === 2) done();
      };
      alice.on("connect", onConnect);
      bob.on("connect", onConnect);
    });
  });

  afterAll(() => {
    io.close();
    alice.close();
    bob.close();
    server.close();
  });

  it("notifies others in the room, but never the sender", (done) => {
    let aliceGotItsOwnEvent = false;

    alice.on("chat:typing", () => {
      aliceGotItsOwnEvent = true;
    });

    bob.once("chat:typing", () => {
      // Give alice's own listener a tick to fire too, if it were going to.
      setTimeout(() => {
        expect(aliceGotItsOwnEvent).toBe(false);
        done();
      }, 50);
    });

    alice.emit("chat:join", "general");
    bob.emit("chat:join", "general");
    setTimeout(() => alice.emit("chat:typing", "general"), 100);
  });
});
