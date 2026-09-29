// Same AppError / asyncHandler / centralized error middleware pattern used
// throughout the topic files (see ../../02-error-handling.js). Only the
// REST side of this app (GET /rooms, GET /rooms/:name/messages) needs it -
// Socket.io errors are handled with their own "error" event instead.

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

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational || false;

  console.error(`[${statusCode}] ${err.message}`);
  if (!isOperational) console.error(err.stack);

  res.status(statusCode).json({
    success: false,
    message: isOperational ? err.message : "Internal server error",
  });
}

module.exports = { AppError, NotFoundError, asyncHandler, errorHandler };
