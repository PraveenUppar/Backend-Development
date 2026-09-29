const express = require("express");
const { z } = require("zod");
const Product = require("../models/Product");
const validate = require("../middleware/validate");
const { requireAuth, requireRole } = require("../middleware/auth");
const { asyncHandler, AppError } = require("../middleware/errorHandler");
const { cacheGet, cacheSet, cacheDelByPrefix } = require("../cache/redis");

const router = express.Router();
const CACHE_PREFIX = "products:";

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  category: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  sort: z.string().optional(), // "priceCents" or "-priceCents"
  q: z.string().optional(),
});

// ============================================
// GET /products - public, cached, filtered/sorted/paginated/searchable
// ============================================

router.get(
  "/",
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { page, limit, category, minPrice, maxPrice, sort, q } = req.query;

    const cacheKey = `${CACHE_PREFIX}${JSON.stringify(req.query)}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    const filter = {};
    if (category) filter.category = category;
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.priceCents = {};
      if (minPrice !== undefined) filter.priceCents.$gte = minPrice;
      if (maxPrice !== undefined) filter.priceCents.$lte = maxPrice;
    }
    if (q) filter.$text = { $search: q };

    const sortObj = {};
    if (sort) {
      const direction = sort.startsWith("-") ? -1 : 1;
      sortObj[sort.replace("-", "")] = direction;
    } else {
      sortObj.createdAt = -1;
    }

    const [items, total] = await Promise.all([
      Product.find(filter).sort(sortObj).skip((page - 1) * limit).limit(limit),
      Product.countDocuments(filter),
    ]);

    const payload = {
      success: true,
      data: items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };

    await cacheSet(cacheKey, payload, 30);
    res.json({ ...payload, cached: false });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) throw new AppError("Product not found", 404);
    res.json({ success: true, data: product });
  })
);

// ============================================
// Admin-only CRUD - any write invalidates the whole product cache
// ============================================

const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  priceCents: z.number().int().positive(),
  category: z.string().min(1),
  stock: z.number().int().min(0).default(0),
  imageUrl: z.string().optional().default(""),
});

router.post(
  "/",
  requireAuth,
  requireRole("admin"),
  validate(productSchema),
  asyncHandler(async (req, res) => {
    const product = await Product.create(req.body);
    await cacheDelByPrefix(CACHE_PREFIX);
    res.status(201).json({ success: true, data: product });
  })
);

router.patch(
  "/:id",
  requireAuth,
  requireRole("admin"),
  validate(productSchema.partial()),
  asyncHandler(async (req, res) => {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!product) throw new AppError("Product not found", 404);
    await cacheDelByPrefix(CACHE_PREFIX);
    res.json({ success: true, data: product });
  })
);

router.delete(
  "/:id",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) throw new AppError("Product not found", 404);
    await cacheDelByPrefix(CACHE_PREFIX);
    res.json({ success: true, data: null });
  })
);

module.exports = router;
