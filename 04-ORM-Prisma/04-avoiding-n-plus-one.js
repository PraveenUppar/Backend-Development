// ORM (Prisma) 4 - Avoiding N+1 Queries
// Builds on 01-many-to-many-relations.js.
// Needs: the schema from Assignment 1 - Blog Platform/prisma/schema.prisma
// migrated first - run this file FROM INSIDE that project folder (or copy
// its prisma/ folder next to this file) so @prisma/client resolves
// against a matching schema.
// Run: node ../04-avoiding-n-plus-one.js  (from Blog Platform/)
// Then: curl http://localhost:4412/posts

const express = require("express");
const { PrismaClient } = require("@prisma/client");

const app = express();
app.use(express.json());
const prisma = new PrismaClient();

// ============================================
// N+1 queries - and using select/include on purpose to avoid them
// ============================================

// The N+1 trap: fetch a list, then loop making one more query per item.
//   // BAD - 1 query for posts, then N more, one per post, for its author
//   const posts = await prisma.post.findMany();
//   for (const post of posts) {
//     post.author = await prisma.user.findUnique({ where: { id: post.authorId } });
//   }
//   // 10 posts = 11 total queries, worse as data grows

app.get("/posts", async (req, res) => {
  // GOOD - one query, relations fetched under the hood, not one query per row
  const posts = await prisma.post.findMany({
    select: {
      id: true,
      title: true,
      author: { select: { name: true } }, // only the field you need, not the whole user
      tags: { select: { tag: { select: { name: true } } } },
      _count: { select: { comments: true } }, // count of a relation, no extra query either
    },
  });
  res.json({ success: true, data: posts });
});

// `select` picks exact fields (smaller payload, no unrequested columns).
// `include` is the shortcut when you want ALL scalar fields of the parent
// PLUS some relations. Both do the fetch as one query (or a small constant
// number Prisma batches efficiently) - not one query per row. `_count` gets
// a relation's count without loading every row of it just to call .length.
//
// General rule: if you ever find yourself writing a for/.map loop around an
// `await prisma.something.findX(...)` call, stop and ask whether a
// select/include on the ORIGINAL query could have fetched that data already.

app.get("/posts/:id", async (req, res) => {
  const post = await prisma.post.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      author: true,
      tags: { include: { tag: true } },
      comments: { include: { author: { select: { name: true } } } },
    },
  });
  if (!post) return res.status(404).json({ success: false, message: "Post not found" });
  res.json({ success: true, data: post });
});

const PORT = 4412;
app.listen(PORT, () => console.log(`N+1 avoidance demo running on http://localhost:${PORT}`));
