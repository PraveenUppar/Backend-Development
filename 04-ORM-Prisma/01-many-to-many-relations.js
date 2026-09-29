// ORM (Prisma) 1 - Many-to-Many: Implicit vs Explicit Join Model
// ../12-prisma-orm.js already covers a basic schema.prisma with a
// User/Post one-to-many, CRUD through the generated client, `include`
// for a relation, known error codes (P2002, P2025), and $transaction.
// This picks up where that one stops.
// Needs: the schema from Assignment 1 - Blog Platform/prisma/schema.prisma
// migrated first - run this file FROM INSIDE that project folder (or copy
// its prisma/ folder next to this file) so @prisma/client resolves
// against a matching schema.
// Run: npx prisma migrate dev --name init   (once, from Blog Platform/)
//      node ../01-many-to-many-relations.js  (from Blog Platform/)
// Then: curl -X POST http://localhost:4411/posts -H "Content-Type: application/json" -d "{\"title\":\"New post\",\"body\":\"...\",\"authorId\":1,\"tagNames\":[\"node\",\"testing\"]}"

const express = require("express");
const { PrismaClient } = require("@prisma/client");

const app = express();
app.use(express.json());
const prisma = new PrismaClient();

// ============================================
// Many-to-many: implicit relation vs explicit join model
// ============================================

// Prisma can create a many-to-many relation two ways.
//
// IMPLICIT - declare both sides as list relations, Prisma manages a hidden
// join table for you:
//   model Post { id Int @id  tags Tag[] }
//   model Tag  { id Int @id  posts Post[] }
// Genuinely convenient - prisma.post.update({ data: { tags: { connect: [...] } } })
// and Prisma handles the join row. The catch: you never touch that join
// table directly, so it can ONLY hold the two foreign keys. The moment you
// need to store anything ABOUT the relationship itself (not the post, not
// the tag, but the fact that THIS post has THIS tag), implicit has nowhere
// to put it.
//
// EXPLICIT - model the join table yourself (see
// Assignment 1 - Blog Platform/prisma/schema.prisma):
//   model PostTag {
//     postId   Int
//     tagId    Int
//     taggedAt DateTime @default(now())   // extra data ABOUT the relationship
//     post Post @relation(fields: [postId], references: [id])
//     tag  Tag  @relation(fields: [tagId], references: [id])
//     @@id([postId, tagId])
//   }
// Now `taggedAt` lives naturally on the relationship. Querying it is one
// extra hop (post.tags[].tag.name instead of post.tags[].name) but you get
// full control - filter/sort by taggedAt, delete a specific pairing without
// touching either side's other tags.
//
// Rule of thumb: start implicit if the relation truly is just "these two
// things are linked." Reach for explicit the moment you need ANY extra
// field on the relationship, or need to query the relationship rows directly.

app.post("/posts", async (req, res) => {
  const { title, body, authorId, tagNames = [] } = req.body;

  const post = await prisma.$transaction(async (tx) => {
    const created = await tx.post.create({ data: { title, body, authorId } });

    for (const name of tagNames) {
      // upsert: create the Tag if it doesn't exist yet, otherwise use the existing one
      const tag = await tx.tag.upsert({ where: { name }, update: {}, create: { name } });
      await tx.postTag.create({ data: { postId: created.id, tagId: tag.id } });
    }

    return created;
  });

  res.status(201).json({ success: true, data: post });
});

const PORT = 4411;
app.listen(PORT, () => console.log(`Many-to-many relations demo running on http://localhost:${PORT}`));
