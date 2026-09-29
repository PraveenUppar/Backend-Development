// Practice 2: Watching Rooms Break Across Two Instances (topic 02)
// Run: node practice/practice2.js
// No client needed - this script IS the demonstration, connecting two
// socket.io-client sockets to two separate in-memory server instances and
// proving a broadcast on one never reaches the other.

const createChatServer = require("../01-reconnection");
const Client = require("socket.io-client");

// Exercise: spin up TWO separate instances of the exact same server
// factory (simulating two processes behind a load balancer, both using
// the default in-memory adapter - no Redis). Connect one client to each,
// join both to "general", then broadcast from instance A only. Instance
// B's client should NEVER receive it - this is the split-brain problem
// 02-scaling-multi-instance.js explains, made concrete instead of just
// described.

async function main() {
  const instanceA = createChatServer();
  const instanceB = createChatServer();

  await new Promise((resolve) => instanceA.server.listen(0, resolve));
  await new Promise((resolve) => instanceB.server.listen(0, resolve));

  const portA = instanceA.server.address().port;
  const portB = instanceB.server.address().port;

  const clientA = Client(`http://localhost:${portA}`, { auth: { token: "on-instance-a" } });
  const clientB = Client(`http://localhost:${portB}`, { auth: { token: "on-instance-b" } });

  await Promise.all([
    new Promise((resolve) => clientA.on("connect", resolve)),
    new Promise((resolve) => clientB.on("connect", resolve)),
  ]);

  clientA.emit("chat:join", "general");
  clientB.emit("chat:join", "general");
  await new Promise((r) => setTimeout(r, 200)); // let both joins land

  let clientBReceivedIt = false;
  clientB.on("chat:message", () => {
    clientBReceivedIt = true;
  });

  clientA.emit("chat:message", { room: "general", text: "hello from instance A" });
  await new Promise((r) => setTimeout(r, 500));

  console.log(
    clientBReceivedIt
      ? "UNEXPECTED: client B received a message sent on instance A - check your setup"
      : "As expected: client B never received instance A's message - both instances think they're the only one with a 'general' room"
  );

  clientA.close();
  clientB.close();
  instanceA.server.close();
  instanceB.server.close();
}

main();
