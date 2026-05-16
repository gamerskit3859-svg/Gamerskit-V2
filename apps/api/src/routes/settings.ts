import { Router } from "express";
import { z } from "zod";
import { adminOnlyRequired } from "../lib/auth.js";
import { SiteSettingsModel } from "../models/SiteSettings.js";
import { setPublicCache } from "../lib/http.js";

const router = Router();
const SETTINGS_KEY = "global";

type ShopBanner = {
  _id?: unknown;
  imageUrl: string;
  publicId: string;
  order?: number;
  isActive?: boolean;
  createdAt?: Date;
};

const shopBannerSchema = z.object({
  imageUrl: z.string().trim().url(),
  publicId: z.string().trim().max(240).default(""),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

async function getSettings() {
  return SiteSettingsModel.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { $setOnInsert: { key: SETTINGS_KEY, shopBanners: [] } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

async function readSettings() {
  return SiteSettingsModel.findOne({ key: SETTINGS_KEY }).lean();
}

function sortBanners<T extends { order?: number; createdAt?: Date }>(items: T[]) {
  return [...items].sort(
    (a, b) =>
      (a.order ?? 0) - (b.order ?? 0) ||
      new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime(),
  );
}

router.get("/shop-banners", async (_req, res) => {
  const settings = await readSettings();
  const items = sortBanners(
    ((settings?.shopBanners ?? []) as ShopBanner[]).filter(
      (banner) => banner.isActive && banner.imageUrl,
    ),
  );
  setPublicCache(res, 60, 300);
  res.json({ items });
});

router.get("/shop-banners/admin/all", adminOnlyRequired, async (_req, res) => {
  const settings = await getSettings();
  res.json({ items: sortBanners(settings.shopBanners as ShopBanner[]) });
});

router.post("/shop-banners", adminOnlyRequired, async (req, res) => {
  const parsed = shopBannerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const settings = await getSettings();
  const maxOrder = (settings.shopBanners as ShopBanner[]).reduce(
    (max: number, banner: ShopBanner) => Math.max(max, banner.order ?? 0),
    -1,
  );
  settings.shopBanners.push({
    imageUrl: parsed.data.imageUrl,
    publicId: parsed.data.publicId,
    order: parsed.data.order ?? maxOrder + 1,
    isActive: parsed.data.isActive ?? true,
  });
  await settings.save();

  res.status(201).json({ item: settings.shopBanners.at(-1) });
});

router.patch("/shop-banners/:id", adminOnlyRequired, async (req, res) => {
  const parsed = shopBannerSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const settings = await getSettings();
  const banner = settings.shopBanners.id(req.params.id);
  if (!banner) {
    res.status(404).json({ error: "shop banner not found" });
    return;
  }

  Object.assign(banner, parsed.data);
  await settings.save();
  res.json({ item: banner });
});

router.delete("/shop-banners/:id", adminOnlyRequired, async (req, res) => {
  const settings = await getSettings();
  const banner = settings.shopBanners.id(req.params.id);
  if (!banner) {
    res.status(404).json({ error: "shop banner not found" });
    return;
  }

  banner.deleteOne();
  await settings.save();
  res.status(204).end();
});

router.post("/shop-banners/reorder", adminOnlyRequired, async (req, res) => {
  const parsed = z
    .object({
      order: z.array(z.object({ id: z.string(), order: z.number().int().min(0) })),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const settings = await getSettings();
  for (const entry of parsed.data.order) {
    const banner = settings.shopBanners.id(entry.id);
    if (banner) banner.order = entry.order;
  }
  await settings.save();
  res.json({ items: sortBanners(settings.shopBanners as ShopBanner[]) });
});

export default router;
