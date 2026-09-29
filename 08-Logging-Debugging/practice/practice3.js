// Practice 3: Measuring the Cost of a Below-Threshold Log Call (topic 02)
// Run: node practice/practice3.js
// Standalone script, no server - prints timing to the console.

const pino = require("pino");
const { Writable } = require("stream");

// A no-op destination so this works the same on every OS (no /dev/null on
// Windows) - it discards every write instead of actually printing or
// touching disk, so the timing only measures Pino's own work.
function nullDestination() {
  return new Writable({
    write(chunk, encoding, callback) {
      callback();
    },
  });
}

// Exercise: 01-why-pino.txt claims Pino checks the level before doing any
// serialization work, so a suppressed .debug() call is a cheap no-op, not
// just quiet output. Prove it by timing a loop of debug() calls under two
// loggers - one where debug is enabled, one where it's suppressed by a
// higher level - against a deliberately expensive object to serialize.

const ITERATIONS = 100_000;
const expensiveObject = { items: Array.from({ length: 50 }, (_, i) => ({ id: i, name: `item-${i}` })) };

function timeLogging(logger) {
  const start = process.hrtime.bigint();
  for (let i = 0; i < ITERATIONS; i++) {
    logger.debug({ payload: expensiveObject }, "processing item");
  }
  const end = process.hrtime.bigint();
  return Number(end - start) / 1_000_000; // ms
}

const verboseLogger = pino({ level: "debug" }, nullDestination());
const quietLogger = pino({ level: "warn" }, nullDestination()); // debug is below this level

const verboseMs = timeLogging(verboseLogger);
const quietMs = timeLogging(quietLogger);

console.log(`level: "debug" (logs actually serialized): ${verboseMs.toFixed(1)}ms for ${ITERATIONS} calls`);
console.log(`level: "warn"  (debug calls short-circuit): ${quietMs.toFixed(1)}ms for ${ITERATIONS} calls`);
console.log(`\nThe suppressed calls should be dramatically faster - that's the "cheap no-op" claim, measured.`);
