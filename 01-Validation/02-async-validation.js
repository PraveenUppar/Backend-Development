// Validation 5 - Async Validation
// Builds on 04-bulk-array-validation.js.
// Run: node 05-async-validation.js
// Then: curl -X POST http://localhost:4115/signup -H "Content-Type: application/json" -d "{\"email\":\"taken@example.com\",\"password\":\"secret123\"}"

const express = require("express");
const { z } = require("zod");

const app = express();
app.use(express.json());

// ============================================
// .safeParseAsync() - validation that needs to await something
// ============================================

// Regular .parse()/.safeParse() are synchronous - fine for shape/format
// checks, but useless if a rule needs to hit the database ("is this email
// already taken?"). .refine() and .superRefine() both accept an ASYNC
// function, but you must then call .safeParseAsync() (not .safeParse()) or
// Zod hands you back an unresolved Promise instead of a result.

const takenEmails = new Set(["taken@example.com"]); // fake "database" for this demo

const signupSchema = z
  .object({ email: z.string().email(), password: z.string().min(6) })
  .superRefine(async (data, ctx) => {
    const exists = takenEmails.has(data.email); // imagine: await User.exists({ email })
    if (exists) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Email is already registered", path: ["email"] });
    }
  });

app.post("/signup", async (req, res) => {
  const result = await signupSchema.safeParseAsync(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, message: result.error.issues.map((i) => i.message).join(", ") });
  }
  res.status(201).json({ success: true, data: result.data });
});

// curl -X POST /signup -d '{"email":"taken@example.com","password":"secret123"}'
// -> 400 "Email is already registered"
//
// Gotcha: if ANY refinement in a schema is async, the whole schema becomes
// async and you MUST use the Async variants everywhere you parse it -
// mixing .safeParse() with an async .superRefine() silently gives you a
// Promise object instead of a result. Keep async checks for things that
// genuinely need I/O - don't make a schema async just to feel fancy, since
// every parse now costs a round trip.

const PORT = 4115;
app.listen(PORT, () => console.log(`Async validation demo running on http://localhost:${PORT}`));
