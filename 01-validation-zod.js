// Request Validation with Zod
// Run: node 01-validation-zod.js
// Then: curl -X POST http://localhost:4001/signup -H "Content-Type: application/json" -d "{\"email\":\"a@a.com\",\"age\":20}"

import express from "express";
import z from "zod";

const app = express();
app.use(express.json());

// ============================================
// Why validate on the server?
// ============================================

// Never trust data coming from the client, even if your frontend already
// validates it. Someone can always hit your API directly with curl/Postman.
// Zod lets you describe the SHAPE of valid data once, then reuse it to both
// validate and get TypeScript-like confidence in plain JS.

// ============================================
// Basic schema
// ============================================

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  age: z.number().int().positive().optional(),
});

app.post("/signup", (req, res) => {
  const result = signupSchema.safeParse(req.body);

  if (!result.success) {
    // result.error.issues is an array of { path, message }
    const messages = result.error.issues.map((issue) => issue.message);
    return res
      .status(400)
      .json({ success: false, message: messages.join(", ") });
  }

  // result.data is the parsed, validated payload
  res.status(201).json({ success: true, data: result.data });
});

// curl -X POST /signup -d '{"email":"bad-email","password":"123"}'
// -> 400 { success: false, message: "Invalid email address, Password must be at least 6 characters" }

// ============================================
// Validating query params and route params
// ============================================

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

// z.coerce.number() converts the string that query params always are
// ("2") into a real number (2) before validating.

app.get("/items", (req, res) => {
  const result = listQuerySchema.safeParse(req.query);
  if (!result.success) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid query params" });
  }
  const { page, limit } = result.data;
  res.json({ success: true, data: { page, limit, items: [] } });
});

// GET /items?page=2&limit=5 -> { page: 2, limit: 5, items: [] }
// GET /items?page=abc       -> 400 Invalid query params

// ============================================
// Nested objects, arrays, and custom refinements
// ============================================

const orderSchema = z
  .object({
    customer: z.object({
      name: z.string().min(1),
      email: z.string().email(),
    }),
    items: z
      .array(
        z.object({
          productId: z.string(),
          quantity: z.number().int().positive(),
        }),
      )
      .min(1, "Order must have at least one item"),
    couponCode: z.string().optional(),
  })
  .refine((data) => !data.couponCode || data.couponCode.startsWith("SAVE"), {
    message: "Coupon codes must start with SAVE",
    path: ["couponCode"],
  });

app.post("/orders", validate(orderSchema), (req, res) => {
  res.status(201).json({ success: true, data: req.body });
});

const PORT = 4001;
app.listen(PORT, () =>
  console.log(`Validation demo running on http://localhost:${PORT}`),
);
