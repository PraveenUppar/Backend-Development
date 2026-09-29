// Background Jobs 4 - Job Priority
// Builds on 03-failed-jobs-dead-letter.js.
// Needs: Redis running (docker run -d -p 6379:6379 redis)
// Run: node 04-job-priority.js
// Then: curl -X POST http://localhost:4314/reports/priority-demo  (then GET /reports/priority-order)

const express = require("express");
const { Queue, Worker } = require("bullmq");

const app = express();
app.use(express.json());

const connection = { host: "localhost", port: 6379 };
const reportQueue = new Queue("reports-priority", { connection });

const processedOrder = [];

// concurrency: 1 so processing order is easy to observe - with more than
// one worker slot, "which one went first" gets murkier since both could
// start almost simultaneously.
new Worker(
  "reports-priority",
  async (job) => {
    processedOrder.push(job.name);
  },
  { connection, concurrency: 1 }
);

// ============================================
// Job priority
// ============================================

// Lower number = higher priority (this trips people up - it's like process
// `nice` values, not "priority 10 beats priority 1"). Jobs with no priority
// set are treated as priority 0 and processed in plain FIFO order relative
// to each other; priority only affects ordering among WAITING jobs, it
// doesn't preempt a job already being processed.

app.post("/reports/priority-demo", async (req, res) => {
  // Pause first so both jobs are sitting in "waiting" together before the
  // worker touches either one - otherwise the worker might grab the first
  // job before the second is even added, and priority never gets a chance
  // to matter.
  await reportQueue.pause();
  await reportQueue.add("weekly-digest", {}, { priority: 10 }); // added first, goes LATER
  await reportQueue.add("password-reset", {}, { priority: 1 }); // added second, goes FIRST
  await reportQueue.resume();

  res.status(202).json({ success: true, data: "Enqueued weekly-digest (priority 10) then password-reset (priority 1)" });
});

app.get("/reports/priority-order", (req, res) => {
  // Expect ["password-reset", "weekly-digest"] even though weekly-digest
  // was added first - priority 1 beats priority 10.
  res.json({ success: true, data: processedOrder });
});

// Use this sparingly - if everything is high priority, nothing is.

const PORT = 4314;
app.listen(PORT, () => console.log(`Job priority demo running on http://localhost:${PORT}`));
