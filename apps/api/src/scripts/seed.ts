import { connectDb } from "../db.js";
import { ProductModel } from "../models/Product.js";
import { CategoryModel } from "../models/Category.js";
import { ensureAdmin } from "../lib/auth.js";
import { env } from "../env.js";

type LegacyProduct = {
  _id: string;
  name: string; // category
  title: string;
  description: string;
  price: string | number;
  leftProducts: number;
  totalSizes: number;
  sizes: Record<string, string>;
  mainImage: string;
  subImages: string[];
};

const CATEGORY_MAP: Record<string, string> = {
  car: "rc-car",
  F1: "f1-jersey",
  "E-sports": "esports",
  Tshirt: "tshirt",
  Sleeves: "sleeves",
  Mask: "mask",
  YoYo: "yoyo",
  pc: "pc-accessories",
  Console: "consoles",
};

const CATEGORIES_DATA = [
  { slug: "rc-car", name: "RC Cars", description: "Remote control cars and vehicles" },
  { slug: "f1-jersey", name: "F1 Jerseys", description: "Formula 1 apparel and merchandise" },
  { slug: "esports", name: "E-Sports", description: "E-sports apparel and accessories" },
  { slug: "tshirt", name: "T-Shirts", description: "Custom and branded t-shirts" },
  { slug: "sleeves", name: "Hand Sleeves", description: "Sports hand sleeves" },
  { slug: "mask", name: "Masks", description: "Face masks and protective masks" },
  { slug: "yoyo", name: "YoYo", description: "Professional yoyo toys and equipment" },
  { slug: "pc-accessories", name: "PC Accessories", description: "Computer peripherals and accessories" },
  { slug: "consoles", name: "Consoles", description: "Gaming consoles and systems" },
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function seedCategories() {
  console.log(`[seed] seeding ${CATEGORIES_DATA.length} categories`);
  const categoryMap = new Map<string, string>();

  for (const catData of CATEGORIES_DATA) {
    const existing = await CategoryModel.findOne({ slug: catData.slug });
    if (existing) {
      categoryMap.set(catData.slug, existing._id.toString());
      console.log(`[seed] category "${catData.name}" already exists`);
    } else {
      const created = await CategoryModel.create(catData);
      categoryMap.set(catData.slug, created._id.toString());
      console.log(`[seed] created category "${catData.name}"`);
    }
  }

  return categoryMap;
}

async function main() {
  await connectDb();
  await ensureAdmin();

  // Seed categories first
  const categoryMap = await seedCategories();

  const legacyApi = env.GAMERSKIT_LEGACY_API;
  console.log(`[seed] fetching products from ${legacyApi}/addedProducts`);
  const res = await fetch(`${legacyApi}/addedProducts`);
  if (!res.ok) {
    throw new Error(`legacy api responded ${res.status}`);
  }
  const data = (await res.json()) as LegacyProduct[];
  console.log(`[seed] received ${data.length} products`);

  let created = 0;
  let updated = 0;
  for (const p of data) {
    const categorySlug = CATEGORY_MAP[p.name] ?? "rc-car";
    const categoryId = categoryMap.get(categorySlug);
    
    if (!categoryId) {
      console.warn(`[seed] category not found for slug: ${categorySlug}`);
      continue;
    }

    const baseSlug = slugify(p.title);
    const slug = `${baseSlug}-${p._id.slice(-5)}`;
    const images = [p.mainImage, ...(p.subImages ?? [])].filter(
      (img): img is string => Boolean(img && img.trim()),
    );
    const price = Number(p.price);

    const doc = {
      slug,
      title: p.title,
      description: p.description,
      category: categoryId,
      categorySlug, // keep for compatibility
      price,
      stock: p.leftProducts ?? 0,
      images,
      featured: false,
      legacyId: p._id,
    };

    const existing = await ProductModel.findOne({ legacyId: p._id });
    if (existing) {
      await ProductModel.updateOne({ _id: existing._id }, doc);
      updated++;
    } else {
      await ProductModel.create(doc);
      created++;
    }
  }

  // mark a few products as featured
  const featuredSlugs = await ProductModel.find()
    .sort({ stock: -1 })
    .limit(4)
    .select("_id");
  await ProductModel.updateMany(
    { _id: { $in: featuredSlugs.map((d) => d._id) } },
    { featured: true },
  );

  console.log(`[seed] done — created=${created}, updated=${updated}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] failed", err);
  process.exit(1);
});
