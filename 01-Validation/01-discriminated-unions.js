// Validation 1 - Discriminated Unions
// ../01-validation-zod.js already covers basic z.object() schemas,
// .safeParse(), coercing query params with z.coerce, a reusable
// validate() middleware, nested objects/arrays, and .refine() for a
// single custom check. This picks up where that one stops - the stuff
// you need once your API accepts more than one "shape" of input.
// Run: node 01-discriminated-unions.js
// Then: curl -X POST http://localhost:4111/shapes -H "Content-Type: application/json" -d "{\"kind\":\"circle\",\"radius\":5}"

const express = require("express");
const { z } = require("zod");

const app = express();
app.use(express.json());

// ============================================
// Discriminated unions - "this object can be ONE OF several shapes,
// and a field tells you which"
// ============================================

// Plain z.union() tries each schema in order and returns confusing errors
// when none match (it doesn't know which branch you MEANT to use). A
// discriminated union fixes that: you name one field (the "discriminant"),
// Zod looks at its value FIRST, picks the matching branch, and only
// validates against that one branch. Way faster and the error messages
// actually point at the right fields.

const shapeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("circle"),
    radius: z.number().positive(),
  }),
  z.object({
    kind: z.literal("rectangle"),
    width: z.number().positive(),
    height: z.number().positive(),
  }),
]);

app.post("/shapes", (req, res) => {
  const result = shapeSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, message: result.error.issues.map((i) => i.message).join(", ") });
  }
  res.status(201).json({ success: true, data: result.data });
});

// curl -X POST /shapes -d '{"kind":"circle","radius":5}'      -> 201 ok
// curl -X POST /shapes -d '{"kind":"rectangle","width":2}'    -> 400 missing height
// curl -X POST /shapes -d '{"kind":"triangle","sides":3}'     -> 400 invalid kind
//
// The discriminant field MUST be a z.literal() (or z.enum of literals) in
// every branch - that's what lets Zod jump straight to the right schema
// instead of brute-force trying all of them. Use this any time a "type" or
// "role" field changes what other fields are required (an applicant that's
// a student vs a professional, a payment method that's a card vs a bank
// transfer) - exactly what Assignment 1 - Job Application API/schemas.js
// does.

const PORT = 4111;
app.listen(PORT, () => console.log(`Discriminated unions demo running on http://localhost:${PORT}`));
