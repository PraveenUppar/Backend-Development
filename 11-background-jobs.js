// Background Jobs - node-cron + BullMQ (needs Redis for the queue part)
// Needs: Redis running (docker run -d -p 6379:6379 redis) for the BullMQ section
// Run: node 11-background-jobs.js
// Then: curl -X POST http://localhost:4011/signup -H "Content-Type: application/json" -d "{\"email\":\"*a@a.com\"}"

const express = require("express");
const cron = require("node-cron");
const { Queue, Worker } = require("bullmq");

const app = express();
app.use(express.json());

// ============================================
// Why background jobs?
// ============================================

// Some work shouldn't block the HTTP response: sending a welcome email,
// generating a report, resizing an uploaded image. Make the request
// return fast, and do the slow work "in the background" instead.

// ============================================
// node-cron - scheduled, repeating tasks (like a cron job in Node)
// ============================================

// Runs every minute. Cron syntax: "minute hour day month weekday"
cron.schedule("* * * * *", () => {
  console.log(
    `[cron] Cleaning up expired sessions at ${new Date().toISOString()}`,
  );
  // e.g. await Session.deleteMany({ expiresAt: { $lt: new Date() } });
});

// Every day at 2:00 AM: "0 2 * * *"
// Every Monday at 9:00 AM: "0 9 * * 1"

// ============================================
// BullMQ - a real job QUEUE backed by Redis (survives restarts, retries failures)
// ============================================

// node-cron is good for "run this on a schedule". A queue is better for
// "run this once, triggered by an event, possibly retried if it fails" -
// e.g. "send this specific welcome email" triggered by a signup.

const connection = { host: "localhost", port: 6379 };

const emailQueue = new Queue("emails", { connection });

// The worker is the process that actually consumes jobs from the queue.
// In a real app this often runs as a SEPARATE process/container from the
// API server, so a slow job never competes with API requests for CPU.
const emailWorker = new Worker(
  "emails",
  async (job) => {
    console.log(`[worker] Sending ${job.name} to ${job.data.email}...`);
    await new Promise((resolve) => setTimeout(resolve, 500)); // simulate sending
    console.log(`[worker] Sent to ${job.data.email}`);
  },
  { connection },
);

emailWorker.on("failed", (job, err) => {
  console.error(`[worker] Job ${job.id} failed: ${err.message}`);
});

// ============================================
// Enqueue a job instead of doing the work inline
// ============================================

app.post("/signup", async (req, res) => {
  const { email } = req.body;

  // ... imagine the user is actually saved to the database here ...

  // Don't await the email being sent - just queue it and respond immediately.
  await emailQueue.add(
    "welcome-email",
    { email },
    { attempts: 3, backoff: { type: "exponential", delay: 2000 } }, // retry on failure
  );

  res
    .status(201)
    .json({ success: true, message: "Signed up. Welcome email queued." });
});

const PORT = 4011;
app.listen(PORT, () =>
  console.log(`Background jobs demo running on http://localhost:${PORT}`),
);
