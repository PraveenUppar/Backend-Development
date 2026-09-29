// Practice 3: Idempotency That Survives a Restart (topic 03)
// Run: node practice/practice3.js
// Then: curl -X POST http://localhost:4523/demo/process -H "Content-Type: application/json" -d "{\"id\":\"evt_1\",\"type\":\"order.paid\"}" (send twice, then restart and send evt_1 again)

const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

// Exercise: 03-idempotency-receiver.js uses an in-memory Set, which loses
// every seen event id on restart - exactly the gap its own comments warn
// about. This version persists seen ids to a JSON file, so the dedup
// survives a process restart (a real system would use a database/Redis
// instead of a file, but the shape of the fix is the same: durable
// storage instead of memory).

const STORE_PATH = path.join(__dirname, ".seen-events.json");

function loadSeenIds() {
  try {
    return new Set(JSON.parse(fs.readFileSync(STORE_PATH, "utf8")));
  } catch {
    return new Set(); // file doesn't exist yet on first run
  }
}

function saveSeenIds(set) {
  fs.writeFileSync(STORE_PATH, JSON.stringify([...set]));
}

const seenEventIds = loadSeenIds();

app.post("/demo/process", (req, res) => {
  const event = req.body;

  if (seenEventIds.has(event.id)) {
    return res.status(200).json({ success: true, data: { alreadyProcessed: true } });
  }

  seenEventIds.add(event.id);
  saveSeenIds(seenEventIds); // persisted BEFORE responding, so a crash right after doesn't lose the record
  console.log(`Processing event ${event.id}: ${event.type}`);

  res.status(200).json({ success: true, data: { alreadyProcessed: false } });
});

const PORT = 4523;
app.listen(PORT, () => console.log(`Practice 3 running on http://localhost:${PORT}`));
