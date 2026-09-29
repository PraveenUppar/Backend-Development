// WebSockets 3 - Testing WebSocket Code
// Builds on 01-reconnection.js (reuses its createChatServer factory).
// Needs: jest and socket.io-client installed.
// Run: npx jest 03-testing-websockets.js

// ============================================
// Testing WebSocket code
// ============================================

// Supertest (used throughout ../07-Testing/) works because it's built for plain
// request/response HTTP: fire one request, assert on the one response.
// A WebSocket connection isn't request/response - it's a long-lived,
// bidirectional stream of events - so supertest has nothing to hook into
// for `socket.on("chat:message", ...)`. For Socket.io you test with the
// REAL client library, socket.io-client, against a real (ephemeral-port)
// server instance - there's no "fake in-memory socket" shortcut the way
// supertest fakes HTTP requests.

const Client = require("socket.io-client");
const createChatServer = require("./01-reconnection");

describe("chat server (socket.io-client against a real ephemeral server)", () => {
  let server, io, clientSocket, port;

  beforeAll((done) => {
    ({ server, io } = createChatServer());
    server.listen(() => {
      port = server.address().port;
      clientSocket = Client(`http://localhost:${port}`, { auth: { token: "praveen-token" } });
      clientSocket.on("connect", done);
    });
  });

  afterAll(() => {
    io.close();
    clientSocket.close();
    server.close();
  });

  it("acks the join with a chat:joined event", (done) => {
    clientSocket.once("chat:joined", (payload) => {
      expect(payload.room).toBe("general");
      done();
    });
    clientSocket.emit("chat:join", "general");
  });

  it("broadcasts a message to everyone in the room, sender included", (done) => {
    clientSocket.once("chat:message", (msg) => {
      expect(msg.text).toBe("hello from the deep dive");
      expect(msg.user).toBe("praveen-token");
      done();
    });
    clientSocket.emit("chat:message", { room: "general", text: "hello from the deep dive" });
  });

  it("rejects a connection with no auth token", (done) => {
    const unauthed = Client(`http://localhost:${port}`); // no `auth` at all
    unauthed.on("connect_error", (err) => {
      expect(err.message).toBe("Authentication required");
      unauthed.close();
      done();
    });
  });
});

// The shape here is always the same: emit and wait for the matching event
// via `done()` (or a Promise wrapper), because the response is
// asynchronous and event-driven rather than a single awaited HTTP call.
// You'd apply this exact pattern to test the real Capstone chat server's
// "join"/"message"/"typing" handlers - spin up its `io` on an ephemeral
// port in beforeAll, connect one or two socket.io-client instances with
// the right `auth.username`, and drive the same events a real browser
// client would (see the client-usage comment block at the bottom of that
// server.js).
