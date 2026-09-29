// Pagination, Filtering, Sorting, Search - common list-endpoint patterns
// Run: node 09-pagination-filtering-sorting-search.js
// Then: curl "http://localhost:4009/products?page=1&limit=2&category=shoes&sort=-price&q=run"

const express = require("express");
const { z } = require("zod");

const app = express();
app.use(express.json());

// In-memory dataset for this demo
const products = [
  { id: 1, name: "Running shoes", category: "shoes", price: 60 },
  { id: 2, name: "Formal shoes", category: "shoes", price: 90 },
  { id: 3, name: "Cotton t-shirt", category: "clothing", price: 15 },
  { id: 4, name: "Trail running shoes", category: "shoes", price: 120 },
  { id: 5, name: "Denim jacket", category: "clothing", price: 75 },
];

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  category: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
});

app.get("/products", (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid query params" });
  }
  const { page, limit, category, minPrice, maxPrice, sort, q } = parsed.data;

  // ============================================
  // 1. Filtering
  // ============================================
  let results = products;

  if (category) {
    results = results.filter((p) => p.category === category);
  }
  if (minPrice !== undefined) {
    results = results.filter((p) => p.price >= minPrice);
  }
  if (maxPrice !== undefined) {
    results = results.filter((p) => p.price <= maxPrice);
  }

  // ============================================
  // 4. Pagination - slice the already filtered/sorted results
  // ============================================

  const start = (page - 1) * limit;
  const paginated = results.slice(start, start + limit);

  res.json({
    success: true,
    data: paginated,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: start + limit < total,
    },
  });
});

const PORT = 4009;
app.listen(PORT, () =>
  console.log(`Pagination demo running on http://localhost:${PORT}`),
);
