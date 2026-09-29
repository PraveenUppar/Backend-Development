// Background Jobs 1 - Job Progress Tracking
// ../11-background-jobs.js already covers node-cron, a basic Queue +
// Worker pair, enqueueing instead of doing work inline, and retrying with
// attempts + backoff. This picks up where that one stops.
// Needs: Redis running (docker run -d -p 6379:6379 redis)
// Run: node 01-job-progress-tracking.js
// Then: curl -X POST http://localhost:4311/reports  (copy the jobId, then poll GET /reports/:jobId)

const express = require("express");
const { Queue, Worker, QueueEvents } = require("bullmq");

const app = express();
app.use(express.json());

const connection = { host: "localhost", port: 6379 };
const reportQueue = new Queue("reports-progress", { connection });
const queueEvents = new QueueEvents("reports-progress", { connection });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// Job progress tracking
// ============================================

// A job that takes 10 seconds looks the same as a frozen job from the
// outside unless it reports progress. BullMQ lets a job update its own
// progress from inside the processor, and lets anything else (an API route,
// a dashboard) read that progress back later.

const worker = new Worker(
  "reports-progress",
  async (job) => {
    await job.updateProgress(25);
    await sleep(500);
    await job.updateProgress(50);
    await sleep(500);
    await job.updateProgress(75);
    await sleep(500);
    await job.updateProgress(100);
    return { generatedAt: new Date().toISOString() };
  },
  { connection }
);

queueEvents.on("progress", ({ jobId, data }) => {
  console.log(`Job ${jobId} is now at ${data}%`);
});

app.post("/reports", async (req, res) => {
  const job = await reportQueue.add("generate-report", {});
  res.status(202).json({ success: true, data: { jobId: job.id } });
});

app.get("/reports/:jobId", async (req, res) => {
  const job = await reportQueue.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, message: "Job not found" });
  res.json({ success: true, data: { state: await job.getState(), progress: job.progress } });
});

// Progress can be a number (0-100 is the convention, but it's just data - you
// could also pass an object like { stage: "rendering", percent: 60 } if you
// need more than a percentage). Without progress, "processing" is a black
// box - anything multi-stage should report it so a frontend can show a
// progress bar instead of a spinner that never changes.

const PORT = 4311;
app.listen(PORT, () => console.log(`Job progress tracking demo running on http://localhost:${PORT}`));
