// Practice 1: Signing a Multi-Field Payload + Header Placement (topic 01)
// Run: node practice/practice1.js
// Then: curl -X POST http://localhost:4521/webhooks/github-style -H "Content-Type: application/json" -d "{\"action\":\"opened\",\"number\":42}"

const express = require("express");
const crypto = require("crypto");

const app = express();
const SECRET = "practice-secret";

// Exercise: GitHub-style webhooks send the signature as a header formatted
// "sha256=<hex>", not a bare hex string. Build the sender side of that
// convention and a verifier that handles the prefix.

function sign(payloadString, secret) {
  return "sha256=" + crypto.createHmac("sha256", secret).update(payloadString).digest("hex");
}

function verify(payloadString, secret, headerValue) {
  const expected = sign(payloadString, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(headerValue || "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

app.post("/webhooks/github-style", express.json(), (req, res) => {
  const body = JSON.stringify(req.body);
  const signatureHeader = sign(body, SECRET);

  // Simulate what a receiver would do with this exact header value.
  const valid = verify(body, SECRET, signatureHeader);

  res.json({ success: true, data: { signatureHeader, wouldVerifyAs: valid } });
});

const PORT = 4521;
app.listen(PORT, () => console.log(`Practice 1 running on http://localhost:${PORT}`));
