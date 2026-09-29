// Background Jobs 3 - Failed Jobs (the closest thing to a dead-letter queue)
// Builds on 02-repeatable-jobs.js.
// Needs: Redis running (docker run -d -p 6379:6379 redis)
// Run: node 03-failed-jobs-dead-letter.js
// Then: curl -X POST http://localhost:4313/reports/fail-demo  (wait ~7s, then GET /reports/failed)

const express = require("express");
const { Queue, Worker } = require("bullmq");

const app = express();
app.use(express.json());

const connection = { host: "localhost", port: 6379 };
const reportQueue = new Queue("reports-failed", { connection });

const worker = new Worker(
  "reports-failed",
  async () => {
    // Always throws - lets you watch attempts/backoff/failure inspection.
    throw new Error("Simulated failure for demo purposes");
  },
  { connection }
);
worker.on("failed", (job, err) => console.error(`[worker] Job ${job.id} (${job.name}) failed: ${err.message}`));

// ============================================
// Failed jobs - there's no literal dead-letter queue, but close enough
// ============================================

// Coming from message-broker land (SQS, RabbitMQ) you might expect a
// distinct "dead letter queue." BullMQ doesn't have a separate queue for
// this - a job that exhausts all its `attempts` just stays in the SAME
// queue's "failed" set in Redis, with its `failedReason` recorded, until
// something explicitly cleans it up.

app.post("/reports/fail-demo", async (req, res) => {
  const job = await reportQueue.add(
    "fail-demo",
    {},
    { attempts: 3, backoff: { type: "exponential", delay: 1000 } }
  );
  res.status(202).json({ success: true, data: { jobId: job.id, note: "watch it retry 3 times, then check GET /reports/failed" } });
});

app.get("/reports/failed", async (req, res) => {
  const failedJobs = await reportQueue.getFailed();
  const summary = failedJobs.map((job) => ({
    id: job.id,
    name: job.name,
    failedReason: job.failedReason,
    attemptsMade: job.attemptsMade,
  }));
  res.json({ success: true, data: summary });
});

// Practically: "failed" acts as your dead-letter queue conceptually - a
// queryable set within the same Queue object rather than a separate named
// queue. Set `removeOnFail: { count: 1000 }` as a job option in production
// so this set doesn't grow unbounded, since BullMQ keeps ALL failed jobs
// forever by default. Retry one manually after fixing what was wrong:
// `await job.retry()`. Clean old ones: `await reportQueue.clean(24*60*60*1000, 1000, "failed")`.

const PORT = 4313;
app.listen(PORT, () => console.log(`Failed jobs demo running on http://localhost:${PORT}`));
