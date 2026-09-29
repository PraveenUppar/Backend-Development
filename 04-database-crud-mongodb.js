// Database CRUD with MongoDB/Mongoose (in an API)
// Needs: MongoDB running (docker run -d -p 27017:27017 mongo)
// Run: node 04-database-crud-mongodb.js
// Then: curl -X POST http://localhost:4004/posts -H "Content-Type: application/json" -d "{\"title\":\"Hi\",\"body\":\"First post\",\"author\":\"<userId>\"}"

const express = require("express");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/backend_revision";

mongoose.connect(MONGO_URI).then(() => {
  console.log("MongoDB connected");
});

// ============================================
// Schemas & models
// ============================================

// This assumes you already know basic Mongoose schemas/models from your
// other folder. Here we focus on using them inside real API routes,
// including a relationship between two collections.

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
});

const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
const Post = mongoose.model("Post", postSchema);

// ============================================
// Create
// ============================================

app.post("/users", async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post("/posts", async (req, res) => {
  try {
    const post = await Post.create(req.body);
    res.status(201).json({ success: true, data: post });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ============================================
// Read - list and single, with population (the "relationship" part)
// ============================================

app.get("/posts", async (req, res) => {
  // .populate() replaces the author ObjectId with the actual user document
  const posts = await Post.find().populate("author", "name email").sort({ createdAt: -1 });
  res.json({ success: true, data: posts });
});

app.get("/posts/:id", async (req, res) => {
  const post = await Post.findById(req.params.id).populate("author", "name email");
  if (!post) return res.status(404).json({ success: false, message: "Post not found" });
  res.json({ success: true, data: post });
});

// ============================================
// Update
// ============================================

app.patch("/posts/:id", async (req, res) => {
  const post = await Post.findByIdAndUpdate(req.params.id, req.body, {
    new: true, // return the updated doc, not the original
    runValidators: true, // re-run schema validation on update
  });
  if (!post) return res.status(404).json({ success: false, message: "Post not found" });
  res.json({ success: true, data: post });
});

// ============================================
// Delete
// ============================================

app.delete("/posts/:id", async (req, res) => {
  const post = await Post.findByIdAndDelete(req.params.id);
  if (!post) return res.status(404).json({ success: false, message: "Post not found" });
  res.json({ success: true, data: null });
});

// ============================================
// Querying a relationship the other way: all posts by one author
// ============================================

app.get("/users/:id/posts", async (req, res) => {
  const posts = await Post.find({ author: req.params.id });
  res.json({ success: true, data: posts });
});

const PORT = 4004;
app.listen(PORT, () => console.log(`Mongo CRUD demo running on http://localhost:${PORT}`));
