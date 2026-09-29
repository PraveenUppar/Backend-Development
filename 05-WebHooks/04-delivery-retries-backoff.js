// Webhooks 4 - Delivery Retries with Backoff (the SENDER side)
// Builds on 03-idempotency-receiver.js.
// Needs: Node 18+ (uses global fetch and crypto.randomUUID)
// Run: node 04-delivery-retries-backoff.js
// Then: curl -X POST http://localhost:4514/demo/send -H "Content-Type: application/json" -d "{\"targetUrl\":\"http://localhost:9999/nowhere\",\"type\":\"demo.event\",\"payload\":{}}"

const express = require("express");
const crypto = require("crypto");

const app = express();
const SECRET = "demo-shared-secret";

function sign(payloadString, secret) {
  return crypto.createHmac("sha256", secret).update(payloadString).digest("hex");
}

// ============================================
// Delivery retries with backoff - the SENDER side
// ============================================

// The receiver might be down for a few seconds, might 500, or the request
// might time out. A sender that gives up after one attempt loses events
// unnecessarily. A sender that retries instantly in a tight loop can hammer
// a struggling receiver and make things worse.

async function deliverWithRetry(url, body, headers, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, { method: "POST", headers, body });
      if (res.ok) return; // 2xx - done
      throw new Error(`Non-2xx response: ${res.status}`);
    } catch (err) {
      if (attempt === maxAttempts) {
        console.error(`Giving up after ${maxAttempts} attempts: ${err.message}`);
        return;
      }
      const delay = 2 ** attempt * 1000; // 2s, 4s, 8s...
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

// Same idea as BullMQ's `backoff: { type: "exponential", delay }` from
// ../03-Background-Jobs, implemented by hand here since this demo isn't
// using a queue library. A real production sender would persist "this
// delivery is pending retry" somewhere (a DB row or a queue) so retries
// survive a process restart - a bare in-memory retry loop (like this one,
// and like Assignment 1 - Webhook Dispatcher/dispatcher.js) loses pending
// retries if the process crashes mid-backoff. That's exactly what a job
// queue is good for: modeling "deliver this webhook" AS a background job
// with its own attempts/backoff, instead of hand-rolling the retry loop.

app.post("/demo/send", express.json(), async (req, res) => {
  const event = { id: crypto.randomUUID(), type: req.body.type || "demo.event", payload: req.body.payload || {} };
  const timestamp = Date.now();
  const body = JSON.stringify(event);
  const signature = sign(`${timestamp}.${body}`, SECRET);

  await deliverWithRetry(req.body.targetUrl, body, {
    "Content-Type": "application/json",
    "X-Webhook-Signature": signature,
    "X-Webhook-Timestamp": String(timestamp),
  });

  res.json({ success: true, data: { sent: event } });
});

// ============================================
// Putting it together
// ============================================

// A trustworthy webhook exchange needs all four pieces: sign every outgoing
// payload, include and verify a timestamp to reject replays, give every
// event a unique id so receivers can dedupe, and retry failed deliveries
// with backoff (receivers must be fast + idempotent since retries WILL
// happen). See ../Assignment 1 - Webhook Dispatcher/ for the full two-app
// version of this (a real dispatcher + a real receiver, running as
// separate processes).

const PORT = 4514;
app.listen(PORT, () => console.log(`Delivery retries demo running on http://localhost:${PORT}`));
