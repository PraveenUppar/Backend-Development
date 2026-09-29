// Seeds a few users, posts (with tags via the explicit PostTag join model),
// and comments. Run with: npx prisma db seed
// (also runs automatically after `npx prisma migrate reset`)

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // Wipe existing data so this is safe to re-run (order matters - children first).
  await prisma.comment.deleteMany();
  await prisma.postTag.deleteMany();
  await prisma.post.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.user.deleteMany();

  const [praveen, asha, ravi] = await Promise.all([
    prisma.user.create({ data: { name: "Praveen", email: "praveen@example.com" } }),
    prisma.user.create({ data: { name: "Asha", email: "asha@example.com" } }),
    prisma.user.create({ data: { name: "Ravi", email: "ravi@example.com" } }),
  ]);

  const [nodeTag, dbTag, careerTag] = await Promise.all([
    prisma.tag.create({ data: { name: "node" } }),
    prisma.tag.create({ data: { name: "databases" } }),
    prisma.tag.create({ data: { name: "career" } }),
  ]);

  const post1 = await prisma.post.create({
    data: {
      title: "Why I switched from raw SQL to Prisma",
      body: "Typed queries caught three bugs before I even ran the code...",
      published: true,
      authorId: praveen.id,
      tags: {
        create: [
          { tagId: nodeTag.id },
          { tagId: dbTag.id },
        ],
      },
    },
  });

  const post2 = await prisma.post.create({
    data: {
      title: "Explicit join tables aren't scary",
      body: "Once you need extra fields on a relationship, implicit many-to-many stops being enough...",
      published: true,
      authorId: asha.id,
      tags: {
        create: [{ tagId: dbTag.id }],
      },
    },
  });

  await prisma.post.create({
    data: {
      title: "Notes from my first backend interview loop",
      body: "Nobody asked me to reverse a linked list, they asked how I'd design a rate limiter...",
      published: false,
      authorId: ravi.id,
      tags: {
        create: [{ tagId: careerTag.id }],
      },
    },
  });

  await prisma.comment.createMany({
    data: [
      { text: "This matches my experience exactly.", postId: post1.id, authorId: asha.id },
      { text: "Curious how you handled migrations across the team.", postId: post1.id, authorId: ravi.id },
      { text: "Great writeup on the join model tradeoffs.", postId: post2.id, authorId: praveen.id },
    ],
  });

  console.log("Seeded 3 users, 3 posts (2 published), 3 tags, 3 comments.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
