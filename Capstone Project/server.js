// Assignment 8 (Capstone): E-commerce Cart API
// ==============================================
//
// Build a small but real e-commerce backend: browse products, manage a
// cart, check out with a real payment flow, and keep inventory correct
// even when things fail halfway through. This assignment is meant to
// combine nearly everything covered in this Backend revision.
//
// Requirements:
// 1. Auth: signup/login/me (JWT + bcrypt)
// 2. Products: public paginated/filterable/searchable list (cached in
//    Redis), admin-only create/update/delete (cache invalidated on write)
// 3. Cart: per-user cart, add/update/remove items, stock is checked
//    before adding
// 4. Checkout: POST /orders/checkout must be ATOMIC - decrementing stock
//    and creating the order happen in one MongoDB transaction, so a crash
//    mid-checkout can never sell inventory without a matching order
// 5. Payments: create a Stripe PaymentIntent for the order total after
//    the transaction commits, return the client secret
// 6. Webhooks: a Stripe webhook marks the order "paid" on success (and
//    enqueues a confirmation job) or releases stock and marks it "failed"
//    on failure - never trust the frontend to report payment success
// 7. Background jobs: order confirmation "emails" go through a queue, not
//    inline in the webhook handler; a scheduled cron job releases stock
//    from abandoned ("pending" for 30+ minutes) orders
// 8. Auth roles: only admins can manage products; users can only see
//    their own cart/orders
// 9. Tests: the pure pricing logic and request validation are unit
//    tested (see tests/) without needing Mongo/Redis/Stripe running
//
// Bonus (not all implemented - good next steps):
// - Coupon codes applied at checkout
// - Order cancellation by the user while still "pending"
// - Product reviews/ratings
// - Email receipts with an actual template (currently just a console log
//   in the job worker)
//
// Setup:
// 1. npm install
// 2. Copy .env.example to .env and fill in MONGO_URI (must be a replica
//    set - see .env.example), REDIS_URL, JWT_SECRET, STRIPE_SECRET_KEY
// 3. npm run dev
// 4. For webhooks locally: stripe listen --forward-to localhost:5008/webhooks/stripe

require("dotenv").config();
const express = require("express");
const morgan = require("morgan");
const connectDB = require("./db");
const { notFoundHandler, errorMiddleware } = require("./middleware/errorHandler");
const { startWorker, startExpiredOrderSweep } = require("./jobs/queue");
const Order = require("./models/Order");
const Product = require("./models/Product");

const authRoutes = require("./routes/auth.routes");
const productRoutes = require("./routes/products.routes");
const cartRoutes = require("./routes/cart.routes");
const orderRoutes = require("./routes/orders.routes");
const stripeWebhook = require("./webhooks/stripe.webhook");

const app = express();
app.use(morgan("dev"));

// Webhook route needs the RAW body for Stripe signature verification, so it
// must be registered BEFORE express.json() is applied to everything else.
app.use("/webhooks", express.raw({ type: "application/json" }), stripeWebhook);

app.use(express.json());

app.get("/health", (req, res) => res.json({ success: true, data: "ok" }));

app.use("/auth", authRoutes);
app.use("/products", productRoutes);
app.use("/cart", cartRoutes);
app.use("/orders", orderRoutes);

app.use(notFoundHandler);
app.use(errorMiddleware);

const PORT = process.env.PORT || 5008;

async function start() {
  await connectDB();
  startWorker();
  startExpiredOrderSweep(Order, Product);
  app.listen(PORT, () => console.log(`E-commerce Cart API running on http://localhost:${PORT}`));
}

if (require.main === module) {
  start();
}

module.exports = app;

// ============================================
// Try it out
// ============================================
//
// curl -X POST localhost:5008/auth/signup -H "Content-Type: application/json" -d "{\"name\":\"Praveen\",\"email\":\"p@a.com\",\"password\":\"secret123\"}"
// curl -X POST localhost:5008/auth/login -H "Content-Type: application/json" -d "{\"email\":\"p@a.com\",\"password\":\"secret123\"}"
//
// Promote to admin by hand to test product management:
// mongosh ecommerce_cart_api --eval 'db.users.updateOne({email:"p@a.com"},{$set:{role:"admin"}})'
//
// curl -X POST localhost:5008/products -H "Authorization: Bearer <admin-token>" -H "Content-Type: application/json" -d "{\"name\":\"Running shoes\",\"priceCents\":6000,\"category\":\"shoes\",\"stock\":10}"
// curl "localhost:5008/products?category=shoes&page=1&limit=10"
// curl -X POST localhost:5008/cart/items -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d "{\"productId\":\"<id>\",\"quantity\":2}"
// curl -X POST localhost:5008/orders/checkout -H "Authorization: Bearer <token>"
