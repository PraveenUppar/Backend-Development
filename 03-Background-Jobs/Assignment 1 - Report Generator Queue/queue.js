// queue.js - the Redis connection, the Queue, and the Worker that processes jobs.
// Split out from server.js so both the API routes and the worker share the
// same Queue instance (in a real app the worker often lives in its own
// process/file entirely - here it's one process for simplicity of the demo).

require("dotenv").config();
const { Queue, Worker } = require("bullmq");

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// BullMQ wants a connection object, not a URL string directly for the
// Queue/Worker constructors - parse it out. (ioredis, which BullMQ uses
// under the hood, CAN take a URL too, but keeping it explicit here.)
const url = new URL(REDIS_URL);
const connection = {
  host: url.hostname,
  port: Number(url.port) || 6379,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const reportQueue = new Queue("reports", { connection });

// ============================================
// The worker - this is what actually runs the jobs
// ============================================

const reportWorker = new Worker(
  "reports",
  async (job) => {
    if (job.name === "generate-report") {
      // Simulate a multi-stage report build, reporting progress at each stage.
      // A real version of this might be: query DB -> aggregate -> render PDF -> upload to S3.
      console.log(`[worker] starting report job ${job.id}`);

      await sleep(1000);
      await job.updateProgress(25);

      await sleep(1000);
      await job.updateProgress(50);

      await sleep(1000);
      await job.updateProgress(75);

      await sleep(1000);
      await job.updateProgress(100);

      console.log(`[worker] finished report job ${job.id}`);
      return { reportUrl: `https://example.com/reports/${job.id}.pdf` };
    }

    if (job.name === "generate-report-fail-demo") {
      // Always throws - this is here so you can watch attempts/backoff/failure
      // actually happen instead of reading about them. With attempts: 3 and
      // exponential backoff (set where this job is enqueued), you'll see this
      // run 3 times total, each further apart, before it lands in getFailed().
      console.log(
        `[worker] fail-demo job ${job.id}, attempt ${job.attemptsMade + 1}`,
      );
      throw new Error("Report generation exploded on purpose (demo)");
    }

    if (job.name === "cleanup-old-reports") {
      // The repeatable job's actual work. Kept trivial on purpose - the point
      // of this demo is the SCHEDULING, not the cleanup logic itself.
      console.log(
        `[worker] running scheduled cleanup at ${new Date().toISOString()}`,
      );
      return { cleaned: true };
    }

    throw new Error(`Unknown job name: ${job.name}`);
  },
  {
    connection,
    concurrency: 5, // process up to 5 jobs at once (these are I/O-ish/simulated, fine to parallelize)
  },
);

reportWorker.on("failed", (job, err) => {
  console.error(`[worker] job ${job.id} (${job.name}) failed: ${err.message}`);
});

reportWorker.on("progress", (job, progress) => {
  console.log(`[worker] job ${job.id} progress -> ${progress}%`);
});

// ============================================
// Repeatable job - BullMQ's own scheduler (see ../Notes.txt topic 2)
// ============================================

async function registerRepeatableCleanup() {
  await reportQueue.add(
    "cleanup-old-reports",
    {},
    {
      repeat: { every: 60_000 }, // every 60 seconds
      jobId: "cleanup-old-reports-schedule", // stable id so re-running this doesn't duplicate the schedule
    },
  );
  console.log("[queue] registered repeatable cleanup job (every 60s)");
}

// To remove this later (e.g. before changing the schedule), from anywhere
// that has `reportQueue`:
//
//   const repeatables = await reportQueue.getRepeatableJobs();
//   for (const r of repeatables) {
//     await reportQueue.removeRepeatableByKey(r.key);
//   }
//
// You have to remove-and-re-add to CHANGE a schedule - there's no "update".

module.exports = { reportQueue, reportWorker, connection, registerRepeatableCleanup };
