// Error Handling in Express
// Run: node 02-error-handling.js
// Then: curl http://localhost:4002/crash

const express = require("express");
const app = express();
app.use(express.json());

// ============================================
// Custom error class
// ============================================

// A plain Error doesn't carry an HTTP status code. Extend it so every
// error thrown in the app can carry one, plus a flag for "expected" errors
// (bad input, not found) vs unexpected bugs.

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // expected, safe to show the message to the client
  }
}

class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, 404);
  }
}

// ============================================
// Sync errors - Express catches these automatically
// ============================================

app.get("/sync-error", (req, res) => {
  throw new AppError("Something went wrong synchronously", 400);
});

// ============================================
// Async errors - Express does NOT catch these by default
// ============================================

// Before Express 5, a rejected promise inside an async route handler just
// hangs the request unless you catch it yourself. The fix: wrap async
// handlers so any rejection gets forwarded to next().

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

const fakeUsers = [{ id: "1", name: "Praveen" }];

app.get("/users/:id", asyncHandler(async (req, res) => {
  // simulate an async DB lookup
  const user = await new Promise((resolve) => {
    setTimeout(() => resolve(fakeUsers.find((u) => u.id === req.params.id)), 100);
  });

  if (!user) {
    throw new NotFoundError("User");
  }

  res.json({ success: true, data: user });
}));

// GET /users/1   -> 200 { success: true, data: { id: "1", name: "Praveen" } }
// GET /users/999 -> 404 { success: false, message: "User not found" }

// ============================================
// 404 handler - for routes that don't exist at all
// ============================================

app.use((req, res, next) => {
  next(new NotFoundError("Route"));
});

// ============================================
// Centralized error middleware - must have 4 params
// ============================================

// Express recognizes an error-handling middleware ONLY if it has exactly
// 4 arguments: (err, req, res, next). It must be registered LAST, after
// every other app.use()/route.

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational || false;

  // Log full details server-side, but don't leak stack traces to clients
  // for unexpected (non-operational) errors.
  console.error(`[${statusCode}] ${err.message}`);
  if (!isOperational) console.error(err.stack);

  res.status(statusCode).json({
    success: false,
    message: isOperational ? err.message : "Internal server error",
  });
});

const PORT = 4002;
app.listen(PORT, () => console.log(`Error handling demo running on http://localhost:${PORT}`));
