// Blog Platform - Prisma many-to-many (explicit join model) + N+1-safe reads
//
// Setup (one time):
//   npm install
//   npx prisma migrate dev --name init
//   npx prisma db seed
// Run: node server.js
//
// Try:
//   curl -X POST http://localhost:5017/posts -H "Content-Type: application/json" ^
//     -d "{\"title\":\"New post\",\"body\":\"...\",\"authorId\":1,\"tags\":[\"node\",\"testing\"]}"
//   curl http://localhost:5017/posts
//   curl http://localhost:5017/posts/1
//   curl -X POST http://localhost:5017/posts/1/comments -H "Content-Type: application/json" -d "{\"text\":\"nice!\",\"authorId\":2}"

require("dotenv").config();
const express = require("express");
const { PrismaClient } = require("@prisma/client");

const app = express();
app.use(express.json());

const prisma = new PrismaClient();

// ============================================
// Create a post with tags - creating any Tag that doesn't exist yet,
// then linking through the explicit PostTag join model.
// ============================================

app.post("/posts", async (req, res) => {
  const { title, body, authorId, tags = [] } = req.body;

  if (!title || !body || !authorId) {
    return res.status(400).json({ success: false, message: "title, body, and authorId are required" });
  }

  try {
    // Wrap in a transaction: either the post + all its tag links are
    // created together, or none of it is (same idea as 12-prisma-orm.js's
    // $transaction, applied here to a multi-step tag-creation flow).
    const post = await prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: { title, body, authorId },
      });

      for (const tagName of tags) {
        // upsert = "create the Tag if it doesn't exist, otherwise use the
        // existing one" - avoids a separate findFirst-then-create round trip
        // and avoids a unique constraint error if two posts share a tag.
        const tag = await tx.tag.upsert({
          where: { name: tagName },
          update: {},
          create: { name: tagName },
        });

        await tx.postTag.create({
          data: { postId: created.id, tagId: tag.id },
        });
      }

      return created;
    });

    res.status(201).json({ success: true, data: post });
  } catch (err) {
    if (err.code === "P2003") {
      return res.status(400).json({ success: false, message: "authorId does not exist" });
    }
    res.status(400).json({ success: false, message: err.message });
  }
});

// ============================================
// List posts - author name, tag names, and comment count, in ONE query.
// This is the N+1-avoidance example from ../Notes.txt: no loop, no
// per-post extra query for its author or its tags or its comment count.
// ============================================

app.get("/posts", async (req, res) => {
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      published: true,
      createdAt: true,
      author: { select: { name: true } },
      tags: { select: { tag: { select: { name: true } } } },
      _count: { select: { comments: true } },
    },
  });

  // Flatten the tag shape (tags[].tag.name -> tags[]) so the API response
  // is clean - this reshaping happens in JS after the single DB round trip,
  // it is NOT an extra query.
  const data = posts.map((post) => ({
    id: post.id,
    title: post.title,
    published: post.published,
    createdAt: post.createdAt,
    author: post.author.name,
    tags: post.tags.map((t) => t.tag.name),
    commentCount: post._count.comments,
  }));

  res.json({ success: true, data });
});

// ============================================
// Single post, fully populated: author, tags, comments with their authors.
// ============================================

app.get("/posts/:id", async (req, res) => {
  const post = await prisma.post.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      author: { select: { id: true, name: true, email: true } },
      tags: { select: { tag: { select: { id: true, name: true } } } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true } } },
      },
    },
  });

  if (!post) return res.status(404).json({ success: false, message: "Post not found" });

  res.json({
    success: true,
    data: {
      ...post,
      tags: post.tags.map((t) => t.tag), // flatten join rows to plain tag objects
    },
  });
});

// ============================================
// Add a comment to a post
// ============================================

app.post("/posts/:id/comments", async (req, res) => {
  const { text, authorId } = req.body;
  if (!text || !authorId) {
    return res.status(400).json({ success: false, message: "text and authorId are required" });
  }

  try {
    const comment = await prisma.comment.create({
      data: { text, authorId, postId: Number(req.params.id) },
      include: { author: { select: { id: true, name: true } } },
    });
    res.status(201).json({ success: true, data: comment });
  } catch (err) {
    // P2003 = foreign key constraint failed (bad postId or authorId)
    if (err.code === "P2003") {
      return res.status(400).json({ success: false, message: "post or author does not exist" });
    }
    res.status(400).json({ success: false, message: err.message });
  }
});

const PORT = process.env.PORT || 5017;
app.listen(PORT, () => console.log(`Blog Platform running on http://localhost:${PORT}`));
