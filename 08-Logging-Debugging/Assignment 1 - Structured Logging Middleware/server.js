// Structured Logging Middleware demo - Pino + AsyncLocalStorage
//
// Run: npm install && node server.js
// Then watch the terminal while you:
//   curl http://localhost:5016/orders/42
//   curl -X POST http://localhost:5016/signup -H "Content-Type: application/json" -d "{\"email\":\"a@a.com\",\"password\":\"hunter2\"}"
//   curl http://localhost:5016/orders/999
//
// What to look for in the output:
// 1. Every log line for a single request - even ones logged deep inside
//    "service" functions - carries the SAME requestId, with no id parameter
//    passed into any of those functions.
// 2. The /signup log line shows the password field as "[Redacted]", even
//    though the route handler logs the entire req.body object directly.

require("dotenv").config();
const express = require("express");
const logger = require("./logger");
const { requestContextMiddleware, getRequestId } = require("./requestContext");

const app = express();
app.use(express.json());

// Every request gets its own AsyncLocalStorage store from here on down.
app.use(requestContextMiddleware);

// Basic access log - object first (structured fields), message second.
app.use((req, res, next) => {
  logger.info({ requestId: getRequestId(), method: req.method, path: req.path }, "incoming request");
  next();
});

// ============================================
// Simulated "service layer" - several calls deep, on purpose.
// NONE of these functions take a requestId parameter. They all just call
// getRequestId() when they need to log. That's the entire demo.
// ============================================

function findOrder(orderId) {
  // one level down from the route handler
  logger.debug({ requestId: getRequestId(), orderId }, "looking up order in db");
  return chargeCheck(orderId);
}

function chargeCheck(orderId) {
  // two levels down
  logger.info({ requestId: getRequestId(), orderId }, "verifying charge status");
  return auditLog(orderId);
}

function auditLog(orderId) {
  // three levels down - still has the correct requestId, still no parameter for it
  logger.info({ requestId: getRequestId(), orderId }, "writing audit trail entry");
  return { id: orderId, total: 49.99 };
}

// ============================================
// Routes
// ============================================

app.get("/orders/:id", (req, res) => {
  if (req.params.id === "999") {
    logger.warn({ requestId: getRequestId(), orderId: req.params.id }, "order not found");
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  const order = findOrder(req.params.id);
  res.json({ success: true, data: order });
});

app.post("/signup", (req, res) => {
  // Deliberately logging the WHOLE body, password and all - this is the
  // "someone forgot to scrub it" scenario. Redaction in logger.js hides the
  // password in the actual output regardless.
  logger.info({ requestId: getRequestId(), body: req.body }, "signup attempt");

  if (!req.body.email || !req.body.password) {
    return res.status(400).json({ success: false, message: "email and password required" });
  }

  res.status(201).json({ success: true, data: { email: req.body.email } });
});

app.get("/health", (req, res) => {
  res.json({ success: true, data: { status: "ok" } });
});

// Centralized error logging, same shape as 16-logging-and-debugging.js but
// through Pino - err gets serialized with its stack automatically.
app.use((err, req, res, next) => {
  logger.error({ requestId: getRequestId(), err }, "unhandled error");
  res.status(500).json({ success: false, message: "Something went wrong" });
});

const PORT = process.env.PORT || 5016;
app.listen(PORT, () => logger.info(`Structured logging demo running on http://localhost:${PORT}`));
