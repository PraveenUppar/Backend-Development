// Practice 2: Idempotent Seeding with upsert (topic 03)
// Needs: the schema from ../Assignment 1 - Blog Platform/prisma/schema.prisma
// migrated first - run this file FROM INSIDE that project folder (or copy
// its prisma/ folder next to this file).
// Run: node ../practice/practice2.js  (from Blog Platform/, no server - just a script)

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Exercise: the Assignment's prisma/seed.js wipes every table before
// re-inserting (deleteMany, then create). That's simple but destroys any
// data added since the last seed. Rewrite the same seed data using upsert
// instead, so running this twice in a row leaves exactly the same rows
// both times, without ever deleting anything.

async function main() {
  const nodeTag = await prisma.tag.upsert({
    where: { name: "node" },
    update: {},
    create: { name: "node" },
  });

  const praveen = await prisma.user.upsert({
    where: { email: "praveen@example.com" },
    update: { name: "Praveen" },
    create: { name: "Praveen", email: "praveen@example.com" },
  });

  // Post has no natural unique field to upsert on (title isn't @unique),
  // so this is where upsert-everywhere breaks down - findFirst-then-create
  // is the honest fallback, and it's worth noticing WHY: upsert needs a
  // unique constraint to key off of, and not every model has one that
  // makes sense for seed data.
  const existingPost = await prisma.post.findFirst({
    where: { title: "Why I switched from raw SQL to Prisma", authorId: praveen.id },
  });
  const post =
    existingPost ??
    (await prisma.post.create({
      data: {
        title: "Why I switched from raw SQL to Prisma",
        body: "Typed queries caught three bugs before I even ran the code...",
        authorId: praveen.id,
        tags: { create: [{ tagId: nodeTag.id }] },
      },
    }));

  console.log(`Upserted user ${praveen.name}, tag ${nodeTag.name}, post #${post.id}`);
  console.log("Run this script again - the counts should NOT change, unlike the delete-then-create seed.js.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
