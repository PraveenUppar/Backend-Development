Assignment 1 - Blog Platform
==============================

You've now seen the four individual pieces: explicit many-to-many joins,
the migration workflow, seeding, and avoiding N+1 queries. This
assignment puts all four into one schema and one API - a small blog
where posts have tags (with a real join table, not a hidden one) and
comments, and every list/detail endpoint is N+1-safe by construction.

Description
-----------
An Express + Prisma API over Postgres with four models (User, Post, Tag,
PostTag, Comment):

  1. POST /posts - creates a post and links it to tags by name, upserting
     any tag that doesn't exist yet, all inside one $transaction.
  2. GET /posts - lists posts with author name, tag names, and comment
     count, in one query (the N+1-avoidance example).
  3. GET /posts/:id - a single post fully populated: author, tags, and
     comments with each comment's author.
  4. POST /posts/:id/comments - adds a comment to a post.

Setup: npm install, npx prisma migrate dev --name init, npx prisma db seed,
then node server.js.

Requirements (all implemented in schema.prisma / server.js / prisma/seed.js)
------------------------------------------------------------------------------
- Post<->Tag MUST use an explicit join model (PostTag) with a taggedAt
  field, not Prisma's implicit many-to-many - because the ability to
  record and query taggedAt is the whole point of this schema.
- Tag creation on POST /posts must use upsert, not
  findFirst-then-create, so two posts sharing a brand-new tag name don't
  race into a unique-constraint error.
- schema.prisma's header comment must describe how this schema would
  land as two separate migrations (init, then add-comments) in a real
  project timeline, even though it's applied as one migration here.
- Every list/detail endpoint must fetch relations via select/include on
  the original query - no route may contain a loop that calls
  `await prisma.<model>.findX()` per iteration.
- prisma/seed.js must be safe to re-run: delete children before parents
  (comments and postTags before posts and tags, tags/posts before users),
  then insert fresh known data.

Bonus (not yet implemented - extend the project with these)
--------------------------------------------------------------
- Add a GET /tags/:name/posts endpoint that returns every post with a
  given tag, ordered by taggedAt descending - a query that's natural with
  the explicit join model and awkward without it.
- Add a second migration by hand: introduce a `Like` model (postId,
  userId, composite @@id) as `npx prisma migrate dev --name add-likes`
  run AFTER the initial migration already exists, so you see a real
  second migrations/ folder appear rather than one schema applied once.
- Rewrite prisma/seed.js using the upsert-based approach from
  practice/practice2.js so re-running it doesn't wipe existing data,
  and note in a comment what breaks (Post has no unique field to upsert
  on) and how you worked around it.
