/**
 * ChotoPaa's public catalogue reads, answered from ChotoPaa's database.
 *
 * MIRROR of chotopaa-backend — same filters, sort orders, populated fields
 * and payloads, so the storefront can't tell which server answered:
 *   products    src/modules/product/product.services.js (read functions)
 *   categories  src/modules/category/category.services.js
 *   brands      src/modules/brand/brand.services.js
 *   blogs       src/modules/blog/blog.services.js
 *   hero        src/modules/hero/hero.services.js (getPublicBanner)
 *   settings    src/modules/settings/settings.{services,controller}.js
 *   age groups  src/modules/age-group/age-group.services.js
 *   videos      src/modules/video/video.services.js (getPublicVideos)
 * When one of those changes, change it here too and run the parity check
 * (chotopaa: deploy/read-api/compare-read-api.mjs).
 */
import mongoose from "mongoose";
import { getChotopaaDb } from "./db.js";
import { chotopaaModels, type ChotopaaModels } from "./models.js";
import { chotopaaConfig } from "./config.js";
import {
  AGE_GROUPS,
  CLOSURES,
  GENDERS,
  SHOE_TYPES,
  parseListParam,
  parseSizeParam,
  resolveSizeChart,
} from "./attributes.js";
import { RANK_FIELDS, parseSeed, parseSignals, rankProducts, type RankableProduct } from "./recommend.js";

type Query = Record<string, unknown>;
type Doc = Record<string, unknown>;

/** An error answered with ChotoPaa's error envelope (router.ts). */
export class ChotopaaHttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public description = "An unexpected error occurred. Please try again later.",
  ) {
    super(message);
  }
}

const notFound = (message: string) => new ChotopaaHttpError(404, message);

async function models(): Promise<ChotopaaModels> {
  return chotopaaModels(await getChotopaaDb());
}

const isObjectId = (value: unknown) => mongoose.Types.ObjectId.isValid(String(value));

/** Match user input literally inside a $regex. */
const escapeRegex = (value: unknown) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Mongoose subdocuments don't spread; work on plain objects. */
const plain = (doc: unknown) =>
  doc && typeof (doc as { toObject?: unknown }).toObject === "function"
    ? (doc as { toObject: () => unknown }).toObject()
    : doc;
const plainList = (list: unknown) => (Array.isArray(list) ? list.map(plain) : []);

/** Settings, read-only: ChotoPaa creates the document on its first GET; until
 * then the defaults are what it would create. */
async function readSettings(m: ChotopaaModels) {
  return (await m.Settings.findOne()) ?? new m.Settings({});
}

/* ------------------------------ Products ------------------------------ */

const flagged = async (flag: string) => {
  const m = await models();
  return m.Product.find({ [flag]: true, isActive: true })
    .populate("category", "name slug")
    .populate("brand", "name slug")
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
};

export const getFeaturedProducts = () => flagged("isFeatured");
export const getNewArrivalProducts = () => flagged("isNewArrival");
export const getTopSaleProducts = () => flagged("isTopSale");

/** `?gender=girl` — girls' shoes plus unisex ones; `unisex` alone = unisex only. */
function genderCondition(raw: unknown) {
  const genders = parseListParam(raw, GENDERS);
  if (!genders.length) return null;
  const wanted = genders.some((g) => g !== "unisex")
    ? [...new Set([...genders, "unisex"])]
    : genders;
  return { $in: wanted };
}

/** `?size=24,25` — any of those EU sizes; in stock only while stock is enforced. */
function sizeCondition(raw: unknown) {
  const sizes = parseSizeParam(raw);
  if (!sizes.length) return null;
  const match: Doc = { euSize: { $in: sizes } };
  if (chotopaaConfig.stockEnforcement()) match.stock = { $gt: 0 };
  return { $elemMatch: match };
}

