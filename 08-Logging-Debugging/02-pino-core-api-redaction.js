// Logging & Debugging 2 - Pino Core API + Redaction
// See ../01-why-pino.txt for why a real library, and why Pino, first.
// Run: node 02-pino-core-api-redaction.js
// Then: curl -X POST http://localhost:4812/signup -H "Content-Type: application/json" -d "{\"email\":\"a@a.com\",\"password\":\"secret123\"}"

const express = require("express");
const pino = require("pino");

const app = express();
app.use(express.json());

// ============================================
// Pino core API + redaction + env-driven pretty printing
// ============================================

const isProd = process.env.NODE_ENV === "production";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: ["req.headers.authorization", "*.password", "*.token"],
  transport: isProd ? undefined : { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard" } },
});

// Note the argument order: OBJECT FIRST, message second - the opposite of
// console.log("msg", obj), and deliberate. Pino merges the object directly
// into the JSON log line as top-level fields:
//   logger.info({ userId: 42 }, "user logged in");
//   -> {"level":30,"time":...,"userId":42,"msg":"user logged in"}
// This is what makes logs actually QUERYABLE (query on userId:42) instead of
// just readable - your log aggregator parses fields, not message strings.
//
// Log levels (lowest to highest): trace, debug, info, warn, error, fatal.
// Setting level:"warn" means .info()/.debug() become cheap no-ops - Pino
// checks the level before doing any serialization work at all.

app.post("/signup", (req, res) => {
  // Deliberately logging the whole body to show redaction working - a
  // hand-rolled logger has no equivalent, so a call like this anywhere in a
  // real app would leak the password in the clear.
  logger.info({ body: req.body }, "signup attempt");
  res.status(201).json({ success: true, data: { email: req.body.email } });
});

// curl -X POST /signup -d '{"email":"a@a.com","password":"secret123"}'
// -> log line shows {"body":{"email":"a@a.com","password":"[Redacted]"},"msg":"signup attempt"}
//
// `*.password` is a wildcard path - it matches "password" at any first-level
// key underneath any object. For deeply nested cases you write the exact
// path, or use redact:{paths,censor:"**HIDDEN**"} to customize the replacement.
//
// pino-pretty is a separate dev-only dependency (npm i -D pino-pretty) -
// it should never run in production. Because it's driven by the `transport`
// option, Pino runs it in a worker thread rather than blocking the
// request-handling thread.

const PORT = 4812;
app.listen(PORT, () => logger.info(`Pino core API demo running on http://localhost:${PORT}`));
