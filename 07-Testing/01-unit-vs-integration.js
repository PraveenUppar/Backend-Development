// Testing 1 - Unit vs Integration
// ../15-testing-apis.js already covers the createApp() factory pattern,
// supertest firing real HTTP requests in-process, and basic status/body
// assertions. This picks up where that one stops.
// Run: npx jest 01-unit-vs-integration.js
// Needs: jest, supertest

const express = require("express");
const request = require("supertest");

// ============================================
// Unit vs integration - this file shows one of each, side by side
// ============================================

// Rule of thumb: if deleting the database and hand-writing a fake in its
// place would still let the test pass, it's a unit test. If the test only
// passes because something is genuinely talking to a real server, it's an
// integration test.

// ---- The pure function under test - no I/O, no Express, no database ----
function calculateOrderTotal(items) {
  return items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
}

describe("calculateOrderTotal (unit - pure function, no I/O)", () => {
  it("sums price * quantity across items", () => {
    const total = calculateOrderTotal([
      { priceCents: 500, quantity: 2 },
      { priceCents: 1000, quantity: 1 },
    ]);
    expect(total).toBe(2000);
  });

  it("returns 0 for an empty cart", () => {
    expect(calculateOrderTotal([])).toBe(0);
  });
});

// This test runs in microseconds, needs no setup/teardown, and would still
// pass if you deleted every database and API in the project - it's testing
// LOGIC, nothing else. That's what makes it a unit test.

// ---- The app under test - a tiny in-memory (no real DB yet) API ----
function createApp() {
  const app = express();
  app.use(express.json());
  const orders = [];

  app.post("/orders", (req, res) => {
    const total = calculateOrderTotal(req.body.items || []);
    const order = { id: orders.length + 1, items: req.body.items, total };
    orders.push(order);
    res.status(201).json({ success: true, data: order });
  });

  return app;
}

describe("POST /orders (integration - real HTTP request through a real Express app)", () => {
  it("computes and returns the total for the submitted items", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/orders")
      .send({ items: [{ priceCents: 500, quantity: 2 }] });

    expect(res.status).toBe(201);
    expect(res.body.data.total).toBe(1000);
  });
});

// This test goes through express.json() body parsing, real routing, and a
// real (in-memory) HTTP round trip via supertest - more moving parts than
// the unit test above, even though there's no real database yet (that's
// 02-mongodb-memory-server.js's job). It's still meaningfully "more
// integrated" than the pure-function test: a routing mistake or a
// middleware ordering bug would show up here but NOT in the unit test.
