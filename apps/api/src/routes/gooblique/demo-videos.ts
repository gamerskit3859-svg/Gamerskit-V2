import { Router } from "express";
import { z } from "zod";
import { adminRequired } from "../../lib/auth.js";
import { setPrivateNoStore } from "../../lib/http.js";
import { deleteFromR2, deleteFromR2Quietly, uploadToR2 } from "../../lib/r2.js";
import { singleVideoUpload } from "../../lib/upload.js";
import { DemoVideoModel } from "../../models/DemoVideo.js";

const router = Router();
const R2_FOLDER = "demo-videos";

const titleSchema = z.string().trim().min(1).max(100);
const orientationSchema = z.enum(["portrait", "landscape"]);

// List every demo video in the admin-defined order, newest first as a
// tie-breaker for legacy documents (public).
router.get("/", async (_req, res) => {
  const items = await DemoVideoModel.find({})
    .sort({ order: 1, createdAt: -1 })
    .lean();

  setPrivateNoStore(res);
  res.json({ items });
});

// Upload a new demo video (admin or staff).
router.post("/", adminRequired, singleVideoUpload, async (req, res) => {
  const parsed = titleSchema.safeParse(req.body?.title);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const orientationParsed = orientationSchema
    .default("portrait")
    .safeParse(req.body?.orientation);
  if (!orientationParsed.success) {
    res.status(400).json({ error: orientationParsed.error.flatten() });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "video is required" });
    return;
  }

  const video = await uploadToR2(req.file, R2_FOLDER);

  // New videos append to the end of the current order.
  const last = await DemoVideoModel.findOne().sort({ order: -1 }).lean();
  const order = (last?.order ?? 0) + 1;

  try {
    const item = await DemoVideoModel.create({
      title: parsed.data,
      video,
      order,
      orientation: orientationParsed.data,
    });
    res.status(201).json({ item });
  } catch (err) {
    // The object is already in the bucket but has no owning document.
    await deleteFromR2Quietly(video.key);
    throw err;
  }
});

// Update the title and optionally replace the video (admin or staff).
router.put("/:id", adminRequired, singleVideoUpload, async (req, res) => {
  const parsed = titleSchema.optional().safeParse(req.body?.title);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const orientationParsed = orientationSchema
    .optional()
    .safeParse(req.body?.orientation);
  if (!orientationParsed.success) {
    res.status(400).json({ error: orientationParsed.error.flatten() });
    return;
  }

  const existing = await DemoVideoModel.findById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "demo video not found" });
    return;
  }

  if (parsed.data !== undefined) {
    existing.title = parsed.data;
  }
  if (orientationParsed.data !== undefined) {
    existing.orientation = orientationParsed.data;
  }

  if (!req.file) {
    await existing.save();
    res.json({ item: existing.toObject() });
    return;
  }

  const previousKey = existing.video?.key as string | undefined;
  const video = await uploadToR2(req.file, R2_FOLDER);
  existing.video = video;

  try {
    await existing.save();
  } catch (err) {
    await deleteFromR2Quietly(video.key);
    throw err;
  }

  // Only drop the old object once the new one is committed to the database.
  if (previousKey && previousKey !== video.key) {
    await deleteFromR2Quietly(previousKey);
  }

  res.json({ item: existing.toObject() });
});

// Reorder demo videos (admin or staff). Accepts an array of { id, order }.
const reorderSchema = z.object({
  order: z
    .array(
      z.object({
        id: z.string().min(1),
        order: z.number().int().min(0),
      }),
    )
    .max(200),
});

router.post("/reorder", adminRequired, async (req, res) => {
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  await Promise.all(
    parsed.data.order.map((item) =>
      DemoVideoModel.updateOne({ _id: item.id }, { order: item.order }),
    ),
  );

  const items = await DemoVideoModel.find({})
    .sort({ order: 1, createdAt: -1 })
    .lean();

  setPrivateNoStore(res);
  res.json({ items });
});

// Delete the video from R2 and remove its document (admin or staff).
router.delete("/:id", adminRequired, async (req, res) => {
  const existing = await DemoVideoModel.findById(req.params.id).lean();
  if (!existing) {
    res.status(404).json({ error: "demo video not found" });
    return;
  }

  // R2 first: a failure here must not leave a dangling bucket object.
  await deleteFromR2(existing.video?.key ?? "");
  await DemoVideoModel.deleteOne({ _id: existing._id });

  res.json({ item: existing });
});

export default router;
