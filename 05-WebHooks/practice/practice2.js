// Practice 2: A Stricter Replay Window with Clock-Skew Tolerance (topic 02)
// Run: node practice/practice2.js
// Then: curl -X POST http://localhost:4522/demo/receive -H "x-webhook-timestamp: <now-ms>" -H "x-webhook-signature: <sig>" -H "Content-Type: application/json" -d "{\"id\":\"evt_1\"}"

const express = require("express");
const crypto = require("crypto");

const app = express();
const SECRET = "practice-secret";

function sign(payloadString, secret) {
  return crypto.createHmac("sha256", secret).update(payloadString).digest("hex");
}

function verifySignature(expectedHex, receivedHex) {
  const a = Buffer.from(expectedHex, "hex");
  const b = Buffer.from(receivedHex, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Exercise: 02-replay-protection.js only rejects requests that are too OLD.
// A request timestamped in the FUTURE is just as suspicious (clock
// tampering, or a bug) - but real clocks do drift a little between
// machines, so allow a small tolerance for that instead of rejecting
// anything even 1ms in the future.

const MAX_AGE_MS = 60_000; // stricter than the 5-minute default
const CLOCK_SKEW_TOLERANCE_MS = 5_000;

app.post("/demo/receive", express.raw({ type: "application/json" }), (req, res) => {
  const timestamp = Number(req.headers["x-webhook-timestamp"]);
  const receivedSignature = req.headers["x-webhook-signature"];
  const rawBody = req.body.toString();

  const expected = sign(`${timestamp}.${rawBody}`, SECRET);
  if (!verifySignature(expected, receivedSignature || "")) {
    return res.status(400).json({ success: false, message: "Invalid signature" });
  }

  const age = Date.now() - timestamp;
  if (age > MAX_AGE_MS) {
    return res.status(400).json({ success: false, message: "Webhook too old (possible replay)" });
  }
  if (age < -CLOCK_SKEW_TOLERANCE_MS) {
    return res.status(400).json({ success: false, message: "Webhook timestamped too far in the future" });
  }

  res.json({ success: true, data: { accepted: JSON.parse(rawBody) } });
});

const PORT = 4522;
app.listen(PORT, () => console.log(`Practice 2 running on http://localhost:${PORT}`));
