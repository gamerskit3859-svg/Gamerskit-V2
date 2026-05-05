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
    category: { type: String, required: true, index: true },
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

export const ProductModel =
  mongoose.models.Product ?? mongoose.model("Product", ProductSchema);
