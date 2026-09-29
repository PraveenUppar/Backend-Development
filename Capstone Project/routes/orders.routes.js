const express = require("express");
const mongoose = require("mongoose");
const Stripe = require("stripe");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const Order = require("../models/Order");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler, AppError } = require("../middleware/errorHandler");
const { calculateOrderTotal, buildOrderItemsFromCart } = require("../utils/pricing");

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder");

router.use(requireAuth);

// ============================================
// POST /orders/checkout
// ============================================

// This is the one operation in the whole API that MUST be atomic: we're
// reading the cart, checking stock, decrementing stock, and creating an
// order, all as one unit. If the server crashed between "decrement stock"
// and "create order", we'd have sold inventory with no order to show for
// it. A transaction makes all of these commit together or not at all.

router.post(
  "/checkout",
  asyncHandler(async (req, res) => {
    const cart = await Cart.findOne({ user: req.user.sub }).populate("items.product");
    if (!cart || cart.items.length === 0) {
      throw new AppError("Cart is empty", 400);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    let order;
    try {
      // Re-check stock inside the transaction - it may have changed since
      // the cart was last viewed (someone else could have bought the last one).
      for (const item of cart.items) {
        const product = await Product.findById(item.product._id).session(session);
        if (!product || product.stock < item.quantity) {
          throw new AppError(`Not enough stock for ${item.product.name}`, 400);
        }
        product.stock -= item.quantity;
        await product.save({ session });
      }

      const orderItems = buildOrderItemsFromCart(cart.items);
      const totalCents = calculateOrderTotal(orderItems);

      const created = await Order.create(
        [{ user: req.user.sub, items: orderItems, totalCents, status: "pending" }],
        { session }
      );
      order = created[0];

      cart.items = [];
      await cart.save({ session });

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    // Stripe call happens AFTER the transaction commits - never do external
    // network calls (which can hang or fail) inside a DB transaction.
    const paymentIntent = await stripe.paymentIntents.create({
      amount: order.totalCents,
      currency: "usd",
      metadata: { orderId: order._id.toString() },
      automatic_payment_methods: { enabled: true },
    });

    order.stripePaymentIntentId = paymentIntent.id;
    await order.save();

    res.status(201).json({
      success: true,
      data: { order, clientSecret: paymentIntent.client_secret },
    });
  })
);

// ============================================
// Order history
// ============================================

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const [orders, total] = await Promise.all([
      Order.find({ user: req.user.sub })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Order.countDocuments({ user: req.user.sub }),
    ]);

    res.json({ success: true, data: orders, meta: { page, limit, total } });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const order = await Order.findOne({ _id: req.params.id, user: req.user.sub });
    if (!order) throw new AppError("Order not found", 404);
    res.json({ success: true, data: order });
  })
);

module.exports = router;
