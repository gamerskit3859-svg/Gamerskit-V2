import { Router } from "express";
import { z } from "zod";
import { adminRequired } from "../lib/auth.js";
import { SiteSettingsModel } from "../models/SiteSettings.js";

const router = Router();
const SETTINGS_KEY = "global";

const DEFAULT_ANNOUNCEMENT = {
  enabled: true,
  codText: "Full Cash on Delivery",
  deliveryText: "Free Delivery All Over Bangladesh",
  offerText: "Offer ends in",
};

const DEFAULT_SHOP_BANNER = {
  imageUrl: "",
  publicId: "",
};

const announcementSchema = z.object({
  enabled: z.boolean(),
  codText: z.string().trim().min(1).max(120),
  deliveryText: z.string().trim().min(1).max(140),
  offerText: z.string().trim().min(1).max(100),
});

const shopBannerSchema = z.object({
  imageUrl: z.string().trim().url().or(z.literal("")),
  publicId: z.string().trim().max(240).default(""),
});

async function getSettings() {
  return SiteSettingsModel.findOneAndUpdate(
    { key: SETTINGS_KEY },
    {
      $setOnInsert: {
        key: SETTINGS_KEY,
        announcementBar: DEFAULT_ANNOUNCEMENT,
        shopBanner: DEFAULT_SHOP_BANNER,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
}

router.get("/shop-banner", async (_req, res) => {
  const settings = await getSettings();
  res.json({ item: settings.shopBanner ?? DEFAULT_SHOP_BANNER });
});

router.put("/shop-banner", adminRequired, async (req, res) => {
  const parsed = shopBannerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const settings = await SiteSettingsModel.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { $set: { key: SETTINGS_KEY, shopBanner: parsed.data } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();

  res.json({ item: settings.shopBanner ?? DEFAULT_SHOP_BANNER });
});

router.get("/announcement-bar", async (_req, res) => {
  const settings = await getSettings();
  res.json({ item: settings.announcementBar ?? DEFAULT_ANNOUNCEMENT });
});

router.put("/announcement-bar", adminRequired, async (req, res) => {
  const parsed = announcementSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const settings = await SiteSettingsModel.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { $set: { key: SETTINGS_KEY, announcementBar: parsed.data } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();

  res.json({ item: settings.announcementBar });
});

export default router;
