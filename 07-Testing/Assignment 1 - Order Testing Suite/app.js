// Order Testing Suite - the app under test.
// A tiny "orders" API backed by a REAL Mongoose model, deliberately small
// but wired the same way a real integration-tested app is: real routes,
// a real (temporary, in tests) database, real HTTP via supertest in
// tests/orders.test.js.

const express = require("express");
const mongoose = require("mongoose");
const Stripe = require("stripe");

const orderSchema = new mongoose.Schema({
  item: { type: String, required: true },
  amountCents: { type: Number, required: true },
  paid: { type: Boolean, default: false },
});
// Guard against "Cannot overwrite model once compiled" if this file gets
// required more than once in the same process (e.g. watch mode).
const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);

function createApp() {
  const app = express();
  app.use(express.json());
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder");

  app.post("/orders", async (req, res) => {
    if (!req.body.item || !req.body.amountCents) {
      return res.status(400).json({ success: false, message: "item and amountCents are required" });
    }
    const order = await Order.create({ item: req.body.item, amountCents: req.body.amountCents });
    res.status(201).json({ success: true, data: order });
  });

  app.get("/orders", async (req, res) => {
    const orders = await Order.find();
    res.json({ success: true, data: orders });
  });

  app.post("/orders/:id/checkout", async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: order.amountCents,
      currency: "usd",
      metadata: { orderId: order._id.toString() },
    });

    order.paid = true;
    await order.save();

    res.json({ success: true, data: { order, clientSecret: paymentIntent.client_secret } });
  });

  return app;
}

module.exports = { createApp, Order };
