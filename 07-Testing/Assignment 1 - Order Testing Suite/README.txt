Assignment 1 - Order Testing Suite
=====================================

You've now seen the four individual pieces: unit vs integration,
mongodb-memory-server, mocking an external SDK, and test isolation. This
assignment is where they combine, AND where the app and its tests are
finally separated into their own files (app.js / tests/orders.test.js)
the way a real project is structured, instead of one file mixing both for
convenience like 01-04 do.

Description
-----------
A small orders API (app.js): POST /orders creates an order, GET /orders
lists them, POST /orders/:id/checkout marks an order paid via a (mocked
in tests) Stripe payment intent. tests/orders.test.js tests all three
routes against a real temporary MongoDB with Stripe mocked out.

Setup: npm install, then npm test.

Requirements (all implemented in tests/orders.test.js)
------------------------------------------------------------
- Every test is an integration test (real Express app, real routes, real
  temp Mongo via supertest + mongodb-memory-server) - there is no unit
  test in this suite, because app.js has no pure business-logic function
  worth isolating on its own (see 01-unit-vs-integration.js for what one
  would look like if it did).
- mongod starts ONCE in beforeAll (with a generous 60s timeout for a
  first-time binary download) and stops ONCE in afterAll - not per test.
- Stripe is mocked via jest.mock("stripe") before app.js is required, so
  no test ever makes a real network call, and the checkout test asserts
  on the EXACT arguments passed to the mocked paymentIntents.create.
- Order.deleteMany({}) runs in afterEach, and a dedicated "test
  isolation" describe block proves it - two tests that both expect an
  empty collection, run after other tests already created orders.
- A checkout against a non-existent order id returns 404, not a crash.

Bonus (not yet implemented - extend the project with these)
--------------------------------------------------------------
- Pull calculateOrderTotal-style logic out of a route and into its own
  function if you add multi-item orders, then add a real unit test for it
  next to the integration tests, following 01-unit-vs-integration.js.
- Add a test for Stripe REJECTING the payment intent (mockRejectedValueOnce)
  and assert the order is NOT marked paid when that happens - today the
  route has no try/catch around the stripe.paymentIntents.create call, so
  this bonus starts by finding and fixing that gap.
- Add a jest.config.js with testEnvironment and a coverage threshold, and
  wire `npm test` to fail CI if coverage drops below it.
