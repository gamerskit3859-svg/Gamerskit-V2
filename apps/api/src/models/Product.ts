import mongoose, { Schema } from "mongoose";

const VariantOptionSchema = new Schema(
  {
    value: { type: String, required: true },
    stock: { type: Number, default: 0 },
    sku: { type: String },
    price: { type: Number, min: 0 },
  },
  { _id: false },
);

const VariantSchema = new Schema(
  {
    name: { type: String, required: true },
    options: { type: [VariantOptionSchema], default: [] },
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
    freeDelivery: { type: Boolean, default: false },
    cost: { type: Number },
    buyingPrice: { type: Number, default: 0, min: 0 },
    stock: { type: Number, default: 0 },
    // Internal fulfilment flag: is this physically on the shelf and shippable
    // today? Admin-only — it is never selected into a public product response.
    readyStock: { type: Boolean, default: false },
    sizeChartUrl: { type: String },
    images: { type: [String], default: [] },
    variants: { type: [VariantSchema], default: [] },
    // Storefront visibility. Products that predate this field have it unset, so
    // every public query tests `{ $ne: false }` rather than `true` — otherwise
    // turning the flag on would hide the whole existing catalogue.
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    isBestSelling: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: false },
    // Legacy homepage flag kept so older products still appear as featured
    // until they are edited with the newer explicit controls.
    featured: { type: Boolean, default: false },
    legacyId: { type: String, index: true },
  },
  { timestamps: true },
);

ProductSchema.index({ title: "text", description: "text" });
ProductSchema.index({ isFeatured: 1, createdAt: -1 });
ProductSchema.index({ isBestSelling: 1, createdAt: -1 });
ProductSchema.index({ isNewArrival: 1, createdAt: -1 });
ProductSchema.index({ featured: 1, createdAt: -1 });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ category: 1, featured: -1, createdAt: -1 });
ProductSchema.index({ categorySlug: 1, featured: -1, createdAt: -1 });
ProductSchema.index({ category: 1, stock: 1, createdAt: -1 });
ProductSchema.index({ stock: 1 });
// Backs the admin order list's ready-stock filter, which resolves the flag to
// a product id set before querying orders.
ProductSchema.index({ readyStock: 1 });
// Every storefront listing filters on this, so it leads the compound index.
ProductSchema.index({ isActive: 1, createdAt: -1 });

export const ProductModel =
  mongoose.models.Product ?? mongoose.model("Product", ProductSchema);
