// Webhook Receiver - the VERIFIER side.
// Needs: Node 18+ (crypto.timingSafeEqual)
// Run: node receiver.js
//
// This app plays the role of a "subscriber" - some other service that
// registered a URL with the dispatcher and now gets POSTed to whenever a
// matching event fires. See README.txt for the full end-to-end demo.

require("dotenv").config();
const express = require("express");
const crypto = require("crypto");

const app = express();

const SECRET = process.env.WEBHOOK_SECRET || "demo_shared_secret_change_me";
const PORT = process.env.RECEIVER_PORT || 4202;
const MAX_AGE_MS = 5 * 60 * 1000; // reject anything older than 5 minutes

// IMPORTANT: signature verification needs the EXACT raw bytes the sender
// signed, not Express's re-serialized version of a parsed JSON object
// (re-serializing can reorder keys or change whitespace, which would make
// the signature not match even for a genuinely untampered payload). So
// this route uses express.raw() instead of express.json(), same reasoning
// as the Stripe webhook route in Capstone Project.
app.use("/webhooks/incoming", express.raw({ type: "application/json" }));

// In-memory store of accepted events, and a Set of event ids we've already
// seen (for idempotency - see ../Notes.txt topic 3). Both reset on restart;
// a real receiver would use a database so dedup survives restarts and
// works across multiple receiver instances.
const receivedEvents = [];
const seenEventIds = new Set();

function verifySignature(timestamp, rawBody, receivedSignature) {
  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");
  const receivedBuf = Buffer.from(receivedSignature || "", "hex");

  // Buffers must be equal length for timingSafeEqual, or it throws - check
  // that first. The length check itself isn't a timing leak because
  // lengths aren't secret information, only the CONTENT is.
  if (expectedBuf.length !== receivedBuf.length) return false;

  // Never use `===` or Buffer.equals() naively here - timingSafeEqual takes
  // constant time regardless of where the buffers differ, so an attacker
  // can't use response-time measurements to guess the signature byte by
  // byte (a timing attack). See ../Notes.txt topic 1.
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

app.post("/webhooks/incoming", (req, res) => {
  const signature = req.headers["x-webhook-signature"];
  const timestamp = req.headers["x-webhook-timestamp"];
  const rawBody = req.body.toString("utf8"); // Buffer from express.raw()

  if (!signature || !timestamp) {
    return res
      .status(400)
      .json({ success: false, message: "Missing signature or timestamp header" });
  }

  // 1. Replay protection - reject stale requests even if the signature is
  // technically valid (an old, captured request replayed later).
  const age = Date.now() - Number(timestamp);
  if (Number.isNaN(age) || age > MAX_AGE_MS) {
    return res.status(400).json({ success: false, message: "Webhook too old, rejected" });
  }

  // 2. Signature verification - proves the payload wasn't tampered with
  // and actually came from someone who knows the shared secret.
  if (!verifySignature(timestamp, rawBody, signature)) {
    return res.status(401).json({ success: false, message: "Invalid signature" });
  }

  const event = JSON.parse(rawBody);

  // 3. Idempotency - the dispatcher may retry this exact event if our
  // previous response didn't come back as a clean 2xx. Acknowledge
  // duplicates without redoing the actual work.
  if (seenEventIds.has(event.id)) {
    console.log(`[receiver] duplicate event ${event.id}, ignoring`);
    return res.status(200).json({ success: true, message: "Already processed" });
  }
  seenEventIds.add(event.id);

  console.log(`[receiver] accepted event ${event.id} (${event.type})`);
  receivedEvents.push({ ...event, receivedAt: new Date().toISOString() });

  // This is where you'd actually DO something with the event -
  // e.g. mark an order as paid, send a confirmation email, etc.

  res.status(200).json({ success: true, message: "Event accepted" });
});

// Inspect what's been accepted so far.
app.get("/webhooks/received", (req, res) => {
  res.json({ success: true, data: receivedEvents });
});

app.listen(PORT, () =>
  console.log(`Webhook receiver running on http://localhost:${PORT}`),
);
