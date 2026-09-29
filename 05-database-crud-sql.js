// Database CRUD with raw SQL (Postgres, no ORM)
// Needs: Postgres running (docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres)
// Run: node 05-database-crud-sql.js
// Then: curl -X POST http://localhost:4005/tasks -H "Content-Type: application/json" -d "{\"title\":\"Learn SQL\"}"

const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/postgres",
});

// ============================================
// Setting up tables (normally a migration, kept inline here for a self-contained demo)
// ============================================

async function setup() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      done BOOLEAN DEFAULT false,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log("Tables ready");
}
setup();

// ============================================
// Create - ALWAYS use parameterized queries ($1, $2), never string concat
// ============================================

// pool.query("... WHERE id = " + req.params.id) is a SQL injection hole.
// pool.query("... WHERE id = $1", [req.params.id]) lets pg escape it safely.

app.post("/tasks", async (req, res) => {
  const { title, userId } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO tasks (title, user_id) VALUES ($1, $2) RETURNING *",
      [title, userId || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ============================================
// Read - list with a JOIN (the "relationship" part)
// ============================================

app.get("/tasks", async (req, res) => {
  const result = await pool.query(`
    SELECT tasks.*, users.name AS owner_name
    FROM tasks
    LEFT JOIN users ON tasks.user_id = users.id
    ORDER BY tasks.created_at DESC
  `);
  res.json({ success: true, data: result.rows });
});

app.get("/tasks/:id", async (req, res) => {
  const result = await pool.query("SELECT * FROM tasks WHERE id = $1", [req.params.id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: "Task not found" });
  }
  res.json({ success: true, data: result.rows[0] });
});

// ============================================
// Update
// ============================================

app.patch("/tasks/:id", async (req, res) => {
  const { title, done } = req.body;
  const result = await pool.query(
    `UPDATE tasks SET title = COALESCE($1, title), done = COALESCE($2, done) WHERE id = $3 RETURNING *`,
    [title, done, req.params.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: "Task not found" });
  }
  res.json({ success: true, data: result.rows[0] });
});

// ============================================
// Delete
// ============================================

app.delete("/tasks/:id", async (req, res) => {
  const result = await pool.query("DELETE FROM tasks WHERE id = $1 RETURNING id", [req.params.id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: "Task not found" });
  }
  res.json({ success: true, data: null });
});

const PORT = 4005;
app.listen(PORT, () => console.log(`SQL CRUD demo running on http://localhost:${PORT}`));
