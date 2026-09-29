// Practice 3: Retryable Failed-Email Queue (topic 03)
// Needs: Redis running (docker run -d -p 6379:6379 redis)
// Run: node practice/practice3.js
// Then: curl -X POST http://localhost:4323/emails -H "Content-Type: application/json" -d "{\"to\":\"a@a.com\"}"

const express = require("express");
const { Queue, Worker } = require("bullmq");

const app = express();
app.use(express.json());

const connection = { host: "localhost", port: 6379 };
const emailQueue = new Queue("emails", { connection });

// Exercise: simulate a flaky email provider that fails ~50% of the time.
// Failed jobs should be inspectable AND individually retryable, instead of
// only being retried automatically by BullMQ's own attempts/backoff.

new Worker(
  "emails",
  async (job) => {
    if (Math.random() < 0.5) {
      throw new Error("Simulated provider outage");
    }
    return { to: job.data.to, sentAt: new Date().toISOString() };
  },
  { connection }
);

app.post("/emails", async (req, res) => {
  const job = await emailQueue.add(
    "send-email",
    { to: req.body.to },
    { attempts: 2, backoff: { type: "exponential", delay: 500 } }
  );
  res.status(202).json({ success: true, data: { jobId: job.id } });
});

app.get("/emails/failed", async (req, res) => {
  const failed = await emailQueue.getFailed();
  res.json({ success: true, data: failed.map((j) => ({ id: j.id, to: j.data.to, failedReason: j.failedReason })) });
});

// Manual retry after "fixing" whatever was wrong (here, just trying again).
app.post("/emails/failed/:jobId/retry", async (req, res) => {
  const job = await emailQueue.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, message: "Job not found" });
  await job.retry();
  res.json({ success: true, data: { jobId: job.id, message: "Requeued for another attempt" } });
});

const PORT = 4323;
app.listen(PORT, () => console.log(`Practice 3 running on http://localhost:${PORT}`));
