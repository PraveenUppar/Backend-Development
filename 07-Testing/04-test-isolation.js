// Testing 4 - Test Isolation Between Tests
// Builds on 03-mocking-external-sdk.js.
// Run: npx jest 04-test-isolation.js
// Needs: jest, supertest, mongoose, mongodb-memory-server

const express = require("express");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

const orderSchema = new mongoose.Schema({ item: String });
const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);

function createApp() {
  const app = express();
  app.use(express.json());
  app.post("/orders", async (req, res) => {
    const order = await Order.create({ item: req.body.item });
    res.status(201).json({ success: true, data: order });
  });
  app.get("/orders", async (req, res) => {
    res.json({ success: true, data: await Order.find() });
  });
  return app;
}

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = createApp();
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

// ============================================
// Test isolation between tests - afterEach, not afterAll
// ============================================

// Every test below shares the SAME in-memory MongoDB (started once above)
// for speed - restarting Mongo per test would be correct but slow. Without
// cleanup, a document created in one test would still be sitting there
// when the next test runs, silently changing counts and query results out
// from under it. Clearing after EACH test (not just once at the end) means
// a failed test doesn't leave garbage for the NEXT test to trip over, and
// unlike a beforeEach-only strategy, the DB still reflects exactly what
// the most recent test left behind if you need to debug it.
afterEach(async () => {
  await Order.deleteMany({});
});

describe("test isolation (afterEach clears collections between tests)", () => {
  it("creates an order visible in this test", async () => {
    await request(app).post("/orders").send({ item: "Keyboard" });
    const res = await request(app).get("/orders");
    expect(res.body.data).toHaveLength(1);
  });

  it("starts empty even though the previous test created an order", async () => {
    // If afterEach above weren't wiping the Order collection, this would
    // see the "Keyboard" order created by the test above it.
    const res = await request(app).get("/orders");
    expect(res.body.data).toHaveLength(0);
  });
});
