import path from "node:path";
import { Router } from "express";
import { z } from "zod";
import { adminRequired } from "../../lib/auth.js";
import { setPrivateNoStore } from "../../lib/http.js";
import { deleteFromR2Quietly, uploadToR2 } from "../../lib/r2.js";
import { mediaTypeFromExtension, singleMediaUpload } from "../../lib/upload.js";
import { HeroModel } from "../../models/Hero.js";

const router = Router();
const HERO_KEY = "global";
const R2_FOLDER = "hero";

const heroSchema = z.object({
  title: z.string().trim().min(3).max(120),
  subtitle: z.string().trim().min(5).max(300),
});

// Get the hero content (public). Falls back to empty strings before first save.
router.get("/", async (_req, res) => {
  const hero = await HeroModel.findOne({ key: HERO_KEY })
    .select("title subtitle media")
    .lean();

  setPrivateNoStore(res);
  res.json({
    title: hero?.title ?? "",
    subtitle: hero?.subtitle ?? "",
    media: hero?.media ?? null,
  });
});

// Create or update the single hero document (admin or staff).
router.put("/", adminRequired, singleMediaUpload, async (req, res) => {
  const parsed = heroSchema.safeParse({
    title: req.body?.title,
    subtitle: req.body?.subtitle,
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const update: Record<string, unknown> = { ...parsed.data };
  let previousMediaKey: string | undefined;

  if (req.file) {
    const existing = await HeroModel.findOne({ key: HERO_KEY })
      .select("media")
      .lean();
    previousMediaKey = existing?.media?.key;

    const type = mediaTypeFromExtension(path.extname(req.file.originalname).toLowerCase());
    const uploaded = await uploadToR2(req.file, R2_FOLDER);
    update.media = { type, url: uploaded.url, key: uploaded.key };
  }

  const hero = await HeroModel.findOneAndUpdate(
    { key: HERO_KEY },
    { $set: update, $setOnInsert: { key: HERO_KEY } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  )
    .select("title subtitle media")
    .lean();

  // Only drop the old object once the new one is committed to the database.
  if (previousMediaKey && previousMediaKey !== hero.media?.key) {
    await deleteFromR2Quietly(previousMediaKey);
  }

  setPrivateNoStore(res);
  res.json({ title: hero.title, subtitle: hero.subtitle, media: hero.media ?? null });
});

export default router;
