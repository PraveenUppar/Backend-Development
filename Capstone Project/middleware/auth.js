const jwt = require("jsonwebtoken");
const { AppError } = require("./errorHandler");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return next(new AppError("No token provided", 401));

  try {
    req.user = jwt.verify(token, JWT_SECRET); // { sub, role, iat, exp }
    next();
  } catch {
    next(new AppError("Invalid or expired token", 401));
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError("Not authenticated", 401));
    if (!roles.includes(req.user.role)) return next(new AppError("Forbidden: insufficient role", 403));
    next();
  };
}

module.exports = { requireAuth, requireRole, JWT_SECRET };
