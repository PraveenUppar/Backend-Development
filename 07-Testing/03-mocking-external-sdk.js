// Testing 3 - Mocking an External SDK
// Builds on 02-mongodb-memory-server.js.
// Run: npx jest 03-mocking-external-sdk.js
// Needs: jest, supertest, stripe

const express = require("express");
const Stripe = require("stripe");
const request = require("supertest");

// ============================================
// jest.mock("stripe") - mocking an external SDK
// ============================================

// You never want tests making real calls to a third-party API: it needs
// real credentials, it's slow, it can fail for reasons that have nothing
// to do with your code, and (for something like Stripe) it would actually
// create real objects in your account every test run. jest.mock("stripe")
// replaces the WHOLE "stripe" module for every file that requires it in
// this test run - including createApp() below.
//
// Jest hoists jest.mock() calls to the very top of the file (above even
// `require` statements) at transform time, so it doesn't matter that this
// call appears after the `require("stripe")` above - by the time anything
// actually runs, "stripe" already resolves to the fake. The one catch:
// the factory function below can only reference outer variables whose name
// starts with "mock" (case-insensitive) - that's Jest's explicit, narrow
// exception to "you can't touch a not-yet-initialized variable", made
// specifically to support this hoisting.
const mockPaymentIntentCreate = jest.fn().mockResolvedValue({
  id: "pi_test_123",
  client_secret: "secret_test",
});

jest.mock("stripe", () =>
  jest.fn().mockImplementation(() => ({
    paymentIntents: { create: mockPaymentIntentCreate },
  }))
);

function createApp() {
  const app = express();
  app.use(express.json());
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder");

  app.post("/checkout", async (req, res) => {
    // This is the call jest.mock("stripe") above intercepts - in a real
    // test run this NEVER reaches the network.
    const paymentIntent = await stripe.paymentIntents.create({
      amount: req.body.amountCents,
      currency: "usd",
    });
    res.json({ success: true, data: { clientSecret: paymentIntent.client_secret } });
  });

  return app;
}

describe("POST /checkout (integration + mocked Stripe)", () => {
  it("calls the mocked Stripe SDK with the right amount and returns its client secret", async () => {
    const app = createApp();
    const res = await request(app).post("/checkout").send({ amountCents: 20000 });

    expect(res.status).toBe(200);
    expect(res.body.data.clientSecret).toBe("secret_test");

    // Because jest.mock("stripe") swapped the constructor, the fake
    // paymentIntents.create IS mockPaymentIntentCreate - we can assert on
    // exactly what our route tried to send Stripe, not just that "some
    // HTTP call" happened.
    expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 20000, currency: "usd" })
    );
  });
});
