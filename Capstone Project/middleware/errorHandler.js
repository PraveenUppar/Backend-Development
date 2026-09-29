class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function notFoundHandler(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

function errorMiddleware(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  if (!err.isOperational) {
    console.error(err.stack);
  }
  res.status(statusCode).json({
    success: false,
    message: err.isOperational ? err.message : "Internal server error",
  });
}

module.exports = { AppError, asyncHandler, notFoundHandler, errorMiddleware };
