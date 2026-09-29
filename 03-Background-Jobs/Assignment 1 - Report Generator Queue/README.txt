Assignment 1 - Report Generator Queue
========================================

You've now seen the five individual pieces: progress tracking, repeatable
jobs, failed-job inspection, priority, and concurrency. This assignment
combines the first three into one queue instead of five separate demo
servers - a report-generation service you could actually put behind a
"generate my report" button.

Description
-----------
A small Express + BullMQ project, split into server.js (routes) and
queue.js (the Queue + Worker, shared between the API and the background
processor):

  1. POST /reports - enqueues a "generate-report" job that reports
     progress in 25% steps as it runs.
  2. GET /reports/:jobId - returns the job's current state, progress,
     attempts made, and (once done) its return value or failure reason.
  3. POST /reports/fail-demo - enqueues a job that always throws, with
     3 attempts and exponential backoff, so you can watch it retry and
     land in the failed set.
  4. GET /reports/failed - lists every job in the failed set.
  5. A repeatable "cleanup-old-reports" job, registered on server start
     with a stable jobId, running every 60 seconds.

Requirements (all implemented in queue.js / server.js)
------------------------------------------------------
- The worker and the queue share one Queue instance (queue.js) so the API
  routes and the background processor never construct two separate,
  out-of-sync connections to the same Redis queue.
- The repeatable cleanup job MUST use a stable jobId when registered, so
  restarting the server doesn't create a second, duplicate schedule
  running alongside the first.
- The fail-demo job must actually exhaust its attempts (3, exponential
  backoff) and land in the failed set with a recorded failedReason -
  not swallow the error silently.
- job.progress must be readable from GET /reports/:jobId while the job is
  still running, not just after it completes.

Bonus (not yet implemented - extend the project with these)
--------------------------------------------------------------
- Add a priority option to POST /reports (e.g. an `urgent: true` flag that
  maps to priority: 1 vs the default priority: 10) so paying customers'
  reports jump the queue, following the pattern in 04-job-priority.js.
- Add DELETE /reports/failed/:jobId to remove a single failed job, and a
  scheduled cleanup (queue.clean()) so the failed set doesn't grow
  unbounded in a real deployment.
- Split queue.js's worker into its own separate process (a worker.js file
  run with `node worker.js` alongside `node server.js`) instead of one
  process doing both - closer to how a real production deployment
  separates API instances from worker instances so they can scale
  independently.
