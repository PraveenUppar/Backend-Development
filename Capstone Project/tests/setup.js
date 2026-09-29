// Jest global setup for the integration tests (integration.*.test.js).
//
// Spins up a REAL, temporary MongoDB via mongodb-memory-server - no Docker,
// no external Mongo needed. We use MongoMemoryReplSet (not the simpler
// MongoMemoryServer) specifically because orders.routes.js's checkout route
// runs a multi-document transaction, and MongoDB transactions only work
// against a replica set, not a standalone instance - a single-node replica
// set is the smallest thing that supports them.
//
// Wired in via package.json's jest.setupFilesAfterEnv, so this runs
// automatically before every test file - no test file needs to require it.

const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

let replSet;

// Starting a real mongod (first run also downloads the binary) is slow -
// give it much more room than Jest's default 5s test timeout.
jest.setTimeout(120000);

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  await mongoose.connect(uri);
});

// Clear every collection's documents after EACH test (not just at the end
// of a file) so one test's leftover data never leaks into the next test -
// whether that next test is in the same file or a different one sharing
// this same in-memory instance. We keep the collections/indexes themselves
// (deleteMany, not dropDatabase) since recreating indexes every test is
// unnecessary work.
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});
