// Practice 2: Correlating a Background Job Instead of a Request (topic 03)
// Run: node practice/practice2.js
// Then: curl -X POST http://localhost:4822/jobs/send-report

const express = require("express");
const pino = require("pino");
const { AsyncLocalStorage } = require("node:async_hooks");
const crypto = require("crypto");

const app = express();
app.use(express.json());
const logger = pino({ transport: { target: "pino-pretty", options: { colorize: true } } });

// Exercise: 03-async-local-storage-correlation.js correlates one HTTP
// request. A background job (no req/res at all) needs the same thing - a
// jobId that every step of processing it can log, without threading a
// parameter through each step. AsyncLocalStorage doesn't care that
// there's no HTTP request involved; .run() just needs SOME async block to
// wrap.

const als = new AsyncLocalStorage();

function getJobId() {
  return als.getStore()?.jobId;
}

function fetchReportData() {
  logger.info({ jobId: getJobId() }, "fetching report data");
}
function renderReport() {
  fetchReportData();
  logger.info({ jobId: getJobId() }, "rendering report");
}
function uploadReport() {
  renderReport();
  logger.info({ jobId: getJobId() }, "uploading report");
}

async function runJob() {
  const jobId = crypto.randomUUID();
  await als.run({ jobId }, async () => {
    uploadReport(); // 3 calls deep, none take jobId as a parameter
  });
  return jobId;
}

app.post("/jobs/send-report", async (req, res) => {
  const jobId = await runJob();
  res.status(202).json({ success: true, data: { jobId } });
});

const PORT = 4822;
app.listen(PORT, () => logger.info(`Practice 2 running on http://localhost:${PORT}`));
