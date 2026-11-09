import { Schema, type Connection, type Model } from "mongoose";
import { DEFAULT_SIZE_CHART } from "./attributes.js";

/**
 * Read models for ChotoPaa's collections, registered on ChotoPaa's own
 * connection (db.ts) — never on mongoose's default one, where GamersKit's
 * Product/Category/… models live under the same names.
 *
 * Collections that are only ever read with .lean() get a loose schema: the
 * response is the stored document as-is, so there's nothing to keep in step.
 * Category, Brand, Blog and Settings are returned as full documents by
 * ChotoPaa (defaults filled in for fields older documents lack), so their
 * fields and defaults MIRROR chotopaa-backend's models:
 *   src/modules/{category,brand,blog,settings}/*.model.js
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ReadModel = Model<any>;

/** Keep every stored field; filter on any of them. */
const LOOSE = { strict: false, strictQuery: false } as const;

const ref = (model: string) => ({ type: Schema.Types.ObjectId, ref: model, default: null });

const ProductSchema = new Schema(
  { category: ref("Category"), brand: ref("Brand") },
  { ...LOOSE, collection: "products" },
);

const CategorySchema = new Schema(
  {
    categoryId: String,
    name: String,
    slug: String,
    metaTitle: String,
    metaDescription: String,
    image: { type: String, default: null },
    imageKey: { type: String, default: null },
    parentCategory: ref("Category"),
    isActive: { type: Boolean, default: true },
    showOnLanding: { type: Boolean, default: false },
  },
  { strictQuery: false, timestamps: true, collection: "categories" },
);

const BrandSchema = new Schema(
  {
    brandId: String,
    name: String,
    slug: String,
    metaTitle: String,
    metaDescription: String,
    logo: { type: String, default: null },
    logoKey: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    showOnLanding: { type: Boolean, default: false },
  },
  { strictQuery: false, timestamps: true, collection: "brands" },
);

const BlogSchema = new Schema(
  {
    blogId: String,
    slug: String,
    title: String,
    metaTitle: String,
    metaDescription: String,
    excerpt: String,
    content: String,
    featuredImage: { type: String, default: null },
    featuredImageKey: { type: String, default: null },
    category: String,
    tags: [{ type: String }],
    author: { type: String, default: "" },
    isFeatured: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: false },
    views: { type: Number, default: 0 },
  },
  { strictQuery: false, timestamps: true, collection: "blogs" },
);

const SizeChartRowSchema = new Schema(
  { euSize: Number, ukSize: String, footLengthCm: Number, ageGroup: String },
  { _id: false },
);

const PopupSchema = new Schema(
  {
    isActive: { type: Boolean, default: false },
    imageUrl: { type: String, default: "" },
    imageKey: { type: String, default: null },
    link: { type: String, default: "" },
    delaySeconds: { type: Number, default: 5 },
    frequency: { type: String, default: "session" },
    version: { type: String, default: "" },
  },
  { _id: false },
);

const SettingsSchema = new Schema(
  {
    advanceRequired: { type: Boolean, default: true },
    advanceAmount: { type: Number, default: 200 },
    deliveryChargeEnabled: { type: Boolean, default: true },
    deliveryCharge: { type: Number, default: 120 },
    minPayableAmount: { type: Number, default: 0 },
    popup: { type: PopupSchema, default: () => ({}) },
    sizeChart: {
      type: [SizeChartRowSchema],
      default: () => DEFAULT_SIZE_CHART.map((row) => ({ ...row })),
    },
    lowStockThreshold: { type: Number, default: 2 },
    showBrands: { type: Boolean, default: true },
    showShopByAge: { type: Boolean, default: true },
  },
  { strictQuery: false, timestamps: true, collection: "settings" },
);

const HeroBannerSchema = new Schema({}, { ...LOOSE, collection: "herobanners" });
const AgeGroupMediaSchema = new Schema({}, { ...LOOSE, collection: "agegroupmedias" });
const ShopVideoSchema = new Schema(
  { product: ref("Product") },
  { ...LOOSE, collection: "shopvideos" },
);

const SCHEMAS: Record<string, Schema> = {
  Product: ProductSchema,
  Category: CategorySchema,
  Brand: BrandSchema,
  Blog: BlogSchema,
  Settings: SettingsSchema,
  HeroBanner: HeroBannerSchema,
  AgeGroupMedia: AgeGroupMediaSchema,
  ShopVideo: ShopVideoSchema,
};

export function registerChotopaaModels(conn: Connection): void {
  for (const [name, schema] of Object.entries(SCHEMAS)) {
    if (!conn.models[name]) conn.model(name, schema);
  }
}

export interface ChotopaaModels {
  Product: ReadModel;
  Category: ReadModel;
  Brand: ReadModel;
  Blog: ReadModel;
  Settings: ReadModel;
  HeroBanner: ReadModel;
  AgeGroupMedia: ReadModel;
  ShopVideo: ReadModel;
}

export function chotopaaModels(conn: Connection): ChotopaaModels {
  return Object.fromEntries(
    Object.keys(SCHEMAS).map((name) => [name, conn.model(name)]),
  ) as unknown as ChotopaaModels;
}
