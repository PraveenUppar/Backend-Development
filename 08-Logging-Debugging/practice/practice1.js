// Practice 1: Redacting a New Field + Nested Path (topic 02)
// Run: node practice/practice1.js
// Then: curl -X POST http://localhost:4821/payment-methods -H "Content-Type: application/json" -d "{\"cardNumber\":\"4242424242424242\",\"billing\":{\"ssn\":\"123-45-6789\"}}"

const express = require("express");
const pino = require("pino");

const app = express();
app.use(express.json());

// Exercise: redact a top-level field AND a nested one that a wildcard
// path wouldn't reach (billing.ssn specifically, not every "ssn" anywhere
// - a wildcard would also hide an unrelated field named ssn elsewhere).

const logger = pino({
  redact: {
    paths: ["cardNumber", "billing.ssn"],
    censor: "[REDACTED]",
  },
  transport: { target: "pino-pretty", options: { colorize: true } },
});

app.post("/payment-methods", (req, res) => {
  logger.info({ ...req.body }, "payment method submitted");
  res.status(201).json({ success: true, data: "received" });
});

// Expected log output: cardNumber and billing.ssn both show "[REDACTED]",
// everything else in the body logs normally.

const PORT = 4821;
app.listen(PORT, () => logger.info(`Practice 1 running on http://localhost:${PORT}`));
