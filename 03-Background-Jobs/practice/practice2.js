// Practice 2: Repeatable Job Alongside Concurrent Ad-Hoc Jobs (topics 02 + 05)
// Needs: Redis running (docker run -d -p 6379:6379 redis)
// Run: node practice/practice2.js
// Then: curl -X POST http://localhost:4322/sync-inventory -H "Content-Type: application/json" -d "{\"sku\":\"abc-123\"}"

const express = require("express");
const { Queue, Worker } = require("bullmq");

const app = express();
app.use(express.json());

const connection = { host: "localhost", port: 6379 };
const inventoryQueue = new Queue("inventory-sync", { connection });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Exercise: a repeatable "full sync" job runs every 60s, while ad-hoc
// "sync one SKU" requests can come in any time and should run alongside
// it without waiting - concurrency: 3 lets the worker handle a scheduled
// run and a couple of ad-hoc requests at once instead of queuing behind it.

new Worker(
  "inventory-sync",
  async (job) => {
    if (job.name === "full-sync") {
      console.log(`[scheduled] full inventory sync at ${new Date().toISOString()}`);
      await sleep(500);
      return;
    }
    if (job.name === "sync-sku") {
      await sleep(200); // simulate a quick per-SKU stock check
      return { sku: job.data.sku, syncedAt: new Date().toISOString() };
    }
  },
  { connection, concurrency: 3 }
);

async function registerFullSync() {
  await inventoryQueue.add("full-sync", {}, { repeat: { every: 60_000 }, jobId: "full-sync-schedule" });
}
registerFullSync();

app.post("/sync-inventory", async (req, res) => {
  const job = await inventoryQueue.add("sync-sku", { sku: req.body.sku });
  res.status(202).json({ success: true, data: { jobId: job.id } });
});

app.get("/sync-inventory/schedule", async (req, res) => {
  const repeatables = await inventoryQueue.getRepeatableJobs();
  res.json({ success: true, data: repeatables });
});

const PORT = 4322;
app.listen(PORT, () => console.log(`Practice 2 running on http://localhost:${PORT}`));
