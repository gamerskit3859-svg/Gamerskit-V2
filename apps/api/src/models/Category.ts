import mongoose, { Schema } from "mongoose";

const CategorySchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    image: { type: String, default: "" },
    icon: { type: String, default: "" },
    parentId: { type: Schema.Types.ObjectId, ref: "Category", default: null, index: true },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true, index: true },
    featured: { type: Boolean, default: false, index: true },
    productCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

CategorySchema.index({ parentId: 1, active: 1 });
CategorySchema.index({ active: 1, parentId: 1, order: 1, name: 1 });
CategorySchema.index({ active: 1, featured: 1, order: 1 });

export const CategoryModel =
  mongoose.models.Category ?? mongoose.model("Category", CategorySchema);

export interface CategoryDocument {
  _id: string;
  slug: string;
  name: string;
  description: string;
  image: string;
  icon: string;
  parentId: string | null;
  featured: boolean;
  order: number;
  active: boolean;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}
