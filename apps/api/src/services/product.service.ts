import mongoose from "mongoose";
import { ProductModel } from "../models/Product.js";
import { getEffectivePrice } from "../lib/pricing.js";
import { hasVariants, variantStock, type VariantGroup } from "../lib/variants.js";

/**
 * Product lookups for admin tooling. Stock is computed the same way as the
 * admin product list: a variant product's stock is the sum of its options.
 */

/** The dashboard, notifications and inventory pages all use stock ≤ 3. */
export const DEFAULT_LOW_STOCK_THRESHOLD = 3;

const SUMMARY_FIELDS =
  "slug title category price compareAtPrice stock isActive variants.name variants.options.stock";
const DETAIL_FIELDS =
  "slug title category price compareAtPrice buyingPrice stock readyStock variants isActive isFeatured isBestSelling isNewArrival featured freeDelivery images createdAt updatedAt";

type LeanProduct = {
  _id: mongoose.Types.ObjectId;
  slug: string;
  title: string;
  category?: { _id: mongoose.Types.ObjectId; name?: string; slug?: string } | null;
  price: number;
  compareAtPrice?: number | null;
  buyingPrice?: number;
  stock?: number;
  readyStock?: boolean;
  variants?: VariantGroup[];
  isActive?: boolean;
  isFeatured?: boolean;
  isBestSelling?: boolean;
  isNewArrival?: boolean;
  featured?: boolean;
  freeDelivery?: boolean;
  images?: string[];
  createdAt?: Date;
  updatedAt?: Date;
};

export type ProductSummary = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  price: number;
  /** The discount price, when one is set and below price. */
  discountPrice: number | null;
  /** What a customer pays today. */
  effectivePrice: number;
  stock: number;
  hasVariants: boolean;
  /** Unset counts as active, as on the storefront. */
  isActive: boolean;
};

function toSummary(product: LeanProduct): ProductSummary {
  const effectivePrice = getEffectivePrice(product);
  const variants = hasVariants(product);
  return {
    id: String(product._id),
    title: product.title,
    slug: product.slug,
    category: product.category?.name ?? null,
    price: product.price,
    discountPrice: effectivePrice < product.price ? effectivePrice : null,
    effectivePrice,
    stock: variants ? variantStock(product.variants) : (product.stock ?? 0),
    hasVariants: variants,
    isActive: product.isActive !== false,
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Case-insensitive match where every word must appear in the title, slug or a
 * variant SKU — so "logitech g102" finds "Logitech G102 Prodigy Mouse". Unlike
 * the storefront's $text search, partial words match too ("g10").
 */
export async function searchProducts(
  query: string,
  options: { limit: number },
): Promise<{ total: number; items: ProductSummary[] }> {
  const trimmed = query.trim();
  const terms = trimmed.split(/\s+/).filter(Boolean).slice(0, 8);
  if (terms.length === 0) return { total: 0, items: [] };

  const byWords = {
    $and: terms.map((term) => {
      const pattern = { $regex: escapeRegex(term), $options: "i" };
      return {
        $or: [{ title: pattern }, { slug: pattern }, { "variants.options.sku": pattern }],
      };
    }),
  };
  // An exact id or slug is also accepted, so a follow-up can pin one product.
  const filter = mongoose.isValidObjectId(trimmed)
    ? { $or: [{ _id: trimmed }, byWords] }
    : { $or: [{ slug: trimmed.toLowerCase() }, byWords] };

  const [candidates, total] = await Promise.all([
    ProductModel.find(filter)
      .select(SUMMARY_FIELDS)
      .populate("category", "name")
      .limit(50)
      .lean() as Promise<LeanProduct[]>,
    ProductModel.countDocuments(filter),
  ]);

  // Closest matches first: exact title, then title prefix, then the rest.
  const needle = trimmed.toLowerCase();
  const rank = (product: LeanProduct) => {
    const title = product.title.toLowerCase();
    if (title === needle || product.slug === needle || String(product._id) === trimmed) return 0;
    if (title.startsWith(needle)) return 1;
    return 2;
  };
  const items = candidates
    .sort((a, b) => rank(a) - rank(b) || a.title.length - b.title.length || a.title.localeCompare(b.title))
    .slice(0, options.limit)
    .map(toSummary);

  return { total, items };
}

export type ProductDetail = ProductSummary & {
  categorySlug: string | null;
  buyingPrice: number;
  readyStock: boolean;
  featured: boolean;
  bestSelling: boolean;
  newArrival: boolean;
  freeDelivery: boolean;
  imageCount: number;
  variants: Array<{
    name: string;
    options: Array<{ value: string; stock: number; price: number | null; sku: string | null }>;
  }>;
  createdAt: string | null;
  updatedAt: string | null;
};

/** One product by id, or by slug when the value is not an ObjectId. */
export async function getProductDetail(idOrSlug: string): Promise<ProductDetail | null> {
  const filter = mongoose.isValidObjectId(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug };
  const product = (await ProductModel.findOne(filter)
    .select(DETAIL_FIELDS)
    .populate("category", "name slug")
    .lean()) as LeanProduct | null;
  if (!product) return null;

  return {
    ...toSummary(product),
    categorySlug: product.category?.slug ?? null,
    buyingPrice: product.buyingPrice ?? 0,
    readyStock: product.readyStock === true,
    featured: product.isFeatured === true || product.featured === true,
    bestSelling: product.isBestSelling === true,
    newArrival: product.isNewArrival === true,
    freeDelivery: product.freeDelivery === true,
    imageCount: product.images?.length ?? 0,
    variants: (product.variants ?? []).map((group) => ({
      name: group.name ?? "",
      options: (group.options ?? []).map((option) => ({
        value: option.value ?? "",
        stock: Number(option.stock) || 0,
        price: option.price ?? null,
        sku: option.sku ?? null,
      })),
    })),
    createdAt: product.createdAt ? new Date(product.createdAt).toISOString() : null,
    updatedAt: product.updatedAt ? new Date(product.updatedAt).toISOString() : null,
  };
}

/**
 * Products at or below the threshold, lowest first. Queries the stored
 * `stock`, as the dashboard's low-stock count does; variant products keep that
 * field equal to the sum of their options.
 */
export async function getLowStockProducts(options: {
  threshold: number;
  limit: number;
  includeInactive: boolean;
}): Promise<{ total: number; outOfStock: number; items: ProductSummary[] }> {
  const filter: Record<string, unknown> = { stock: { $lte: options.threshold } };
  if (!options.includeInactive) filter.isActive = { $ne: false };

  const [items, total, outOfStock] = await Promise.all([
    ProductModel.find(filter)
      .select(SUMMARY_FIELDS)
      .populate("category", "name")
      .sort({ stock: 1, title: 1 })
      .limit(options.limit)
      .lean() as Promise<LeanProduct[]>,
    ProductModel.countDocuments(filter),
    ProductModel.countDocuments({ ...filter, stock: { $lte: 0 } }),
  ]);

  return { total, outOfStock, items: items.map(toSummary) };
}
