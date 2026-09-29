// Order Testing Suite - full test suite, applying all four topics
// together: mocking Stripe (topic 3), a real temp Mongo via
// mongodb-memory-server (topic 2), afterEach isolation between tests
// (topic 4), with every test here being an integration test (topic 1) -
// see ../../Notes.txt for the unit-vs-integration distinction itself.
// Run: npx jest (from this project's folder)

const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

// jest.mock("stripe") is hoisted above even the require("../app") below by
// Jest at transform time - by the time app.js's `new Stripe(...)` runs,
// "stripe" already resolves to this fake. The factory can only reference
// outer variables whose name starts with "mock" (Jest's explicit
// exception to "you can't touch a not-yet-initialized variable").
const mockPaymentIntentCreate = jest.fn().mockResolvedValue({
  id: "pi_test_123",
  client_secret: "secret_test",
});

jest.mock("stripe", () =>
  jest.fn().mockImplementation(() => ({
    paymentIntents: { create: mockPaymentIntentCreate },
  }))
);

const { createApp, Order } = require("../app");

let mongod;
let app;

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

describe("POST /orders/:id/checkout (integration + mocked Stripe)", () => {
  it("marks the order paid and calls the mocked Stripe SDK with the right amount", async () => {
    const created = await request(app).post("/orders").send({ item: "Monitor", amountCents: 20000 });
    const orderId = created.body.data._id;

    const res = await request(app).post(`/orders/${orderId}/checkout`);

    expect(res.status).toBe(200);
    expect(res.body.data.order.paid).toBe(true);
    expect(res.body.data.clientSecret).toBe("secret_test");

    expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 20000, currency: "usd" })
    );
  });

  it("404s for a checkout on an order that doesn't exist", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).post(`/orders/${fakeId}/checkout`);
    expect(res.status).toBe(404);
  });
});

describe("test isolation (afterEach clears collections between tests)", () => {
  it("starts empty even though earlier describe blocks created orders", async () => {
    const res = await request(app).get("/orders");
    expect(res.body.data).toHaveLength(0);
  });

  it("still starts empty after creating one in the previous test", async () => {
    const res = await request(app).get("/orders");
    expect(res.body.data).toHaveLength(0);
  });
});
