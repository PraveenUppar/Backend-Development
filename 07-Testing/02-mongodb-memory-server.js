// Testing 2 - mongodb-memory-server
// Builds on 01-unit-vs-integration.js.
// Run: npx jest 02-mongodb-memory-server.js
// Needs: jest, supertest, mongoose, mongodb-memory-server

const express = require("express");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

// ============================================
// mongodb-memory-server - a real Mongo, no Docker required
// ============================================

// Real database, temporary process: mongodb-memory-server downloads an
// actual `mongod` binary once, then boots a real (if disposable) MongoDB
// on a random free port per test run. It's the real database engine, not
// a mock or a JS reimplementation - real Mongoose validation, real
// indexes, and (if you opt into a MongoMemoryReplSet) real multi-document
// transactions all behave exactly like they would in production.

const orderSchema = new mongoose.Schema({
  item: { type: String, required: true },
  amountCents: { type: Number, required: true },
});
const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);

function createApp() {
  const app = express();
  app.use(express.json());

  app.post("/orders", async (req, res) => {
    if (!req.body.item || !req.body.amountCents) {
      return res.status(400).json({ success: false, message: "item and amountCents are required" });
    }
    const order = await Order.create({ item: req.body.item, amountCents: req.body.amountCents });
    res.status(201).json({ success: true, data: order });
  });

  return app;
}

let mongod;
let app;

// beforeAll runs ONCE before any test below - starting mongod costs real
// wall-clock time (booting the binary, sometimes downloading it first), so
// you pay that cost once and reuse the same instance for every test in
// this file, not once per test.
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = createApp();
}, 60000); // generous timeout - the default 5s is too tight for a first-time binary download

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

afterEach(async () => {
  await Order.deleteMany({});
});

describe("POST /orders (integration - real Express route + real temp Mongo)", () => {
  it("persists the order in the database, not just in the response", async () => {
    const res = await request(app).post("/orders").send({ item: "Keyboard", amountCents: 4500 });

    expect(res.status).toBe(201);
    expect(res.body.data.item).toBe("Keyboard");

    const stored = await Order.findById(res.body.data._id);
    expect(stored).not.toBeNull();
    expect(stored.amountCents).toBe(4500);
  });

  it("rejects a missing amountCents with 400", async () => {
    const res = await request(app).post("/orders").send({ item: "Mouse" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
