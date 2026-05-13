import { Router } from "express";
import { HeroImageModel } from "../models/HeroImage.js";
import { adminRequired } from "../lib/auth.js";
import { cacheControl } from "../lib/cache.js";

const router = Router();

// Get all active hero images sorted by order (public)
router.get("/", cacheControl({ maxAge: 120, sMaxAge: 600 }), async (req, res) => {
  try {
    const images = await HeroImageModel.find({ isActive: true })
      .sort({ order: 1 })
      .lean();

    res.json({ items: images });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Get all hero images including inactive (admin only)
router.get("/admin/all", adminRequired, async (req, res) => {
  try {
    const images = await HeroImageModel.find({})
      .sort({ order: 1 })
      .lean();

    res.json({ items: images });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Create hero image (admin only)
router.post("/", adminRequired, async (req, res) => {
  try {
    const { imageUrl, publicId, order, isActive, title, subtitle, link } = req.body;

    if (!imageUrl || publicId === undefined) {
      res.status(400).json({ error: "imageUrl and publicId are required" });
      return;
    }

    // If order is not provided, set it to max order + 1
    let finalOrder = order;
    if (finalOrder === undefined) {
      const maxOrder = await HeroImageModel.findOne().sort({ order: -1 }).lean();
      finalOrder = (maxOrder?.order ?? 0) + 1;
    }

    const image = await HeroImageModel.create({
      imageUrl,
      publicId,
      order: finalOrder,
      isActive: isActive ?? true,
      title: title || "",
      subtitle: subtitle || "",
      link: link || "",
    });

    res.status(201).json({ item: image });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Update hero image (admin only)
router.patch("/:id", adminRequired, async (req, res) => {
  try {
    const { imageUrl, order, isActive, title, subtitle, link } = req.body;

    const updateData: Record<string, unknown> = {};
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (order !== undefined) updateData.order = order;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (title !== undefined) updateData.title = title;
    if (subtitle !== undefined) updateData.subtitle = subtitle;
    if (link !== undefined) updateData.link = link;

    const image = await HeroImageModel.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true },
    ).lean();

    if (!image) {
      res.status(404).json({ error: "not found" });
      return;
    }

    res.json({ item: image });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Delete hero image (admin only)
router.delete("/:id", adminRequired, async (req, res) => {
  try {
    const image = await HeroImageModel.findByIdAndDelete(req.params.id).lean();

    if (!image) {
      res.status(404).json({ error: "not found" });
      return;
    }

    res.json({ item: image });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Reorder hero images (admin only)
router.post("/reorder", adminRequired, async (req, res) => {
  try {
    const { order } = req.body; // Array of { id, order } objects

    if (!Array.isArray(order)) {
      res.status(400).json({ error: "order must be an array of { id, order } objects" });
      return;
    }

    const updates = await Promise.all(
      order.map((item) =>
        HeroImageModel.findByIdAndUpdate(
          item.id,
          { order: item.order },
          { new: true },
        ),
      ),
    );

    res.json({ items: updates });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

export default router;
