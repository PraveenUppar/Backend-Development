// Logging & Debugging 3 - AsyncLocalStorage Request Correlation
// Builds on 02-pino-core-api-redaction.js.
// Run: node 03-async-local-storage-correlation.js
// Then: curl -X POST http://localhost:4813/orders -H "Content-Type: application/json" -d "{\"item\":\"desk\"}"

const express = require("express");
const pino = require("pino");
const { AsyncLocalStorage } = require("node:async_hooks");
const crypto = require("crypto");

const app = express();
app.use(express.json());
const logger = pino({ transport: { target: "pino-pretty", options: { colorize: true } } });

// ============================================
// AsyncLocalStorage - request-id correlation without threading a parameter
// ============================================

// The problem: every log line produced while handling ONE request - no
// matter how deep the call stack - should carry that request's id. The
// naive fix is passing requestId as an explicit parameter into every
// function down the chain. That works but is miserable in a real codebase:
// every function needs a parameter it doesn't otherwise care about, purely
// to relay it downward, and forgetting it in one spot breaks correlation
// for that branch.
//
// AsyncLocalStorage (built into node:async_hooks) fixes this: it's a
// container bound to the current async execution context. You .run() a
// block of code with a context value, and ANY code called from inside that
// block - sync or after an await, however deep - can read the same value
// back out, with zero parameters passed.

const als = new AsyncLocalStorage();

function requestContextMiddleware(req, res, next) {
  const requestId = crypto.randomUUID();
  als.run({ requestId }, () => next()); // everything inside next() shares this context
}

function getRequestId() {
  return als.getStore()?.requestId;
}

app.use(requestContextMiddleware);

// Simulating a deeply-nested call chain, NONE of which receives requestId
// as a parameter - this is the entire point to demonstrate.
function chargeCard(order) {
  logger.info({ requestId: getRequestId(), order }, "charging card");
}
function processPayment(order) {
  chargeCard(order); // no requestId passed here...
}
function handleOrder(order) {
  processPayment(order); // ...or here...
}

app.post("/orders", (req, res) => {
  handleOrder(req.body); // ...yet chargeCard still logs the right requestId, 3 calls deep
  res.status(201).json({ success: true, data: { requestId: getRequestId() } });
});

// Each incoming request gets its own isolated store (Node tracks it per
// async execution chain), so concurrent requests never see each other's ids
// even though they're all running through the same shared functions.

const PORT = 4813;
app.listen(PORT, () => logger.info(`AsyncLocalStorage correlation demo running on http://localhost:${PORT}`));
