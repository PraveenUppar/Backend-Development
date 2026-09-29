// Webhooks 3 - Idempotency on the Receiver Side
// Builds on 02-replay-protection.js.
// Run: node 03-idempotency-receiver.js
// Then: curl -X POST http://localhost:4513/demo/process -H "Content-Type: application/json" -d "{\"id\":\"evt_1\",\"type\":\"order.paid\",\"payload\":{}}" (send twice)

const express = require("express");

const app = express();
app.use(express.json());

// ============================================
// Idempotency on the receiver side
// ============================================

// Webhook delivery is typically "at least once", not "exactly once" - if
// the sender doesn't get a clean 2xx response (timeout, receiver briefly
// down), it retries, and now the same event might arrive twice. If
// "order.paid" triggers "charge the customer's saved card", processing it
// twice is a real bug.
//
// Fix: give every event a unique id, and track which ids you've already
// processed. If an incoming event's id has been seen before, acknowledge it
// (still 2xx, so the sender stops retrying) but skip doing the work again.

const seenEventIds = new Set(); // in-memory for this demo; use Redis/DB in real life

function handleEvent(event) {
  if (seenEventIds.has(event.id)) {
    return { alreadyProcessed: true };
  }
  seenEventIds.add(event.id);
  console.log(`Processing event ${event.id}: ${event.type}`, event.payload);
  // ... the actual side effect (charge a card, update an order) goes here ...
  return { alreadyProcessed: false };
}

app.post("/demo/process", (req, res) => {
  const result = handleEvent(req.body);
  res.status(200).json({ success: true, data: result });
});

// This is the SAME concept as the Cart API's Stripe webhook handling in
// Capstone Project (checking order.status === "pending" before acting is
// effectively an idempotency check keyed on order state) - here you build
// the dedup mechanism yourself with an explicit event id. A Set works for a
// demo; production needs a database/Redis with a unique constraint on the
// event id, since an in-memory Set disappears on restart and doesn't work
// across more than one receiver instance.

const PORT = 4513;
app.listen(PORT, () => console.log(`Idempotency demo running on http://localhost:${PORT}`));
