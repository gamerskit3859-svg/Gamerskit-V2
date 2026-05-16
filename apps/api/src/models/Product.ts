import mongoose, { Schema } from "mongoose";

const VariantSchema = new Schema(
  {
    size: { type: String },
    color: { type: String },
    stock: { type: Number, default: 0 },
  },
  { _id: false },
);

const ProductSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true, index: true },
    categorySlug: { type: String, default: "", index: true }, // kept for compatibility
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number },
    cost: { type: Number },
    buyingPrice: { type: Number, default: 0, min: 0 },
    stock: { type: Number, default: 0 },
    images: { type: [String], default: [] },
    variants: { type: [VariantSchema], default: [] },
    featured: { type: Boolean, default: false },
    legacyId: { type: String, index: true },
  },
  { timestamps: true },
);

ProductSchema.index({ title: "text", description: "text" });
ProductSchema.index({ featured: 1, createdAt: -1 });
ProductSchema.index({ category: 1, featured: -1, createdAt: -1 });
ProductSchema.index({ categorySlug: 1, featured: -1, createdAt: -1 });
ProductSchema.index({ stock: 1 });

export const ProductModel =
  mongoose.models.Product ?? mongoose.model("Product", ProductSchema);
