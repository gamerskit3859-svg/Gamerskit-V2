import { Router } from "express";
import { HeroImageModel } from "../models/HeroImage.js";
import { adminRequired } from "../lib/auth.js";
import { setPrivateNoStore } from "../lib/http.js";

const router = Router();
const PUBLIC_HERO_FIELDS = "imageUrl mediaUrl mediaType publicId order isActive title subtitle link";

// Get all active hero images sorted by order (public)
router.get("/", async (req, res) => {
  try {
    const images = await HeroImageModel.find({ isActive: true })
      .sort({ order: 1 })
      .select(PUBLIC_HERO_FIELDS)
      .lean();

    setPrivateNoStore(res);
    res.json({ items: images });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Get all hero images including inactive (admin only)
router.get("/admin/all", adminRequired, async (req, res) => {
  try {
    setPrivateNoStore(res);
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
    const {
      imageUrl,
      mediaUrl,
      mediaType = "image",
      publicId,
      order,
      isActive,
      title,
      subtitle,
      link,
    } = req.body;
    const finalMediaUrl = mediaUrl || imageUrl;

    if (!finalMediaUrl || publicId === undefined) {
      res.status(400).json({ error: "mediaUrl and publicId are required" });
      return;
    }
    if (mediaType !== "image" && mediaType !== "video") {
      res.status(400).json({ error: "mediaType must be image or video" });
      return;
    }

    let finalOrder = order;
    if (finalOrder === undefined) {
      const maxOrder = await HeroImageModel.findOne().sort({ order: -1 }).lean();
      finalOrder = (maxOrder?.order ?? 0) + 1;
    }

    const image = await HeroImageModel.create({
      imageUrl: finalMediaUrl,
      mediaUrl: finalMediaUrl,
      mediaType,
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
    const { imageUrl, mediaUrl, mediaType, order, isActive, title, subtitle, link } = req.body;

    const updateData: Record<string, unknown> = {};
    if (mediaUrl !== undefined || imageUrl !== undefined) {
      const finalMediaUrl = mediaUrl ?? imageUrl;
      updateData.mediaUrl = finalMediaUrl;
      updateData.imageUrl = finalMediaUrl;
    }
    if (mediaType !== undefined) {
      if (mediaType !== "image" && mediaType !== "video") {
        res.status(400).json({ error: "mediaType must be image or video" });
        return;
      }
      updateData.mediaType = mediaType;
    }
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
