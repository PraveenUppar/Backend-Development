// Practice 1: Priority-Aware Encoding Queue (topics 01 + 04)
// Needs: Redis running (docker run -d -p 6379:6379 redis)
// Run: node practice/practice1.js
// Then: curl -X POST http://localhost:4321/encode -H "Content-Type: application/json" -d "{\"videoId\":\"v1\",\"plan\":\"free\"}"

const express = require("express");
const { Queue, Worker } = require("bullmq");

const app = express();
app.use(express.json());

const connection = { host: "localhost", port: 6379 };
const encodeQueue = new Queue("video-encoding", { connection });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Exercise: paid-plan customers' videos should encode before free-plan
// ones queued earlier, and every job should report progress so a UI can
// show "encoding: 60%" instead of a static spinner.

new Worker(
  "video-encoding",
  async (job) => {
    await job.updateProgress(50);
    await sleep(500);
    await job.updateProgress(100);
    return { videoId: job.data.videoId, encodedAt: new Date().toISOString() };
  },
  { connection, concurrency: 1 }
);

app.post("/encode", async (req, res) => {
  const { videoId, plan } = req.body;
  // paid plans jump the queue: priority 1 vs 10 for free (lower number = first)
  const priority = plan === "paid" ? 1 : 10;
  const job = await encodeQueue.add("encode-video", { videoId }, { priority });
  res.status(202).json({ success: true, data: { jobId: job.id, priority } });
});

app.get("/encode/:jobId", async (req, res) => {
  const job = await encodeQueue.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, message: "Job not found" });
  res.json({ success: true, data: { state: await job.getState(), progress: job.progress } });
});

const PORT = 4321;
app.listen(PORT, () => console.log(`Practice 1 running on http://localhost:${PORT}`));
