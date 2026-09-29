Assignment 1 - Webhook Dispatcher
====================================

You've now seen the four individual pieces: HMAC signing, replay
protection, receiver-side idempotency, and sender-side retries with
backoff. This assignment combines all four into a real two-process
system - a dispatcher (sender) and a receiver (subscriber) that actually
talk to each other over HTTP, instead of one process simulating both
sides.

Description
-----------
Two separate Express apps:

  1. dispatcher.js - the sender. POST /webhooks/register subscribes a URL
     to an event type; POST /webhooks/trigger-demo-event fires a fake
     "order.paid" event to every matching subscriber, signed and
     delivered with retry+backoff.
  2. receiver.js - the subscriber. POST /webhooks/incoming verifies the
     signature and timestamp, dedupes by event id, and stores accepted
     events; GET /webhooks/received lists what it has accepted.

How to run it
--------------
1. Install deps once (from this folder): npm install
2. Copy .env.example to .env (both apps read the same file - matching
   WEBHOOK_SECRET, different ports).
3. Start the receiver in one terminal: npm run receiver
4. Start the dispatcher in another terminal: npm run dispatcher
5. Register the receiver as a subscriber:
   curl -X POST http://localhost:4201/webhooks/register -H "Content-Type: application/json" -d "{\"url\":\"http://localhost:4202/webhooks/incoming\",\"eventType\":\"order.paid\"}"
6. Fire the demo event end to end:
   curl -X POST http://localhost:4201/webhooks/trigger-demo-event
   Watch the dispatcher terminal log the signed delivery, and the
   receiver terminal log accepting it.
7. Check what the receiver has stored: curl http://localhost:4202/webhooks/received

To see the invalid-signature / replay-rejection paths, post directly to
the receiver without going through the dispatcher:
   curl -X POST http://localhost:4202/webhooks/incoming -H "Content-Type: application/json" -H "X-Webhook-Signature: bogus" -H "X-Webhook-Timestamp: 1000000000000" -d "{\"id\":\"fake\",\"type\":\"order.paid\",\"payload\":{}}"

Requirements (all implemented in dispatcher.js / receiver.js)
------------------------------------------------------------------
- Every outgoing payload is signed over "timestamp.body" (timestamp
  INSIDE the signed string, not a separate unsigned field).
- The receiver verifies with crypto.timingSafeEqual, never `===`, and
  rejects anything older than MAX_AGE_MS even with a valid signature.
- The receiver reads the raw request body (express.raw()), not
  express.json() - re-serializing a parsed object can reorder keys and
  break a genuinely valid signature.
- Every fired event gets a fresh crypto.randomUUID() id; the receiver
  dedupes on that id and still returns 200 for a duplicate so the
  dispatcher doesn't keep retrying something it already accepted.
- Delivery to multiple subscribers happens in parallel (Promise.all), so
  one slow/dead subscriber doesn't delay delivery to the others; each
  delivery independently retries up to 3 times with exponential backoff.

Bonus (not yet implemented - extend the project with these)
--------------------------------------------------------------
- Persist `subscriptions` to a file or database instead of an in-memory
  array, so registrations survive a dispatcher restart.
- Give each subscriber its OWN secret (instead of one shared SECRET for
  everyone) so a leaked secret only compromises one subscriber's
  deliveries, following the multi-tenant pattern real providers use.
- Add a DELETE /webhooks/register endpoint and an "unregister on
  repeated delivery failure" policy (e.g. after 10 consecutive failed
  deliveries to the same URL, stop trying and mark the subscription
  disabled) instead of retrying forever on a permanently dead endpoint.
