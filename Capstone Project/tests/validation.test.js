// Integration-style test of the validate() middleware against a tiny
// standalone Express app - no Mongo/Redis/Stripe needed, just like
// 15-testing-apis.js does for a self-contained app.

const express = require("express");
const request = require("supertest");
const { z } = require("zod");
const validate = require("../middleware/validate");

function buildTestApp() {
  const app = express();
  app.use(express.json());

  const addItemSchema = z.object({
    productId: z.string().min(1, "productId is required"),
    quantity: z.number().int().positive("quantity must be a positive integer"),
  });

  app.post("/cart/items", validate(addItemSchema), (req, res) => {
    res.status(201).json({ success: true, data: req.body });
  });

  return app;
}

describe("validate() middleware", () => {
  const app = buildTestApp();

  it("accepts a valid payload and passes the parsed data through", async () => {
    const res = await request(app).post("/cart/items").send({ productId: "abc123", quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ productId: "abc123", quantity: 2 });
  });

  it("rejects a missing productId with 400", async () => {
    const res = await request(app).post("/cart/items").send({ quantity: 2 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/productId/);
  });

  it("rejects a zero or negative quantity", async () => {
    const res = await request(app).post("/cart/items").send({ productId: "abc123", quantity: 0 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/quantity/);
  });

  it("rejects a non-integer quantity", async () => {
    const res = await request(app).post("/cart/items").send({ productId: "abc123", quantity: 1.5 });

    expect(res.status).toBe(400);
  });
});