export async function getAllProducts(query: Query) {
  const m = await models();
  const filters: Doc = { isActive: true };
  const and: Doc[] = [];

  const page = Math.max(Number.parseInt(String(query.page)) || 1, 1);
  const limit = Math.min(Number.parseInt(String(query.limit)) || 12, 100);
  const skip = (page - 1) * limit;

  const buildMeta = (total: number) => ({
    page,
    limit,
    total,
    totalPage: Math.ceil(total / limit) || 0,
    hasMore: skip + Math.min(limit, total - skip) < total,
  });

  const search = typeof query.search === "string" ? query.search.trim() : "";
  if (search) {
    const pattern = { $regex: escapeRegex(search), $options: "i" };
    and.push({ $or: [{ title: pattern }, { tags: pattern }] });
  }

  if (query.category && query.category !== "All") {
    const categoryValue = String(query.category).trim();
    const categorySlug = categoryValue.toLowerCase().replace(/\s+/g, "-");

    const targetCategory = isObjectId(categoryValue)
      ? await m.Category.findById(categoryValue).select("_id").lean<Doc>()
      : await m.Category.findOne({
          $or: [
            { name: { $regex: `^${escapeRegex(categoryValue)}$`, $options: "i" } },
            { slug: categoryValue.toLowerCase() },
            { slug: categorySlug },
          ],
        })
          .select("_id")
          .lean<Doc>();

    if (!targetCategory) return { data: [], meta: buildMeta(0) };

    const children = await m.Category.find({ parentCategory: targetCategory._id })
      .select("_id")
      .lean<Doc[]>();
    filters.category = { $in: [targetCategory._id, ...children.map((cat) => cat._id)] };
  }

  if (query.brand && query.brand !== "All") {
    const brandValue = String(query.brand).trim();
    const brandDoc = isObjectId(brandValue)
      ? await m.Brand.findById(brandValue).select("_id").lean<Doc>()
      : await m.Brand.findOne({
          $or: [
            { name: { $regex: `^${escapeRegex(brandValue)}$`, $options: "i" } },
            { slug: brandValue.toLowerCase().replace(/\s+/g, "-") },
          ],
        })
          .select("_id")
          .lean<Doc>();

    if (!brandDoc) return { data: [], meta: buildMeta(0) };
    filters.brand = brandDoc._id;
  }

  const ageGroups = parseListParam(query.ageGroup, AGE_GROUPS);
  if (ageGroups.length) filters.ageGroups = { $in: ageGroups };

  const gender = genderCondition(query.gender);
  if (gender) filters.gender = gender;

  const shoeTypes = parseListParam(query.shoeType, SHOE_TYPES);
  if (shoeTypes.length) filters.shoeType = { $in: shoeTypes };

  const closures = parseListParam(query.closure, CLOSURES);
  if (closures.length) filters.closure = { $in: closures };

  const size = sizeCondition(query.size);
  if (size) filters.variants = size;

  if (query.minPrice) filters.priceTo = { $gte: Number(query.minPrice) || 0 };
  if (query.maxPrice && Number(query.maxPrice) > 0) {
    filters.priceFrom = { $lte: Number(query.maxPrice) };
  }

  if (and.length) filters.$and = and;

  const sort = String(query.sort || "").toLowerCase();

  if (sort === "recommended") {
    const candidates = await m.Product.find(filters).select(RANK_FIELDS).lean<RankableProduct[]>();
    const pageIds = rankProducts(candidates, parseSignals(query), parseSeed(query.seed)).slice(
      skip,
      skip + limit,
    );

    const pageProducts = await m.Product.find({ _id: { $in: pageIds } })
      .populate("category", "name slug")
      .populate("brand", "name slug")
      .lean<Doc[]>();
    const byId = new Map(pageProducts.map((p) => [String(p._id), p]));

    return {
      data: pageIds.map((id) => byId.get(id)).filter(Boolean),
      meta: buildMeta(candidates.length),
    };
  }

  let sortOptions: Record<string, 1 | -1>;
  switch (sort) {
    case "price-low":
      sortOptions = { priceFrom: 1, _id: 1 };
      break;
    case "price-high":
      sortOptions = { priceFrom: -1, _id: 1 };
      break;
    case "name":
      sortOptions = { title: 1, _id: 1 };
      break;
    default:
      sortOptions = { createdAt: -1, _id: -1 };
  }

  const [products, total] = await Promise.all([
    m.Product.find(filters)
      .populate("category", "name slug")
      .populate("brand", "name slug")
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean(),
    m.Product.countDocuments(filters),
  ]);

  return { data: products, meta: buildMeta(total) };
}

/** By slug (preferred) or ObjectId, with `effectiveSizeChart` added. */
export async function getSingleProduct(identifier: string) {
  const m = await models();
  const query = isObjectId(identifier) ? { _id: identifier } : { slug: identifier };

  const product = await m.Product.findOne(query)
    .populate("category", "name slug displayName")
    .populate("brand", "name slug")
    .lean<Doc>();
  if (!product) throw notFound("Product not found.");

  const settings = await readSettings(m);
  return {
    ...product,
    effectiveSizeChart: plainList(resolveSizeChart(product, settings.sizeChart)),
  };
}

/* ----------------------------- Categories ----------------------------- */

