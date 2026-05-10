import { Router } from "express";
import { ProductModel } from "../models/Product.js";
import { CategoryModel } from "../models/Category.js";
import { adminRequired } from "../lib/auth.js";

const router = Router();

router.get("/", async (req, res) => {
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
    ProductModel.find(filter)
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

router.get("/:slug", async (req, res) => {
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
  try {
    const updated = await ProductModel.findByIdAndUpdate(req.params.id, req.body, {
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
