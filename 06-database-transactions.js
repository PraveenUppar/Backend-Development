// Database Transactions - Mongoose sessions + SQL transactions
// Needs: MongoDB running as a replica set for transactions (or Postgres, see below)
// Run: node 06-database-transactions.js
// Then: curl -X POST http://localhost:4006/sql/transfer -H "Content-Type: application/json" -d "{\"fromId\":1,\"toId\":2,\"amount\":50}"

const express = require("express");
const mongoose = require("mongoose");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

// ============================================
// Why transactions?
// ============================================

// A "transfer money" or "checkout" action is really MULTIPLE writes that
// must all succeed or all fail together. If you debit one account and the
// server crashes before crediting the other, you've silently lost money.
// A transaction guarantees all-or-nothing (atomicity).

// ============================================
// SQL transactions with pg (this part is the easiest to actually run)
// ============================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/postgres",
});

async function setup() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      balance INTEGER NOT NULL DEFAULT 0
    );
  `);
}
setup();

app.post("/sql/transfer", async (req, res) => {
  const { fromId, toId, amount } = req.body;

  // A transaction needs a single dedicated client, not the shared pool,
  // because BEGIN/COMMIT must run on the same connection as the queries.
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const from = await client.query("SELECT balance FROM accounts WHERE id = $1 FOR UPDATE", [fromId]);
    if (from.rows.length === 0 || from.rows[0].balance < amount) {
      throw new Error("Insufficient balance");
    }

    await client.query("UPDATE accounts SET balance = balance - $1 WHERE id = $2", [amount, fromId]);
    await client.query("UPDATE accounts SET balance = balance + $1 WHERE id = $2", [amount, toId]);

    await client.query("COMMIT");
    res.json({ success: true, data: { fromId, toId, amount } });
  } catch (err) {
    await client.query("ROLLBACK"); // undo every write since BEGIN
    res.status(400).json({ success: false, message: err.message });
  } finally {
    client.release(); // always give the connection back to the pool
  }
});

// FOR UPDATE above locks the row so two simultaneous transfers from the
// same account can't both read the same starting balance (a race condition).

// ============================================
// Mongoose transactions (needs MongoDB running as a replica set)
// ============================================

// Standalone MongoDB (the default `docker run mongo`) does NOT support
// transactions - only replica sets do. Mongoose's syntax below is correct
// and is exactly what you'd use once connected to a replica set/Atlas.

const orderSchema = new mongoose.Schema({ product: String, qty: Number });
const inventorySchema = new mongoose.Schema({ product: String, stock: Number });
const Order = mongoose.model("Order", orderSchema);
const Inventory = mongoose.model("Inventory", inventorySchema);

async function placeOrder(product, qty) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const inventory = await Inventory.findOne({ product }).session(session);
    if (!inventory || inventory.stock < qty) {
      throw new Error("Not enough stock");
    }

    inventory.stock -= qty;
    await inventory.save({ session });

    const [order] = await Order.create([{ product, qty }], { session });

    await session.commitTransaction();
    return order;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

app.post("/mongo/orders", async (req, res) => {
  try {
    const order = await placeOrder(req.body.product, req.body.qty);
    res.status(201).json({ success: true, data: order });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

const PORT = 4006;
app.listen(PORT, () => console.log(`Transactions demo running on http://localhost:${PORT}`));
