// Logging & Debugging a Backend - console patterns, morgan, monitoring mindset
// Run: node 16-logging-and-debugging.js
// Then: curl http://localhost:4016/orders/1 and watch the terminal

const express = require("express");
const morgan = require("morgan");

const app = express();
app.use(express.json());

// ============================================
// Why console.log isn't enough for a real backend
// ============================================

// In dev, console.log is fine. In production, you need logs that are:
// - timestamped (when did this happen?)
// - leveled (is this a debug detail or a real error?)
// - structured (so log tools like Datadog/CloudWatch can search/filter them)
// - request-scoped (which request caused this log line?)

// ============================================
// morgan - HTTP request logging middleware
// ============================================

// Logs every incoming request automatically: method, path, status, response time.
app.use(morgan("dev"));
// dev format example: GET /orders/1 200 3.421 ms - 45

// A custom format for production (closer to the standard "combined" log format):
// app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// ============================================
// A tiny leveled logger (the idea behind winston/pino, simplified)
// ============================================

const logger = {
  info: (msg, meta = {}) =>
    console.log(
      JSON.stringify({
        level: "info",
        msg,
        ...meta,
        time: new Date().toISOString(),
      }),
    ),
  warn: (msg, meta = {}) =>
    console.warn(
      JSON.stringify({
        level: "warn",
        msg,
        ...meta,
        time: new Date().toISOString(),
      }),
    ),
  error: (msg, meta = {}) =>
    console.error(
      JSON.stringify({
        level: "error",
        msg,
        ...meta,
        time: new Date().toISOString(),
      }),
    ),
};

// In a real project, swap this object for the `winston` or `pino` package -
// same idea (leveled, structured logs), but with file transports, log
// rotation, and integrations with log aggregation services built in.

// ============================================
// Request-scoped logging - tagging every log line from one request
// ============================================

let requestCounter = 0;

app.use((req, res, next) => {
  req.requestId = `req_${++requestCounter}`;
  logger.info("Incoming request", {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
  });
  next();
});

app.get("/orders/:id", (req, res) => {
  logger.info("Fetching order", {
    requestId: req.requestId,
    orderId: req.params.id,
  });

  if (req.params.id === "999") {
    logger.warn("Order not found", {
      requestId: req.requestId,
      orderId: req.params.id,
    });
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  res.json({ success: true, data: { id: req.params.id, total: 49.99 } });
});

const PORT = 4016;
app.listen(PORT, () =>
  console.log(`Logging demo running on http://localhost:${PORT}`),
);
