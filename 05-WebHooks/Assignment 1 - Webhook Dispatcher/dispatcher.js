// Webhook Dispatcher - the SENDER side.
// Needs: Node 18+ (uses global fetch and crypto.randomUUID)
// Run: node dispatcher.js
//
// Try it (after receiver.js is also running - see README.txt):
//   curl -X POST http://localhost:4201/webhooks/register -H "Content-Type: application/json" \
//     -d "{\"url\":\"http://localhost:4202/webhooks/incoming\",\"eventType\":\"order.paid\"}"
//
//   curl -X POST http://localhost:4201/webhooks/trigger-demo-event

require("dotenv").config();
const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const SECRET = process.env.WEBHOOK_SECRET || "demo_shared_secret_change_me";
const PORT = process.env.DISPATCHER_PORT || 4201;

// ============================================
// Subscriber registry - who wants to hear about which event types
// ============================================

// In a real system this would live in a database (one row per subscriber
// per event type, plus their own secret, delivery history, etc). An array
// in memory is fine for a demo - it resets whenever the process restarts.
const subscriptions = []; // { url, eventType }

app.post("/webhooks/register", (req, res) => {
  const { url, eventType } = req.body;

  if (!url || !eventType) {
    return res
      .status(400)
      .json({ success: false, message: "url and eventType are required" });
  }

  subscriptions.push({ url, eventType });
  res.status(201).json({ success: true, data: { url, eventType } });
});

// ============================================
// Signing - HMAC-SHA256 over "timestamp.body" (see ../Notes.txt topics 1 & 2
// for why the timestamp is INSIDE the signed string, not sent alongside
// unsigned)
// ============================================

function sign(timestamp, bodyString, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${bodyString}`)
    .digest("hex");
}

// ============================================
// Delivery with retry + exponential backoff (see ../Notes.txt topic 4)
// ============================================

async function deliverWithRetry(url, bodyString, headers, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: bodyString,
      });

      if (response.ok) {
        console.log(`[dispatcher] delivered to ${url} (attempt ${attempt})`);
        return true;
      }

      throw new Error(`Received ${response.status} from receiver`);
    } catch (err) {
      console.error(
        `[dispatcher] attempt ${attempt}/${maxAttempts} to ${url} failed: ${err.message}`,
      );

      if (attempt === maxAttempts) {
        console.error(`[dispatcher] giving up on ${url} after ${maxAttempts} attempts`);
        return false;
      }

      const delay = 2 ** attempt * 1000; // 2s, then 4s, then (if maxAttempts were higher) 8s...
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// ============================================
// fireEvent - build the envelope, sign it, deliver to every matching subscriber
// ============================================

async function fireEvent(eventType, payload) {
  const envelope = {
    id: crypto.randomUUID(), // unique event id - this is what lets receivers dedupe
    type: eventType,
    payload,
    timestamp: Date.now(),
  };

  const bodyString = JSON.stringify(envelope);
  const signature = sign(envelope.timestamp, bodyString, SECRET);

  const headers = {
    "Content-Type": "application/json",
    "X-Webhook-Signature": signature,
    "X-Webhook-Timestamp": String(envelope.timestamp),
  };

  const matching = subscriptions.filter((s) => s.eventType === eventType);

  if (matching.length === 0) {
    console.log(`[dispatcher] no subscribers for "${eventType}"`);
    return;
  }

  console.log(
    `[dispatcher] firing "${eventType}" (event ${envelope.id}) to ${matching.length} subscriber(s)`,
  );

  // Deliver to all subscribers in parallel - one slow/dead subscriber
  // shouldn't delay delivery to the others.
  await Promise.all(
    matching.map((sub) => deliverWithRetry(sub.url, bodyString, headers)),
  );
}

// ============================================
// Demo trigger route - fires a fake "order.paid" event so you can watch
// the whole flow with one curl command
// ============================================

app.post("/webhooks/trigger-demo-event", async (req, res) => {
  const payload = {
    orderId: "order_" + Math.floor(Math.random() * 100000),
    amount: 4999,
    currency: "usd",
  };

  await fireEvent("order.paid", payload);

  res.json({ success: true, message: "order.paid event fired", data: payload });
});

app.listen(PORT, () =>
  console.log(`Webhook dispatcher running on http://localhost:${PORT}`),
);

module.exports = { fireEvent };
