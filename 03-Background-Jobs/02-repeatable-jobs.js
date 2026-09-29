// Background Jobs 2 - Repeatable Jobs
// Builds on 01-job-progress-tracking.js.
// Needs: Redis running (docker run -d -p 6379:6379 redis)
// Run: node 02-repeatable-jobs.js
// Then: curl http://localhost:4312/reports/repeatables

const express = require("express");
const { Queue, Worker } = require("bullmq");

const app = express();
app.use(express.json());

const connection = { host: "localhost", port: 6379 };
const reportQueue = new Queue("reports-repeatable", { connection });

new Worker(
  "reports-repeatable",
  async (job) => {
    if (job.name === "cleanup-expired-sessions") {
      console.log(`[cron-like job] cleaning up expired sessions at ${new Date().toISOString()}`);
    }
  },
  { connection }
);

// ============================================
// Repeatable jobs (BullMQ's own scheduler, as an alternative to node-cron)
// ============================================

// node-cron runs inside your Node process, on your process's clock, with no
// persistence - if you run 3 instances of your API, the cron job runs 3
// times. BullMQ's `repeat` option instead stores the schedule IN REDIS, and
// only ONE worker across your whole fleet picks up each scheduled run.

async function registerCleanupJob() {
  await reportQueue.add(
    "cleanup-expired-sessions",
    {},
    { repeat: { every: 60_000 }, jobId: "cleanup-expired-sessions-schedule" } // stable jobId - see note below
  );
}
registerCleanupJob();

// When to pick which:
//   - node-cron: single-process app, no Redis dependency wanted, fine to
//     silently skip a run occasionally.
//   - BullMQ repeat: multiple instances running (so you need exactly-once
//     scheduling), you want retries/backoff like any other job, or you want
//     it visible in the same queue as your other background work.
//
// A stable jobId when registering a repeatable job matters: without it,
// restarting this file re-registers the same schedule under a new internal
// key, and you end up with duplicate schedules both firing. Always list
// before you add if you're not sure one already exists:

app.get("/reports/repeatables", async (req, res) => {
  const repeatables = await reportQueue.getRepeatableJobs();
  res.json({ success: true, data: repeatables });
});

// removing one: await reportQueue.removeRepeatableByKey(repeatables[0].key);

const PORT = 4312;
app.listen(PORT, () => console.log(`Repeatable jobs demo running on http://localhost:${PORT}`));
