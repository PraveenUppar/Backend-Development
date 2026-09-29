// Webhooks 2 - Replay Protection
// Builds on 01-hmac-signing.js.
// Run: node 02-replay-protection.js
// Then:
//   TS=$(node -e "console.log(Date.now())")
//   BODY='{"id":"evt_1","type":"demo.event"}'
//   SIG=$(node -e "console.log(require('crypto').createHmac('sha256','demo-shared-secret').update(process.argv[1]+'.'+process.argv[2]).digest('hex'))" "$TS" "$BODY")
//   curl -X POST http://localhost:4512/demo/receive -H "x-webhook-timestamp: $TS" -H "x-webhook-signature: $SIG" -H "Content-Type: application/json" -d "$BODY"

const express = require("express");
const crypto = require("crypto");

const app = express();
const SECRET = "demo-shared-secret";

function sign(payloadString, secret) {
  return crypto.createHmac("sha256", secret).update(payloadString).digest("hex");
}

function verifySignature(expectedHex, receivedHex) {
  const a = Buffer.from(expectedHex, "hex");
  const b = Buffer.from(receivedHex, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ============================================
// Replay protection - timestamps
// ============================================

// A valid signature only proves the payload wasn't ALTERED - it doesn't
// prove it's FRESH. If an attacker (or a nosy network intermediary)
// captures a legitimate webhook request, they could resend that exact
// request later and it would still pass signature verification, since
// nothing about the signature depends on time.
//
// Fix: include a timestamp in the SIGNED payload (not sent as a separate
// unsigned field - otherwise an attacker could swap in a fresh timestamp on
// a captured request and slip past this check), and reject requests whose
// timestamp is too old. Stripe uses a 5 minute window.

const REPLAY_WINDOW_MS = 5 * 60 * 1000;

app.post("/demo/receive", express.raw({ type: "application/json" }), (req, res) => {
  const timestamp = req.headers["x-webhook-timestamp"];
  const receivedSignature = req.headers["x-webhook-signature"];
  const rawBody = req.body.toString();

  const expected = sign(`${timestamp}.${rawBody}`, SECRET);
  if (!verifySignature(expected, receivedSignature || "")) {
    return res.status(400).json({ success: false, message: "Invalid signature" });
  }

  const age = Date.now() - Number(timestamp);
  if (age > REPLAY_WINDOW_MS) {
    return res.status(400).json({ success: false, message: "Webhook too old (possible replay)" });
  }

  const event = JSON.parse(rawBody);
  res.json({ success: true, data: { accepted: event } });
});

const PORT = 4512;
app.listen(PORT, () => console.log(`Replay protection demo running on http://localhost:${PORT}`));
