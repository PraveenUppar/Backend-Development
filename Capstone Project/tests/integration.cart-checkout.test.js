// Integration test for cart -> checkout, the one flow in this API that
// MUST be correct end-to-end: adding stock-checked items to a cart, then
// atomically decrementing stock + creating an order + creating a Stripe
// PaymentIntent (see orders.routes.js's transaction).
//
// jest.mock("stripe") swaps the whole SDK out for a fake BEFORE server.js
// (and therefore orders.routes.js, which does `new Stripe(...)` at module
// load) gets required - see Testing\Notes.txt section 3 for why the mock
// variable has to be named "mockCreate" (Jest's hoisting exception for
// jest.mock() factories only allows referencing outer variables prefixed
// with "mock").

const mockCreate = jest.fn().mockResolvedValue({
  id: "pi_test_123",
  client_secret: "secret_test",
});

jest.mock("stripe", () =>
  jest.fn().mockImplementation(() => ({
    paymentIntents: { create: mockCreate },
  }))
);

const request = require("supertest");
const app = require("../server");
const Product = require("../models/Product");
const Order = require("../models/Order");

const credentials = { name: "Praveen", email: "praveen@example.com", password: "secret123" };
const PRICE_CENTS = 2500;
const STOCK = 10;
const QUANTITY = 3;

async function signupAndLogin() {
  await request(app).post("/auth/signup").send(credentials);
  const login = await request(app)
    .post("/auth/login")
    .send({ email: credentials.email, password: credentials.password });
  return login.body.data.token;
}

beforeEach(() => {
  mockCreate.mockClear();
});

describe("POST /orders/checkout", () => {
  it("creates the order, decrements stock, and calls Stripe with the right amount", async () => {
    // Seed a product directly through the model - no need to go through the
    // admin-only POST /products route for this test.
    const product = await Product.create({
      name: "Running shoes",
      priceCents: PRICE_CENTS,
      category: "shoes",
      stock: STOCK,
    });

    const token = await signupAndLogin();
    const auth = { Authorization: `Bearer ${token}` };

    const addToCart = await request(app)
      .post("/cart/items")
      .set(auth)
      .send({ productId: product._id.toString(), quantity: QUANTITY });
    expect(addToCart.status).toBe(201);

    const checkout = await request(app).post("/orders/checkout").set(auth);

    expect(checkout.status).toBe(201);
    expect(checkout.body.success).toBe(true);

    const expectedTotal = PRICE_CENTS * QUANTITY;
    const order = checkout.body.data.order;
    expect(order.totalCents).toBe(expectedTotal);
    expect(order.status).toBe("pending");
    expect(order.stripePaymentIntentId).toBe("pi_test_123");
    expect(checkout.body.data.clientSecret).toBe("secret_test");

    // The order actually exists in the DB, not just in the response.
    const stored = await Order.findById(order._id);
    expect(stored).not.toBeNull();
    expect(stored.totalCents).toBe(expectedTotal);
    expect(stored.items).toHaveLength(1);
    expect(stored.items[0].quantity).toBe(QUANTITY);

    // Stock was decremented by exactly the quantity purchased.
    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.stock).toBe(STOCK - QUANTITY);

    // Stripe was asked to create a PaymentIntent for the order total, tagged
    // with this order's id, not just "called with something".
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: expectedTotal,
        currency: "usd",
        metadata: { orderId: order._id.toString() },
      })
    );
  });

  it("rejects checkout with an empty cart", async () => {
    const token = await signupAndLogin();

    const res = await request(app).post("/orders/checkout").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
