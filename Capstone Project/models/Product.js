const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    priceCents: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, index: true },
    stock: { type: Number, required: true, min: 0, default: 0 },
    imageUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

// Text index backs the $text search used in GET /products?q=
productSchema.index({ name: "text", description: "text" });

module.exports = mongoose.model("Product", productSchema);
