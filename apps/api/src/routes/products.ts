import { Router } from "express";
import type { SortOrder } from "mongoose";
import { ProductModel } from "../models/Product.js";
import { CategoryModel } from "../models/Category.js";
import { adminRequired } from "../lib/auth.js";
import { setPrivateNoStore } from "../lib/http.js";

const router = Router();
const PUBLIC_PRODUCT_FIELDS =
  "slug title description category categorySlug price compareAtPrice stock images variants isFeatured isBestSelling isNewArrival featured createdAt updatedAt";

type VariantGroup = {
  name?: string;
  options?: Array<{ value?: string; stock?: number; sku?: string; price?: number }>;
};

function hasVariants(product: { variants?: VariantGroup[] }) {
  return Array.isArray(product.variants) && product.variants.some((group) => group.options?.length);
}

function variantStock(variants?: VariantGroup[]) {
  if (!Array.isArray(variants)) return 0;
  return variants.reduce(
    (sum, group) =>
      sum +
      (group.options ?? []).reduce(
        (optionSum, option) => optionSum + Math.max(0, Number(option.stock) || 0),
        0,
      ),
    0,
  );
}

function normalizeVariants(input: unknown): VariantGroup[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((group) => {
      const raw = group as VariantGroup;
      const name = String(raw.name ?? "").trim();
      const seen = new Set<string>();
      const options = (raw.options ?? [])
        .map((option) => ({
          value: String(option.value ?? "").trim(),
          stock: Math.max(0, Number(option.stock) || 0),
          sku: option.sku ? String(option.sku).trim() : undefined,
          price:
            option.price !== undefined && option.price !== null && Number(option.price) >= 0
              ? Number(option.price)
              : undefined,
        }))
        .filter((option) => {
          const key = option.value.toLowerCase();
          if (!option.value || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      return { name, options };
    })
    .filter((group) => group.name && group.options.length);
}

function withComputedStock<T extends { variants?: VariantGroup[]; stock?: number }>(product: T) {
  if (!hasVariants(product)) return product;
  return { ...product, stock: variantStock(product.variants) };
}

router.get("/", async (req, res) => {
  const {
    category,
    q,
    featured,
    isFeatured,
    bestSelling,
    isBestSelling,
    newArrival,
    isNewArrival,
    stock,
    page = "1",
    limit = "20",
  } = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  const andConditions: Record<string, unknown>[] = [];
  
  if (category && category !== "all") {
    const categoryDoc = await CategoryModel.findOne({ slug: category })
      .select("_id")
      .lean();
    if (categoryDoc) {
      const activeCategories = await CategoryModel.find({ active: true })
        .select("_id parentId")
        .lean();
      const childMap = new Map<string, string[]>();
      activeCategories.forEach((cat) => {
        if (!cat.parentId) return;
        const key = String(cat.parentId);
        childMap.set(key, [...(childMap.get(key) || []), String(cat._id)]);
      });
      const ids = new Set<string>([String(categoryDoc._id)]);
      const stack = [...(childMap.get(String(categoryDoc._id)) || [])];
      while (stack.length > 0) {
        const id = stack.pop();
        if (!id || ids.has(id)) continue;
        ids.add(id);
        stack.push(...(childMap.get(id) || []));
      }
      filter.category = { $in: Array.from(ids) };
    } else {
      andConditions.push({
        $or: [
        { category: category },
        { categorySlug: category }
        ],
      });
    }
  }
  
  if (featured === "true" || isFeatured === "true") {
    andConditions.push({ $or: [{ isFeatured: true }, { featured: true }] });
  }
  if (bestSelling === "true" || isBestSelling === "true") {
    filter.isBestSelling = true;
  }
  if (newArrival === "true" || isNewArrival === "true") {
    filter.isNewArrival = true;
  }
  if (stock === "low") filter.stock = { $gt: 0, $lte: 3 };
  if (stock === "out") filter.stock = { $lte: 0 };
  if (q) filter.$text = { $search: q };
  if (andConditions.length) filter.$and = andConditions;
  
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Math.min(Number(limit) || 20, 100));
  const skip = (pageNum - 1) * limitNum;
  const sort: Record<string, SortOrder | { $meta: "textScore" }> = q
    ? { score: { $meta: "textScore" }, isFeatured: -1, createdAt: -1 }
    : { isFeatured: -1, createdAt: -1 };
  
  const [rawItems, total] = await Promise.all([
    ProductModel.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .select(PUBLIC_PRODUCT_FIELDS)
      .lean(),
    ProductModel.countDocuments(filter),
  ]);
  const items = rawItems.map(withComputedStock);
  
  const totalPages = Math.ceil(total / limitNum);
  
  setPrivateNoStore(res);

  res.json({
    items, 
    total, 
    page: pageNum, 
    limit: limitNum,
    totalPages,
    hasMore: pageNum < totalPages,
  });
});

router.get("/:slug", async (req, res) => {
  const item = await ProductModel.findOne({ slug: req.params.slug })
    .select(PUBLIC_PRODUCT_FIELDS)
    .lean();
  if (!item) {
    res.status(404).json({ error: "not found" });
    return;
  }
  setPrivateNoStore(res);
  res.json({ item: withComputedStock(item) });
});

router.post("/", adminRequired, async (req, res) => {
  try {
    const variants = normalizeVariants(req.body.variants);
    const created = await ProductModel.create({
      ...req.body,
      variants,
      stock: variants.length ? variantStock(variants) : Math.max(0, Number(req.body.stock) || 0),
      featured: req.body.isFeatured ?? req.body.featured ?? false,
      isFeatured: req.body.isFeatured ?? req.body.featured ?? false,
    });
    res.status(201).json({ item: created });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.patch("/:id", adminRequired, async (req, res) => {
  try {
    const variants =
      req.body.variants !== undefined ? normalizeVariants(req.body.variants) : undefined;
    const update = {
      ...req.body,
      ...(variants !== undefined
        ? {
            variants,
            stock: variants.length ? variantStock(variants) : Math.max(0, Number(req.body.stock) || 0),
          }
        : {}),
      ...(req.body.isFeatured !== undefined || req.body.featured !== undefined
        ? {
            featured: req.body.isFeatured ?? req.body.featured,
            isFeatured: req.body.isFeatured ?? req.body.featured,
          }
        : {}),
    };
    const updated = await ProductModel.findByIdAndUpdate(req.params.id, update, {
      new: true,
    }).lean();
    if (!updated) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json({ item: updated });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.delete("/:id", adminRequired, async (req, res) => {
  await ProductModel.findByIdAndDelete(req.params.id);
  res.status(204).end();
});

export default router;
