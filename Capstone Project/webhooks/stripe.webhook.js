const express = require("express");
const mongoose = require("mongoose");
const Stripe = require("stripe");
const Order = require("../models/Order");
const Product = require("../models/Product");
const { orderQueue } = require("../jobs/queue");

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder");
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_placeholder";

// This route is mounted with express.raw() in server.js, BEFORE express.json()
// is applied globally - signature verification needs the exact raw bytes Stripe sent.

router.post("/stripe", async (req, res) => {
  const signature = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "payment_intent.succeeded") {
      const orderId = event.data.object.metadata.orderId;
      const order = await Order.findById(orderId);
      if (order && order.status === "pending") {
        order.status = "paid";
        await order.save();
        await orderQueue.add("order-confirmation", { orderId: order._id.toString() });
      }
    }

    if (event.type === "payment_intent.payment_failed") {
      const orderId = event.data.object.metadata.orderId;
      const order = await Order.findById(orderId);

      if (order && order.status === "pending") {
        // Payment failed - release the stock we reserved at checkout time.
        // Multiple product updates + the order status change, so this is
        // another transaction, same reasoning as the checkout route.
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
          for (const item of order.items) {
            await Product.updateOne(
              { _id: item.product },
              { $inc: { stock: item.quantity } },
              { session }
            );
          }
          order.status = "failed";
          await order.save({ session });
          await session.commitTransaction();
        } catch (err) {
          await session.abortTransaction();
          throw err;
        } finally {
          session.endSession();
        }

        await orderQueue.add("order-failed", { orderId: order._id.toString() });
      }
    }
  } catch (err) {
    // Log but still acknowledge receipt below - re-throwing here would make
    // Stripe retry a webhook whose failure is on OUR side, not transient.
    console.error("Error processing webhook event:", err.message);
  }

  // Acknowledge quickly - any slow follow-up work goes through the queue above,
  // not inline here (Stripe times out and retries if we don't respond fast).
  res.json({ received: true });
});

module.exports = router;
