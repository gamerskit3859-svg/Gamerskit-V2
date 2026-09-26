import { Router } from "express";
import { z } from "zod";
import { adminRequired } from "../lib/auth.js";
import { SiteSettingsModel } from "../models/SiteSettings.js";
import { setPrivateNoStore } from "../lib/http.js";

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

export const CONTACT_CHANNEL_TYPES = [
  "whatsapp",
  "messenger",
  "telegram",
  "instagram",
  "phone",
  "email",
  "custom",
] as const;

type ContactChannel = {
  _id?: unknown;
  type: (typeof CONTACT_CHANNEL_TYPES)[number];
  label: string;
  description?: string;
  value: string;
  order?: number;
  isActive?: boolean;
  createdAt?: Date;
};

const contactChannelSchema = z.object({
  type: z.enum(CONTACT_CHANNEL_TYPES),
  label: z.string().trim().min(1).max(60),
  description: z.string().trim().max(120).default(""),
  value: z.string().trim().min(1).max(300),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

/**
 * wa.me and friends need a full international number, but Bangladeshi numbers
 * are almost always written locally as 01XXXXXXXXX. Expanding that one
 * well-known shape beats serving a link that silently goes nowhere.
 */
function toInternational(digits: string): string {
  return digits.length === 11 && digits.startsWith("01") ? `88${digits}` : digits;
}

/**
 * Turn a stored handle into something a browser can open. A value that is
 * already a full URL is passed through untouched, so "custom" can point
 * anywhere.
 */
export function contactHref(type: string, value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = raw.replace(/^@/, "");
  const digits = raw.replace(/\D/g, "");
  switch (type) {
    case "whatsapp":
      return digits ? `https://wa.me/${toInternational(digits)}` : "";
    case "messenger":
      return `https://m.me/${handle}`;
    case "telegram":
      return `https://t.me/${handle}`;
    case "instagram":
      return `https://instagram.com/${handle}`;
    case "phone":
      return digits ? `tel:${raw.replace(/\s+/g, "")}` : "";
    case "email":
      return `mailto:${raw}`;
    default:
      return raw;
  }
}

async function getSettings() {
  return SiteSettingsModel.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { $setOnInsert: { key: SETTINGS_KEY, shopBanners: [], contactChannels: [] } },
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

router.get("/contact-channels", async (_req, res) => {
  const settings = await readSettings();
  const items = sortBanners(
    ((settings?.contactChannels ?? []) as ContactChannel[]).filter(
      (channel) => channel.isActive && channel.value,
    ),
  )
    // The storefront gets a ready-to-use href and never the raw handle logic.
    .map((channel) => ({
      _id: channel._id,
      type: channel.type,
      label: channel.label,
      description: channel.description ?? "",
      href: contactHref(channel.type, channel.value),
    }))
    .filter((channel) => channel.href);
  setPrivateNoStore(res);
  res.json({ items });
});

router.get("/contact-channels/admin/all", adminRequired, async (_req, res) => {
  setPrivateNoStore(res);
  const settings = await getSettings();
  res.json({ items: sortBanners(settings.contactChannels as ContactChannel[]) });
});

router.post("/contact-channels", adminRequired, async (req, res) => {
  const parsed = contactChannelSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const settings = await getSettings();
  const maxOrder = (settings.contactChannels as ContactChannel[]).reduce(
    (max: number, channel: ContactChannel) => Math.max(max, channel.order ?? 0),
    -1,
  );
  settings.contactChannels.push({
    ...parsed.data,
    order: parsed.data.order ?? maxOrder + 1,
    isActive: parsed.data.isActive ?? true,
  });
  await settings.save();

  res.status(201).json({ item: settings.contactChannels.at(-1) });
});

router.patch("/contact-channels/:id", adminRequired, async (req, res) => {
  const parsed = contactChannelSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const settings = await getSettings();
  const channel = settings.contactChannels.id(req.params.id);
  if (!channel) {
    res.status(404).json({ error: "contact channel not found" });
    return;
  }

  Object.assign(channel, parsed.data);
  await settings.save();
  res.json({ item: channel });
});

router.delete("/contact-channels/:id", adminRequired, async (req, res) => {
  const settings = await getSettings();
  const channel = settings.contactChannels.id(req.params.id);
  if (!channel) {
    res.status(404).json({ error: "contact channel not found" });
    return;
  }

  channel.deleteOne();
  await settings.save();
  res.status(204).end();
});

router.get("/shop-banners", async (_req, res) => {
  const settings = await readSettings();
  const items = sortBanners(
    ((settings?.shopBanners ?? []) as ShopBanner[]).filter(
      (banner) => banner.isActive && banner.imageUrl,
    ),
  );
  setPrivateNoStore(res);
  res.json({ items });
});

router.get("/shop-banners/admin/all", adminRequired, async (_req, res) => {
  setPrivateNoStore(res);
  const settings = await getSettings();
  res.json({ items: sortBanners(settings.shopBanners as ShopBanner[]) });
});

router.post("/shop-banners", adminRequired, async (req, res) => {
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

router.patch("/shop-banners/:id", adminRequired, async (req, res) => {
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

router.delete("/shop-banners/:id", adminRequired, async (req, res) => {
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

router.post("/shop-banners/reorder", adminRequired, async (req, res) => {
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
