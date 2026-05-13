import { Router } from "express";
import { z } from "zod";
import { ProductModel } from "../models/Product.js";
import { CategoryModel } from "../models/Category.js";
import { adminRequired } from "../lib/auth.js";
import { cacheControl } from "../lib/cache.js";

const router = Router();

// Cards on the storefront only need a small subset of fields. Excluding the
// long `description` keeps the list payload small (sometimes 5-10x smaller
// for catalogs with rich product copy).
const LIST_PROJECTION = {
  description: 0,
  __v: 0,
} as const;

const productUpdateSchema = z
  .object({
    slug: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    categorySlug: z.string().optional(),
    price: z.number().min(0).optional(),
    compareAtPrice: z.number().min(0).nullable().optional(),
    currency: z.string().optional(),
    images: z.array(z.string()).optional(),
    stock: z.number().int().min(0).optional(),
    lowStockAt: z.number().int().min(0).optional(),
    featured: z.boolean().optional(),
    legacyId: z.string().optional(),
  })
  .strict();

router.get("/", cacheControl({ maxAge: 30, sMaxAge: 120 }), async (req, res) => {
  const { category, q, featured, page = "1", limit = "20" } = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  
  if (category && category !== "all") {
    // Try to find category by slug first
    const categoryDoc = await CategoryModel.findOne({ slug: category });
    if (categoryDoc) {
      filter.category = categoryDoc._id;
    } else {
      // Fallback to string comparison for backward compatibility
      filter.$or = [
        { category: category },
        { categorySlug: category }
      ];
    }
  }
  
  if (featured === "true") filter.featured = true;
  if (q) filter.$text = { $search: q };
  
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(Number(limit) || 20, 100);
  const skip = (pageNum - 1) * limitNum;
  
  const [items, total] = await Promise.all([
    ProductModel.find(filter, LIST_PROJECTION)
      .sort({ featured: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    ProductModel.countDocuments(filter),
  ]);
  
  const totalPages = Math.ceil(total / limitNum);
  
  res.json({ 
    items, 
    total, 
    page: pageNum, 
    limit: limitNum,
    totalPages,
    hasMore: pageNum < totalPages,
  });
});

router.get("/:slug", cacheControl({ maxAge: 60, sMaxAge: 300 }), async (req, res) => {
  const item = await ProductModel.findOne({ slug: req.params.slug }).lean();
  if (!item) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json({ item });
});

router.post("/", adminRequired, async (req, res) => {
  try {
    const created = await ProductModel.create(req.body);
    res.status(201).json({ item: created });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.patch("/:id", adminRequired, async (req, res) => {
  // Allowlist incoming fields so admins can't accidentally overwrite
  // internal Mongo fields (_id, createdAt, etc.) or set unexpected props.
  const parsed = productUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const updated = await ProductModel.findByIdAndUpdate(
      req.params.id,
      parsed.data,
      { new: true },
    ).lean();
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
