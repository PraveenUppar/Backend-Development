// Authorization & Roles - role-based middleware
// Run: node 08-authorization-roles.js
// Then: curl -X POST http://localhost:4008/login -d "{\"email\":\"admin@a.com\"}" -H "Content-Type: application/json"

const express = require("express");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

// ============================================
// Authentication vs authorization
// ============================================

// Authentication: WHO are you? (verified by requireAuth / JWT in the last file)
// Authorization:  WHAT are you allowed to do? (this file)
// A logged-in user is authenticated. Whether they can DELETE another
// user's post is an authorization question.

const users = [
  { id: "1", email: "admin@a.com", role: "admin" },
  { id: "2", email: "editor@a.com", role: "editor" },
  { id: "3", email: "user@a.com", role: "user" },
];

// Demo login that skips password checking, just to get a token per role
app.post("/login", (req, res) => {
  const user = users.find((u) => u.email === req.body.email);
  if (!user)
    return res.status(401).json({ success: false, message: "Unknown user" });
  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: "1h",
  });
  res.json({ success: true, data: { token, role: user.role } });
});

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token)
    return res
      .status(401)
      .json({ success: false, message: "No token provided" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res
      .status(401)
      .json({ success: false, message: "Invalid or expired token" });
  }
}

// ============================================
// requireRole - a middleware FACTORY (returns a middleware)
// ============================================

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ success: false, message: "Forbidden: insufficient role" });
    }
    next();
  };
}

// 401 = "I don't know who you are" (authentication failed)
// 403 = "I know who you are, but you can't do this" (authorization failed)

// ============================================
// Using it - stack requireAuth then requireRole
// ============================================

app.get("/admin/dashboard", requireAuth, requireRole("admin"), (req, res) => {
  res.json({ success: true, data: "Welcome, admin" });
});

app.post("/posts", requireAuth, requireRole("admin", "editor"), (req, res) => {
  res.status(201).json({ success: true, data: "Post created" });
});

app.get("/profile", requireAuth, (req, res) => {
  // any authenticated user, no role restriction
  res.json({
    success: true,
    data: { userId: req.user.sub, role: req.user.role },
  });
});

// ============================================
// Ownership checks - a role isn't always enough
// ============================================

// Sometimes authorization isn't about role, it's about OWNERSHIP: a "user"
// should be able to edit THEIR OWN post but not someone else's.

const posts = [{ id: "1", authorId: "3", title: "My post" }];

function requireOwnerOrAdmin(req, res, next) {
  const post = posts.find((p) => p.id === req.params.id);
  if (!post)
    return res.status(404).json({ success: false, message: "Post not found" });

  const isOwner = post.authorId === req.user.id;
  const isAdmin = req.user.role === "admin";

  if (!isOwner && !isAdmin) {
    return res
      .status(403)
      .json({ success: false, message: "You don't own this post" });
  }
  req.post = post;
  next();
}

app.patch("/posts/:id", requireAuth, requireOwnerOrAdmin, (req, res) => {
  res.json({ success: true, data: req.post });
});

const PORT = 4008;
app.listen(PORT, () =>
  console.log(`Authorization demo running on http://localhost:${PORT}`),
);
