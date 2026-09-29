// Practice 3: Mocking a Second SDK Method + Its Failure Path (topic 03)
// Run: npx jest practice/practice3.js
// Needs: jest, supertest, stripe

const express = require("express");
const Stripe = require("stripe");
const request = require("supertest");

// Exercise: 03-mocking-external-sdk.js only mocks paymentIntents.create's
// success path. Real code has to handle Stripe rejecting a request too -
// mock refunds.create with BOTH a success and a failure implementation
// (mockResolvedValueOnce / mockRejectedValueOnce) to test both paths
// without ever touching the real Stripe API.

const mockRefundCreate = jest.fn();

jest.mock("stripe", () =>
  jest.fn().mockImplementation(() => ({
    refunds: { create: mockRefundCreate },
  }))
);

function createApp() {
  const app = express();
  app.use(express.json());
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder");

  app.post("/refunds", async (req, res) => {
    try {
      const refund = await stripe.refunds.create({ payment_intent: req.body.paymentIntentId });
      res.json({ success: true, data: refund });
    } catch (err) {
      res.status(502).json({ success: false, message: err.message });
    }
  });

  return app;
}

describe("POST /refunds (mocked Stripe, success and failure paths)", () => {
  afterEach(() => mockRefundCreate.mockReset());

  it("returns the refund on success", async () => {
    mockRefundCreate.mockResolvedValueOnce({ id: "re_123", status: "succeeded" });

    const app = createApp();
    const res = await request(app).post("/refunds").send({ paymentIntentId: "pi_123" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("succeeded");
  });

  it("returns 502 when Stripe rejects the refund", async () => {
    mockRefundCreate.mockRejectedValueOnce(new Error("charge already refunded"));

    const app = createApp();
    const res = await request(app).post("/refunds").send({ paymentIntentId: "pi_123" });

    expect(res.status).toBe(502);
    expect(res.body.message).toBe("charge already refunded");
  });
});
