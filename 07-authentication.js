// Authentication - bcrypt, JWT, sessions vs tokens
// Run: node 07-authentication.js
// Then: curl -X POST http://localhost:4007/signup -H "Content-Type: application/json" -d "{\"email\":\"a@a.com\",\"password\":\"secret123\"}"

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";

// In-memory "database" for this demo
const users = [];

// ============================================
// Sessions vs tokens (read this before writing any auth code)
// ============================================

// Session-based auth: server creates a session, stores it (memory/Redis/DB),
// and sends the client a session ID in a cookie. The server must look up
// the session on every request. Easy to revoke, but doesn't scale across
// multiple servers without a shared session store.
//
// Token-based auth (JWT): server signs a token containing the user info.
// The client sends it back in a header, the server just VERIFIES the
// signature - no lookup needed. Stateless and scales easily, but a JWT
// can't be revoked before it expires (unless you add a blocklist).
//
// This file uses JWTs, the more common choice for REST APIs.

// ============================================
// Signup - hash the password, never store it plain
// ============================================

app.post("/signup", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required" });
  }
  if (users.find((u) => u.email === email)) {
    return res.status(409).json({ success: false, message: "Email already registered" });
  }

  // bcrypt.hash salts and hashes in one step. The salt rounds (10 below)
  // control how slow/expensive the hash is - higher is safer but slower.
  const passwordHash = await bcrypt.hash(password, 10);

  const user = { id: String(users.length + 1), email, passwordHash, role: "user" };
  users.push(user);

  res.status(201).json({ success: true, data: { id: user.id, email: user.email } });
});

// ============================================
// Login - compare password, issue a JWT
// ============================================

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = users.find((u) => u.email === email);

  // Same error message whether the email doesn't exist or the password is
  // wrong - don't leak which one it was, that helps attackers enumerate emails.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ success: false, message: "Invalid email or password" });
  }

  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  res.json({ success: true, data: { token } });
});

// ============================================
// Middleware to protect routes
// ============================================

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization; // "Bearer <token>"
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { sub, email, role, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

app.get("/me", requireAuth, (req, res) => {
  res.json({ success: true, data: { id: req.user.sub, email: req.user.email } });
});

// curl -H "Authorization: Bearer <token>" /me -> your own profile
// curl /me (no header)                        -> 401 No token provided

const PORT = 4007;
app.listen(PORT, () => console.log(`Auth demo running on http://localhost:${PORT}`));

module.exports = { requireAuth, JWT_SECRET }; // exported so 08-authorization-roles.js can reuse it
