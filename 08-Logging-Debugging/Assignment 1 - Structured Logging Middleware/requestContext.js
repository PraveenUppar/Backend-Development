// AsyncLocalStorage-based request context - lets ANY function called during
// a request read that request's id without it being passed as a parameter.
//
// The problem this solves: without this, a route handler that calls a
// service function, which calls another helper, which finally logs
// something, would need `requestId` threaded through every single one of
// those function signatures just so the deepest one can use it. Miss one
// spot and that log line loses correlation. AsyncLocalStorage keeps a store
// bound to the current async call chain - Node tracks it automatically
// across sync calls, promises, and awaits - so nested code just asks for it.

const { AsyncLocalStorage } = require("node:async_hooks");
const crypto = require("node:crypto");

const als = new AsyncLocalStorage();

// Express middleware - wraps the rest of the request pipeline in als.run()
// so everything downstream (other middleware, the route handler, and any
// service/helper functions they call) shares this one store.
function requestContextMiddleware(req, res, next) {
  const requestId = crypto.randomUUID();
  const store = { requestId };

  res.setHeader("X-Request-Id", requestId); // handy for the client too

  als.run(store, () => next());
}

// Any module, anywhere, can call this to get the current request's id -
// no parameter passing, no import of req/res, nothing threaded through.
// Returns undefined if called outside a request (e.g. at startup).
function getRequestId() {
  return als.getStore()?.requestId;
}

module.exports = { requestContextMiddleware, getRequestId };
