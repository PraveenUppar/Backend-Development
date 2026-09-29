// Testing APIs with Jest + Supertest
// Run: npx jest 15-testing-apis.js
// (this file both DEFINES a small app AND tests it, to keep the demo in one file -
//  in a real project the app lives in app.js and the test lives in app.test.js)

const express = require("express");

// ============================================
// The app under test
// ============================================

function createApp() {
  const app = express();
  app.use(express.json());

  const tasks = [{ id: 1, title: "Learn testing", done: false }];

  app.get("/tasks", (req, res) => {
    res.json({ success: true, data: tasks });
  });

  app.post("/tasks", (req, res) => {
    if (!req.body.title) {
      return res
        .status(400)
        .json({ success: false, message: "Title is required" });
    }
    const task = { id: tasks.length + 1, title: req.body.title, done: false };
    tasks.push(task);
    res.status(201).json({ success: true, data: task });
  });

  app.get("/tasks/:id", (req, res) => {
    const task = tasks.find((t) => t.id === Number(req.params.id));
    if (!task)
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    res.json({ success: true, data: task });
  });

  return app;
}

module.exports = createApp;

// ============================================
// Tests - only run when this file is executed by Jest, not by `node`
// ============================================

const request = require("supertest");
const app = createApp();

describe("GET /tasks", () => {
  it("returns the list of tasks", async () => {
    const res = await request(app).get("/tasks");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe("POST /tasks", () => {
  it("creates a task when title is provided", async () => {
    const res = await request(app)
      .post("/tasks")
      .send({ title: "Write tests" });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe("Write tests");
  });

  it("rejects a task with no title", async () => {
    const res = await request(app).post("/tasks").send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe("GET /tasks/:id", () => {
  it("returns 404 for a task that doesn't exist", async () => {
    const res = await request(app).get("/tasks/999");
    expect(res.status).toBe(404);
  });

  it("returns the task when it exists", async () => {
    const res = await request(app).get("/tasks/1");
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(1);
  });
});
