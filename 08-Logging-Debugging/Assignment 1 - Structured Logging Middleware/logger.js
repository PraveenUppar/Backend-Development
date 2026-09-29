// Pino setup - the one place logging behavior is configured for the whole app.
// Everything else in this project just calls logger.info/warn/error - none of
// it needs to know about redaction, pretty-printing, or levels. That's the point.

const pino = require("pino");

const isProd = process.env.NODE_ENV === "production";

const logger = pino({
  // Read from env so ops can turn logging up/down without a redeploy -
  // the hand-rolled logger in 16-logging-and-debugging.js has no equivalent.
  level: process.env.LOG_LEVEL || "info",

  // Redact sensitive fields no matter which call site logs an object that
  // happens to contain them. This runs centrally - nobody has to remember
  // to scrub req.body by hand before logging it.
  redact: {
    paths: [
      "req.headers.authorization",
      "*.password",
      "*.token",
      "req.body.password",
    ],
    censor: "[Redacted]",
  },

  // Pretty, colorized, human-readable output ONLY outside production.
  // pino-pretty is a devDependency and runs in a worker thread (via
  // `transport`), so it never blocks the request-handling thread.
  transport: isProd
    ? undefined
    : {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      },
});

module.exports = logger;
