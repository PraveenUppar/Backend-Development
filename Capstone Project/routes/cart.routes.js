const express = require("express");
const { z } = require("zod");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const validate = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler, AppError } = require("../middleware/errorHandler");

const router = express.Router();
router.use(requireAuth); // every cart route is per-logged-in-user

async function getOrCreateCart(userId) {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const cart = await Cart.findOne({ user: req.user.sub }).populate("items.product");
    res.json({ success: true, data: cart || { user: req.user.sub, items: [] } });
  })
);

const addItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().default(1),
});

router.post(
  "/items",
  validate(addItemSchema),
  asyncHandler(async (req, res) => {
    const { productId, quantity } = req.body;

    const product = await Product.findById(productId);
    if (!product) throw new AppError("Product not found", 404);
    if (product.stock < quantity) throw new AppError("Not enough stock available", 400);

    const cart = await getOrCreateCart(req.user.sub);
    const existing = cart.items.find((item) => item.product.toString() === productId);

    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.items.push({ product: productId, quantity });
    }

    await cart.save();
    await cart.populate("items.product");
    res.status(201).json({ success: true, data: cart });
  })
);

const updateItemSchema = z.object({
  quantity: z.number().int().positive(),
});

router.patch(
  "/items/:productId",
  validate(updateItemSchema),
  asyncHandler(async (req, res) => {
    const cart = await getOrCreateCart(req.user.sub);
    const item = cart.items.find((i) => i.product.toString() === req.params.productId);
    if (!item) throw new AppError("Item not in cart", 404);

    item.quantity = req.body.quantity;
    await cart.save();
    await cart.populate("items.product");
    res.json({ success: true, data: cart });
  })
);

router.delete(
  "/items/:productId",
  asyncHandler(async (req, res) => {
    const cart = await getOrCreateCart(req.user.sub);
    cart.items = cart.items.filter((i) => i.product.toString() !== req.params.productId);
    await cart.save();
    await cart.populate("items.product");
    res.json({ success: true, data: cart });
  })
);

module.exports = router;
