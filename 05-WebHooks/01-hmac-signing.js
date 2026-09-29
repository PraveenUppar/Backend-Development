// Webhooks 1 - HMAC Signing
// There's no root file to build on for this topic - see ../Notes.txt for
// why (the only prior webhook code is the Stripe receiver in Capstone
// Project, which uses a library to do this for you).
// Run: node 01-hmac-signing.js
// Then: curl -X POST http://localhost:4511/demo/sign -H "Content-Type: application/json" -d "{\"orderId\":123}"

const express = require("express");
const crypto = require("crypto");

const app = express();
const SECRET = "demo-shared-secret";

// ============================================
// HMAC signing - proving the payload wasn't tampered with
// ============================================

// Anyone can POST JSON to your receiver URL pretending to be the real
// sender. HMAC signing fixes this: sender and receiver share a secret
// (never sent over the wire). The sender computes a hash of the payload
// USING that secret; the receiver recomputes the same hash and checks it matches.

function sign(payloadString, secret) {
  return crypto.createHmac("sha256", secret).update(payloadString).digest("hex");
}

app.post("/demo/sign", express.json(), (req, res) => {
  const body = JSON.stringify(req.body);
  const signature = sign(body, SECRET);
  res.json({ success: true, data: { body, signature } });
});

// Why this proves integrity: an attacker without the secret can't produce a
// signature that matches a payload they've altered - they can't compute what
// the HMAC would be. Even changing one byte of the payload completely
// changes the resulting hash.

// IMPORTANT - never compare signatures with `===`. String equality in JS
// short-circuits at the first mismatched character, so the comparison takes
// very slightly less time the earlier the strings differ - an attacker who
// can send many requests and measure response time could in theory use that
// to guess the correct signature one byte at a time (a timing attack). Use
// crypto.timingSafeEqual instead, which always takes the same time
// regardless of where the strings differ.

function verifySignature(expectedHex, receivedHex) {
  const a = Buffer.from(expectedHex, "hex");
  const b = Buffer.from(receivedHex, "hex");
  // length check first is fine and NOT a timing leak - lengths aren't
  // secret, timingSafeEqual just throws if lengths differ.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

app.post("/demo/verify", express.json(), (req, res) => {
  const { body, signature } = req.body;
  const expected = sign(JSON.stringify(body), SECRET);
  const valid = verifySignature(expected, signature || "");
  res.json({ success: true, data: { valid } });
});

// This is exactly what Stripe's constructEvent does internally - not a
// different mechanism, just a helper wrapping the same HMAC +
// timing-safe-compare idea.

const PORT = 4511;
app.listen(PORT, () => console.log(`HMAC signing demo running on http://localhost:${PORT}`));
