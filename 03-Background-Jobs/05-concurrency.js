// Background Jobs 5 - Concurrency
// Builds on 04-job-priority.js.
// Needs: Redis running (docker run -d -p 6379:6379 redis)
// Run: node 05-concurrency.js
// Then: curl -X POST http://localhost:4315/reports/concurrency-demo  (then GET /reports/concurrency-demo/timeline)

const express = require("express");
const { Queue, Worker } = require("bullmq");

const app = express();
app.use(express.json());

const connection = { host: "localhost", port: 6379 };
const reportQueue = new Queue("reports-concurrency", { connection });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const timeline = [];

// ============================================
// Concurrency - how many jobs one Worker processes at once
// ============================================

// By default a Worker processes ONE job at a time. For I/O-bound jobs
// (calling an external API, hitting a database) that's wasteful - the
// process is mostly waiting, not computing. `concurrency` lets a single
// Worker instance pull and process multiple jobs in parallel.
//
// This is concurrency WITHIN one Node process (via the event loop), not
// threads. For CPU-bound work (image resizing, video encoding) concurrency
// doesn't help much since the event loop is still single-threaded - for
// that you'd run multiple separate Worker PROCESSES instead (just start the
// worker script more than once; BullMQ handles multiple workers consuming
// the same queue safely).
//
// Rule of thumb: high concurrency for I/O-bound jobs, low concurrency (or
// multiple processes) for CPU-bound jobs.

new Worker(
  "reports-concurrency",
  async (job) => {
    const start = Date.now();
    await sleep(1000); // stand-in for an I/O wait (an external API call, a DB query)
    timeline.push({ jobId: job.id, startedAtMs: start, finishedAtMs: Date.now() });
  },
  { connection, concurrency: 5 }
);

app.post("/reports/concurrency-demo", async (req, res) => {
  const jobs = await Promise.all(
    Array.from({ length: 5 }, () => reportQueue.add("generate-report", {}))
  );
  res.status(202).json({ success: true, data: jobs.map((j) => j.id) });
});

app.get("/reports/concurrency-demo/timeline", (req, res) => {
  // With concurrency: 5, all 5 jobs should overlap - their startedAtMs
  // values should be close together instead of ~1000ms apart like they'd
  // be with the default concurrency: 1.
  res.json({ success: true, data: timeline });
});

const PORT = 4315;
app.listen(PORT, () => console.log(`Concurrency demo running on http://localhost:${PORT}`));
