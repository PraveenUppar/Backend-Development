// Practice 1: Explicit Join Control (topic 01)
// Needs: the schema from ../Assignment 1 - Blog Platform/prisma/schema.prisma
// migrated first - run this file FROM INSIDE that project folder (or copy
// its prisma/ folder next to this file).
// Run: node ../practice/practice1.js  (from Blog Platform/)
// Then: curl -X DELETE http://localhost:4421/posts/1/tags/2

const express = require("express");
const { PrismaClient } = require("@prisma/client");

const app = express();
app.use(express.json());
const prisma = new PrismaClient();

// Exercise: remove ONE tag from ONE post without touching the post's other
// tags or the tag itself (other posts may still use it). This is exactly
// the kind of fine-grained control an implicit many-to-many can't give you -
// with implicit, Prisma's `disconnect` works too, but you have no
// PostTag row to target directly (e.g. to also check taggedAt before
// deciding whether to remove it).

app.delete("/posts/:postId/tags/:tagId", async (req, res) => {
  const postId = Number(req.params.postId);
  const tagId = Number(req.params.tagId);

  try {
    await prisma.postTag.delete({
      where: { postId_tagId: { postId, tagId } }, // composite key from @@id([postId, tagId])
    });
    res.json({ success: true, data: { postId, tagId, removed: true } });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ success: false, message: "That post/tag pairing doesn't exist" });
    }
    res.status(400).json({ success: false, message: err.message });
  }
});

const PORT = 4421;
app.listen(PORT, () => console.log(`Practice 1 running on http://localhost:${PORT}`));
