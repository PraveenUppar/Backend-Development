// Practice 3: Measuring N+1 (topic 04)
// Needs: the schema from ../Assignment 1 - Blog Platform/prisma/schema.prisma
// migrated and seeded first - run this file FROM INSIDE that project
// folder (or copy its prisma/ folder next to this file).
// Run: node ../practice/practice3.js  (from Blog Platform/, no server - just a script)

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [{ level: "query", emit: "event" }] });

// Exercise: don't just take "N+1 is bad" on faith - count the actual
// queries each approach issues against the same seeded data, so the
// difference is a number, not a feeling.

let queryCount = 0;
prisma.$on("query", () => {
  queryCount += 1;
});

async function badApproach() {
  queryCount = 0;
  const posts = await prisma.post.findMany();
  for (const post of posts) {
    post.author = await prisma.user.findUnique({ where: { id: post.authorId } }); // 1 extra query per post
  }
  return { postCount: posts.length, queries: queryCount };
}

async function goodApproach() {
  queryCount = 0;
  const posts = await prisma.post.findMany({
    select: { id: true, title: true, author: { select: { name: true } } },
  });
  return { postCount: posts.length, queries: queryCount };
}

async function main() {
  const bad = await badApproach();
  console.log(`BAD (loop):   ${bad.postCount} posts -> ${bad.queries} queries`);

  const good = await goodApproach();
  console.log(`GOOD (select): ${good.postCount} posts -> ${good.queries} query`);

  console.log(
    `\nSame data, ${bad.queries - good.queries} fewer queries with select/include - and the gap only grows as posts grow.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
