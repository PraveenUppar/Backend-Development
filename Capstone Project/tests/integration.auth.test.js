// Integration tests for /auth - real Express app (server.js), real routes,
// real Mongoose models, backed by the ephemeral MongoDB started in
// tests/setup.js. Unlike pricing.test.js/validation.test.js (pure unit
// tests, see Testing\Notes.txt), these go through the actual HTTP request
// path: middleware, validation, bcrypt, JWT, and a real database write.

const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../server");
const User = require("../models/User");

const credentials = { name: "Praveen", email: "praveen@example.com", password: "secret123" };

describe("POST /auth/signup", () => {
  it("creates the user and hashes the password (never stores it in plaintext)", async () => {
    const res = await request(app).post("/auth/signup").send(credentials);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(credentials.email);
    expect(res.body.data.passwordHash).toBeUndefined(); // response never leaks the hash either

    const stored = await User.findOne({ email: credentials.email });
    expect(stored).not.toBeNull();
    expect(stored.passwordHash).not.toBe(credentials.password);
    expect(await bcrypt.compare(credentials.password, stored.passwordHash)).toBe(true);
  });

  it("rejects a second signup with the same email", async () => {
    await request(app).post("/auth/signup").send(credentials);

    const res = await request(app).post("/auth/signup").send(credentials);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already registered/i);
  });
});

describe("POST /auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/auth/signup").send(credentials);
  });

  it("logs in with the correct password and returns a token", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: credentials.email, password: credentials.password });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.token).toBe("string");
    expect(res.body.data.token.length).toBeGreaterThan(0);
  });

  it("rejects an incorrect password", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: credentials.email, password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe("GET /auth/me (protected route)", () => {
  it("rejects a request with no token", async () => {
    const res = await request(app).get("/auth/me");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("returns the current user for a request with a valid token", async () => {
    await request(app).post("/auth/signup").send(credentials);
    const login = await request(app)
      .post("/auth/login")
      .send({ email: credentials.email, password: credentials.password });
    const token = login.body.data.token;

    const res = await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(credentials.email);
    expect(res.body.data.passwordHash).toBeUndefined(); // route explicitly excludes it with .select("-passwordHash")
  });
});
