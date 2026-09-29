// Report Generator Queue - BullMQ deep-dive project
// Needs: Redis running (docker run -d -p 6379:6379 redis)
// Run: node server.js
//
// Try it:
//   curl -X POST http://localhost:4101/reports
//   -> copy the jobId, then poll:
//   curl http://localhost:4101/reports/<jobId>
//
//   curl -X POST http://localhost:4101/reports/fail-demo
//   -> wait ~15s (3 attempts with exponential backoff), then:
//   curl http://localhost:4101/reports/failed

require("dotenv").config();
const express = require("express");
const { reportQueue, registerRepeatableCleanup } = require("./queue");

const app = express();
app.use(express.json());

// ============================================
// Enqueue a report job
// ============================================

app.post("/reports", async (req, res) => {
  const job = await reportQueue.add(
    "generate-report",
    { requestedBy: req.body.requestedBy || "anonymous" },
    { attempts: 1 }, // this one isn't meant to fail, no retry needed
  );

  res.status(202).json({ success: true, data: { jobId: job.id } });
});

// ============================================
// Deliberately failing job - always throws, has attempts + backoff so you
// can watch it retry and eventually land in the failed set.
// ============================================

app.post("/reports/fail-demo", async (req, res) => {
  const job = await reportQueue.add(
    "generate-report-fail-demo",
    {},
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 }, // 2s, then 4s, then 8s between attempts
    },
  );

  res.status(202).json({
    success: true,
    data: { jobId: job.id, message: "This job always fails - watch it retry 3 times." },
  });
});

// ============================================
// Check status + progress of a job
// ============================================

app.get("/reports/:jobId", async (req, res) => {
  const job = await reportQueue.getJob(req.params.jobId);

  if (!job) {
    return res.status(404).json({ success: false, message: "Job not found" });
  }

  const state = await job.getState(); // "waiting" | "active" | "completed" | "failed" | "delayed" | ...

  res.json({
    success: true,
    data: {
      id: job.id,
      name: job.name,
      state,
      progress: job.progress, // whatever job.updateProgress() last set - number or object
      attemptsMade: job.attemptsMade,
      returnValue: job.returnvalue, // set once the job completes
      failedReason: job.failedReason, // set once the job fails for good
    },
  });
});

// ============================================
// Inspect failed jobs - the closest thing BullMQ has to a dead-letter queue
// (see ../Notes.txt topic 3 - it's really just the "failed" set on this
// same queue, queryable until something cleans it up)
// ============================================

app.get("/reports/failed", async (req, res) => {
  const failedJobs = await reportQueue.getFailed();

  res.json({
    success: true,
    data: failedJobs.map((job) => ({
      id: job.id,
      name: job.name,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      timestamp: job.timestamp,
    })),
  });
});

const PORT = process.env.PORT || 4101;

app.listen(PORT, async () => {
  console.log(`Report Generator Queue running on http://localhost:${PORT}`);
  await registerRepeatableCleanup();
});
