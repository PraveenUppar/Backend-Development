// Practice 2: Proving Isolation Breaks WITHOUT afterEach (topic 04)
// Run: npx jest practice/practice2.js
// Needs: jest, supertest, mongoose, mongodb-memory-server

const express = require("express");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

// Exercise: 04-test-isolation.js shows isolation WORKING (with afterEach).
// This file deliberately OMITS afterEach to show the failure mode it
// prevents - the second test fails because the first test's document is
// still there. Seeing the red test is the point: it's the concrete proof
// that afterEach isn't just boilerplate.

const noteSchema = new mongoose.Schema({ text: String });
const Note = mongoose.models.PracticeNote || mongoose.model("PracticeNote", noteSchema);

function createApp() {
  const app = express();
  app.use(express.json());
  app.post("/notes", async (req, res) => {
    res.status(201).json({ success: true, data: await Note.create({ text: req.body.text }) });
  });
  app.get("/notes", async (req, res) => {
    res.json({ success: true, data: await Note.find() });
  });
  return app;
}

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = createApp();
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

// No afterEach here on purpose - see the comment above.

describe("missing isolation (expected to demonstrate the leak, not to pass cleanly)", () => {
  it("creates a note in this test", async () => {
    await request(app).post("/notes").send({ text: "first" });
    const res = await request(app).get("/notes");
    expect(res.body.data).toHaveLength(1);
  });

  it("would need 0 here, but sees 1 leftover from the test above - this is the bug afterEach fixes", async () => {
    const res = await request(app).get("/notes");
    // Written to match what ACTUALLY happens without cleanup, so the suite
    // is green - but read the count: it's 1, not 0, because nothing wiped
    // the collection between tests. Change this to toHaveLength(0) and
    // watch it fail, then add an afterEach(() => Note.deleteMany({})) like
    // 04-test-isolation.js does and watch it pass with 0.
    expect(res.body.data).toHaveLength(1);
  });
});
