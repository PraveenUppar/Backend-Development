Assignment 1 - Structured Logging Middleware
================================================

You've now seen the two code pieces: Pino's core API with redaction, and
AsyncLocalStorage request correlation. This assignment combines both into
one app, with a simulated multi-level service call chain so the
correlation claim isn't just theoretical.

Description
-----------
Pino + AsyncLocalStorage demo, split into three files: logger.js (Pino
configured once - level, redaction, dev-only pretty-printing),
requestContext.js (the AsyncLocalStorage middleware + getRequestId()),
and server.js (routes plus a fake 3-level-deep "service layer":
findOrder -> chargeCheck -> auditLog, none of which take a requestId
parameter).

Setup: npm install, then node server.js. Then:
  curl http://localhost:5016/orders/42
  curl -X POST http://localhost:5016/signup -H "Content-Type: application/json" -d "{\"email\":\"a@a.com\",\"password\":\"hunter2\"}"
  curl http://localhost:5016/orders/999

What to look for in the output
--------------------------------
1. Every log line for a single request - even ones logged deep inside
   "service" functions - carries the SAME requestId, with no id parameter
   passed into any of those functions.
2. The /signup log line shows the password field as "[Redacted]", even
   though the route handler logs the entire req.body object directly.

Requirements (all implemented in logger.js / requestContext.js / server.js)
-------------------------------------------------------------------------------
- Pino's level and redact config live ONLY in logger.js - every other
  file just calls logger.info/warn/error and never configures behavior
  itself.
- requestContextMiddleware must run before any other middleware/route
  that calls getRequestId(), and must also set an X-Request-Id response
  header so the client can correlate its own logs with the server's.
- findOrder -> chargeCheck -> auditLog must NOT take a requestId
  parameter at any level - each calls getRequestId() itself.
- The centralized error handler logs the error with the requestId
  attached before responding, so a 500 in the logs can be traced back to
  the exact request that caused it.

Bonus (not yet implemented - extend the project with these)
--------------------------------------------------------------
- Add a userId to the AsyncLocalStorage store (populated once you have
  real auth) alongside requestId, so every log line during an
  authenticated request carries both without either being passed as a
  parameter.
- Add a second redact path for a field this project doesn't cover yet
  (e.g. req.body.creditCard) and verify with a request that it's hidden
  in the output, following practice/practice1.js's pattern.
- Wire LOG_LEVEL to actually change behavior at runtime: start the server
  with LOG_LEVEL=warn and confirm the "looking up order in db" debug line
  disappears without touching any code.
