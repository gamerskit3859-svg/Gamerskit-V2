/**
 * ChotoPaa's "Recommended" shop order: a seeded shuffle tilted toward the
 * shopper's activity signals (sent by the storefront with the request).
 *
 * MIRROR of chotopaa-backend/src/modules/product/product.recommend.js — the
 * same seed must give the same order on both servers, or infinite scroll
 * repeats or skips products when a request lands on the other one.
 */
import mongoose from "mongoose";
import { AGE_GROUPS, GENDERS, SHOE_TYPES, parseListParam } from "./attributes.js";

const MAX_SIGNALS = 8;

const WEIGHTS = {
  category: 3,
  brand: 2,
  ageGroup: 2,
  shoeType: 1.5,
  gender: 1,
  viewed: 1,
};

const UNISEX_SHARE = 0.5;
const SHUFFLE_WEIGHT = 3;
const HIGHLIGHT_BONUS = 0.5;
const OUT_OF_STOCK_PENALTY = 4;

/** What the ranking needs from each product — the full documents come later. */
export const RANK_FIELDS =
  "_id category brand ageGroups shoeType gender isFeatured isTopSale stockStatus totalStock";

export interface Signals {
  categories: string[];
  brands: string[];
  ageGroups: string[];
  shoeTypes: string[];
  genders: string[];
  viewed: string[];
}

export interface RankableProduct {
  _id: unknown;
  category?: unknown;
  brand?: unknown;
  ageGroups?: unknown[];
  shoeType?: unknown;
  gender?: unknown;
  isFeatured?: unknown;
  isTopSale?: unknown;
  stockStatus?: unknown;
  totalStock?: unknown;
}

function idList(raw: unknown): string[] {
  return [
    ...new Set(
      String(raw ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter((value) => mongoose.Types.ObjectId.isValid(value)),
    ),
  ].slice(0, MAX_SIGNALS);
}

export function parseSignals(query: Record<string, unknown> = {}): Signals {
  return {
    categories: idList(query.affCategory),
    brands: idList(query.affBrand),
    ageGroups: parseListParam(query.affAgeGroup, AGE_GROUPS).slice(0, MAX_SIGNALS),
    shoeTypes: parseListParam(query.affShoeType, SHOE_TYPES).slice(0, MAX_SIGNALS),
    genders: parseListParam(query.affGender, GENDERS).slice(0, MAX_SIGNALS),
    viewed: idList(query.affViewed),
  };
}

/** Any 32-bit integer; a missing or junk seed falls back to a fixed one. */
export function parseSeed(raw: unknown): number {
  const seed = Number.parseInt(String(raw), 10);
  return Number.isFinite(seed) ? seed >>> 0 : 0;
}

/** FNV-1a: a stable 0..1 for each (seed, product) pair. */
export function shuffleValue(seed: number, id: unknown): number {
  let hash = 0x811c9dc5 ^ seed;
  const key = String(id);
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0x100000000;
}

function rankWeight(list: string[], value: unknown, weight: number): number {
  const index = list.indexOf(String(value));
  return index === -1 ? 0 : weight * (1 - index / (list.length + 1));
}

function bestRankWeight(list: string[], values: unknown[] = [], weight: number): number {
  return values.reduce<number>((best, value) => Math.max(best, rankWeight(list, value, weight)), 0);
}

function isOutOfStock(product: RankableProduct): boolean {
  return (
    product.stockStatus === "Out of Stock" ||
    (product.stockStatus !== "Pre-order" &&
      product.totalStock !== undefined &&
      Number(product.totalStock) <= 0)
  );
}

function genderWeight(genders: string[], gender: unknown): number {
  if (!gender || !genders.length) return 0;
  const exact = rankWeight(genders, gender, WEIGHTS.gender);
  if (exact || gender !== "unisex") return exact;
  return bestRankWeight(genders, ["boy", "girl"], WEIGHTS.gender) * UNISEX_SHARE;
}

export function scoreProduct(product: RankableProduct, signals: Signals, seed: number): number {
  let score = shuffleValue(seed, product._id) * SHUFFLE_WEIGHT;

  score += rankWeight(signals.categories, product.category, WEIGHTS.category);
  score += rankWeight(signals.brands, product.brand, WEIGHTS.brand);
  score += bestRankWeight(signals.ageGroups, product.ageGroups, WEIGHTS.ageGroup);
  score += rankWeight(signals.shoeTypes, product.shoeType, WEIGHTS.shoeType);
  score += genderWeight(signals.genders, product.gender);
  score += rankWeight(signals.viewed, product._id, WEIGHTS.viewed);

  if (product.isFeatured || product.isTopSale) score += HIGHLIGHT_BONUS;
  if (isOutOfStock(product)) score -= OUT_OF_STOCK_PENALTY;

  return score;
}

/** Product ids in recommended order; `_id` breaks ties so the order is total. */
export function rankProducts(products: RankableProduct[], signals: Signals, seed: number): string[] {
  return products
    .map((product) => ({
      id: String(product._id),
      score: scoreProduct(product, signals, seed),
    }))
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((entry) => entry.id);
}