interface CategoryNode {
  _id: unknown;
  categoryId: unknown;
  name: unknown;
  slug: unknown;
  image: unknown;
  showOnLanding: unknown;
  children: CategoryNode[];
}

function buildCategoryTree(categories: Doc[], parentId: unknown = null): CategoryNode[] {
  const level =
    parentId === null
      ? categories.filter((cat) => !cat.parentCategory)
      : categories.filter(
          (cat) => cat.parentCategory && String(cat.parentCategory) === String(parentId),
        );

  return level.map((cat) => ({
    _id: cat._id,
    categoryId: cat.categoryId,
    name: cat.name,
    slug: cat.slug,
    image: cat.image,
    showOnLanding: cat.showOnLanding,
    children: buildCategoryTree(categories, cat._id),
  }));
}

export async function getAllCategories() {
  const m = await models();
  const all = await m.Category.find({ isActive: true }).sort({ createdAt: -1 });
  return buildCategoryTree(all as unknown as Doc[]);
}

export async function getSingleCategory(id: string) {
  const m = await models();
  const category = await m.Category.findById(id).populate("parentCategory", "name slug");
  if (!category) throw notFound("Category not found.");
  return category;
}

/* ------------------------------- Brands ------------------------------- */

export async function getAllBrands() {
  const m = await models();
  return m.Brand.find({ isActive: true }).sort({ createdAt: -1 });
}

export async function getSingleBrand(id: string) {
  const m = await models();
  const brand = await m.Brand.findById(id);
  if (!brand) throw notFound("Brand not found.");
  return brand;
}

/* -------------------------------- Blogs ------------------------------- */

export async function getAllBlogs(query: Query) {
  const m = await models();
  const filters: Doc = {};

  const page = Math.max(Number.parseInt(String(query.page)) || 1, 1);
  const limit = Math.min(Number.parseInt(String(query.limit)) || 12, 100);
  const skip = (page - 1) * limit;

  // Escaped here (ChotoPaa passes the raw text as a regex); identical for any
  // search without regex characters.
  if (typeof query.search === "string" && query.search) {
    filters.title = { $regex: escapeRegex(query.search.trim()), $options: "i" };
  }
  if (typeof query.category === "string" && query.category && query.category !== "All") {
    filters.category = query.category.trim();
  }
  if (query.isPublished !== undefined) {
    filters.isPublished = query.isPublished === "true";
  }

  const [data, total] = await Promise.all([
    m.Blog.find(filters).sort({ createdAt: -1 }).skip(skip).limit(limit),
    m.Blog.countDocuments(filters),
  ]);

  return {
    data,
    meta: { page, limit, total, totalPage: Math.ceil(total / limit) || 0 },
  };
}

export async function getSingleBlog(identifier: string) {
  const m = await models();
  const query = /^[0-9a-fA-F]{24}$/.test(identifier) ? { _id: identifier } : { slug: identifier };
  const blog = await m.Blog.findOne(query);
  if (!blog) throw notFound("Blog post not found.");
  return blog;
}

/* --------------------------- Home page pieces -------------------------- */

/** The published banner with its active slides, ordered; null when none. */
export async function getPublicBanner() {
  const m = await models();
  const banner = await m.HeroBanner.findOne({ isPublished: true }).lean<Doc>();
  if (!banner) return null;

  const slides = ((banner.slides as Doc[] | undefined) ?? [])
    .filter((slide) => slide.isActive)
    .sort((a, b) => Number(a.order) - Number(b.order));

  return { ...banner, slides };
}

/** Stored settings plus ChotoPaa's server-side switches (see config.ts). */
export async function getSettings() {
  const m = await models();
  const settings = await readSettings(m);
  return {
    ...settings.toObject(),
    stockEnforcement: chotopaaConfig.stockEnforcement(),
    bkashNumber: chotopaaConfig.bkashNumber() || "",
  };
}

export async function getAgeGroups() {
  const m = await models();
  return m.AgeGroupMedia.find().lean();
}

const VIDEO_PRODUCT_FIELDS =
  "title slug images colors variants price discountPrice priceFrom priceTo totalStock stockStatus ratings isActive gender";

/** Active clips in order; a hidden linked product is dropped from its clip. */
export async function getPublicVideos() {
  const m = await models();
  const videos = await m.ShopVideo.find({ isActive: true })
    .sort({ order: 1, createdAt: 1 })
    .select("-videoKey -posterKey")
    .populate("product", VIDEO_PRODUCT_FIELDS)
    .lean<Doc[]>();

  return videos.map((video) => {
    const product = video.product as Doc | null | undefined;
    return { ...video, product: product?.isActive ? product : null };
  });
}
