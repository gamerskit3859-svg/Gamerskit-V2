import { Router } from "express";
import { ProductModel } from "../models/Product.js";
import { adminRequired } from "../lib/auth.js";

const router = Router();

router.get("/", async (req, res) => {
  const { category, q, featured, limit = "60" } = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (category && category !== "all") filter.category = category;
  if (featured === "true") filter.featured = true;
  if (q) filter.$text = { $search: q };
  const items = await ProductModel.find(filter)
    .sort({ featured: -1, createdAt: -1 })
    .limit(Math.min(Number(limit) || 60, 200))
    .lean();
  res.json({ items });
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
