// Prisma ORM - schema-first models, migrations, type-safe queries
// Needs: Postgres running, DATABASE_URL set, and the schema below migrated first
// Setup (one time):
//   npm install prisma @prisma/client
//   npx prisma migrate dev --name init      (reads prisma/schema.prisma, creates tables + generates the client)
// Run: node 17-prisma-orm.js
// Then: curl -X POST http://localhost:4017/users -H "Content-Type: application/json" -d "{\"name\":\"Praveen\",\"email\":\"p@a.com\"}"

const express = require("express");
const { PrismaClient } = require("@prisma/client");

const app = express();
app.use(express.json());

const prisma = new PrismaClient();

// ============================================
// Why an ORM, after already learning raw SQL (05) and Mongoose (04)?
// ============================================

// Raw SQL (05-database-crud-sql.js) gives full control but no safety net -
// typos in column names or a bad JOIN only show up at runtime. Prisma
// generates a fully-typed client FROM your schema.prisma file, so
// `prisma.user.findMany()` and its return shape are checked before you
// even run the code (huge in TypeScript, still useful for autocomplete
// and catching typos in plain JS). The tradeoff: you're now coupled to
// Prisma's query API and its migration system instead of plain SQL.

// The schema this file uses is in prisma/schema.prisma, right next to it -
// a User model with many Posts, mirroring the relationship you already
// built with raw SQL joins and Mongoose populate().

// ============================================
// Create
// ============================================

app.post("/users", async (req, res) => {
  try {
    const user = await prisma.user.create({ data: req.body });
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    // Prisma throws a structured error with a `code` for known DB constraint
    // violations - P2002 is "unique constraint failed" (duplicate email here).
    if (err.code === "P2002") {
      return res.status(409).json({ success: false, message: "Email already exists" });
    }
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post("/posts", async (req, res) => {
  const { title, body, authorId } = req.body;
  const post = await prisma.post.create({ data: { title, body, authorId } });
  res.status(201).json({ success: true, data: post });
});

// ============================================
// Read - filtering, sorting, and relations (the Mongoose .populate() equivalent is `include`)
// ============================================

app.get("/posts", async (req, res) => {
  const posts = await prisma.post.findMany({
    where: req.query.published ? { published: req.query.published === "true" } : undefined,
    orderBy: { createdAt: "desc" },
    include: { author: { select: { id: true, name: true, email: true } } },
  });
  res.json({ success: true, data: posts });
});

app.get("/users/:id", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: Number(req.params.id) },
    include: { posts: true }, // the reverse relation, similar to a JOIN
  });
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  res.json({ success: true, data: user });
});

// ============================================
// Update
// ============================================

app.patch("/posts/:id", async (req, res) => {
  try {
    const post = await prisma.post.update({
      where: { id: Number(req.params.id) },
      data: req.body,
    });
    res.json({ success: true, data: post });
  } catch (err) {
    // P2025 = "record to update not found"
    if (err.code === "P2025") return res.status(404).json({ success: false, message: "Post not found" });
    res.status(400).json({ success: false, message: err.message });
  }
});

// ============================================
// Delete
// ============================================

app.delete("/posts/:id", async (req, res) => {
  try {
    await prisma.post.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true, data: null });
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ success: false, message: "Post not found" });
    res.status(400).json({ success: false, message: err.message });
  }
});

// ============================================
// Transactions - the Prisma equivalent of 06-database-transactions.js
// ============================================

// prisma.$transaction runs everything inside atomically - either every
// query succeeds or none of them are applied. Compare this to the manual
// BEGIN/COMMIT/ROLLBACK from the raw SQL transactions file - same
// guarantee, much less boilerplate.

app.post("/users/:id/publish-all-drafts", async (req, res) => {
  const authorId = Number(req.params.id);

  const result = await prisma.$transaction(async (tx) => {
    const drafts = await tx.post.findMany({ where: { authorId, published: false } });
    await tx.post.updateMany({ where: { authorId, published: false }, data: { published: true } });
    return drafts.length;
  });

  res.json({ success: true, data: { publishedCount: result } });
});

// ============================================
// Raw SQL vs Mongoose vs Prisma - when to reach for which
// ============================================

// - Raw SQL (pg):  maximum control, no abstraction to fight, but you own
//   every query string and every mapping back to JS objects by hand.
// - Mongoose:       best when your data is naturally document-shaped
//   (nested, flexible schema) and you're on MongoDB.
// - Prisma:         best on a relational DB when you want type safety and
//   less boilerplate than raw SQL, and you're fine adopting its migration
//   workflow (prisma/schema.prisma as the source of truth for your schema).

const PORT = 4017;
app.listen(PORT, () => console.log(`Prisma demo running on http://localhost:${PORT}`));
