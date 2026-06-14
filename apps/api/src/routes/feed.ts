import { Router } from "express";
import { CategoryModel } from "../models/Category.js";
import { ProductModel } from "../models/Product.js";

const router = Router();
const BRAND = "GamersKit";
const DEFAULT_SITE_URL =
  process.env.SITE_URL ||
  process.env.FRONTEND_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://gamerskitbd.com";

type FeedCategory = {
  _id: unknown;
  slug?: string;
  name?: string;
};

type FeedProduct = {
  _id: unknown;
  slug: string;
  title: string;
  description?: string;
  category?: unknown;
  categorySlug?: string;
  price: number;
  stock?: number;
  images?: string[];
  variants?: Array<{
    options?: Array<{ stock?: number }>;
  }>;
};

const CATEGORY_IDS: Array<{ pattern: RegExp; id: string }> = [
  { pattern: /(rc|remote).*car|drift/i, id: "1249" },
  { pattern: /(f1|formula|jersey|e-?sports?|esports)/i, id: "5322" },
  { pattern: /(headphone|earbud|headset|audio)/i, id: "2424" },
  { pattern: /(console|playstation|xbox|nintendo)/i, id: "1294" },
];

function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function productStock(product: FeedProduct): number {
  const variantStock = (product.variants ?? []).reduce(
    (sum, group) =>
      sum +
      (group.options ?? []).reduce(
        (optionSum, option) => optionSum + Math.max(0, Number(option.stock) || 0),
        0,
      ),
    0,
  );
  return variantStock > 0 ? variantStock : Math.max(0, Number(product.stock) || 0);
}

function categoryText(product: FeedProduct, categories: Map<string, FeedCategory>): string {
  const byId = product.category ? categories.get(String(product.category)) : undefined;
  return byId?.name || byId?.slug || product.categorySlug || "";
}

function googleCategoryId(text: string): string {
  return CATEGORY_IDS.find((entry) => entry.pattern.test(text))?.id || "166";
}

function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${DEFAULT_SITE_URL.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function feedRows(products: FeedProduct[], categories: Map<string, FeedCategory>) {
  return products
    .filter((product) => product.slug && product.title && product.price > 0)
    .filter((product) => productStock(product) > 0)
    .filter((product) => Boolean(product.images?.[0]))
    .map((product) => {
      const category = categoryText(product, categories);
      const description =
        stripHtml(product.description || product.title).slice(0, 5000) ||
        product.title;
      return {
        id: String(product._id),
        title: product.title,
        description,
        link: absoluteUrl(`/product/${product.slug}`),
        imageLink: product.images?.[0] || "",
        price: `${Number(product.price).toFixed(0)} BDT`,
        availability: "in stock",
        condition: "new",
        brand: BRAND,
        googleProductCategory: googleCategoryId(`${category} ${product.title}`),
        identifierExists: "false",
      };
    });
}

function metaXml(rows: ReturnType<typeof feedRows>): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(BRAND)} Product Feed</title>
    <link>${escapeXml(DEFAULT_SITE_URL)}</link>
    <description>${escapeXml(BRAND)} catalog feed</description>
${rows
  .map(
    (row) => `    <item>
      <g:id>${escapeXml(row.id)}</g:id>
      <g:title>${escapeXml(row.title)}</g:title>
      <g:description>${escapeXml(row.description)}</g:description>
      <g:link>${escapeXml(row.link)}</g:link>
      <g:image_link>${escapeXml(row.imageLink)}</g:image_link>
      <g:price>${escapeXml(row.price)}</g:price>
      <g:availability>${row.availability}</g:availability>
      <g:condition>${row.condition}</g:condition>
      <g:brand>${escapeXml(row.brand)}</g:brand>
      <g:google_product_category>${row.googleProductCategory}</g:google_product_category>
      <g:identifier_exists>${row.identifierExists}</g:identifier_exists>
    </item>`,
  )
  .join("\n")}
  </channel>
</rss>`;
}

function googleTsv(rows: ReturnType<typeof feedRows>): string {
  const headers = [
    "id",
    "title",
    "description",
    "link",
    "image_link",
    "price",
    "availability",
    "condition",
    "brand",
    "google_product_category",
    "identifier_exists",
  ];
  const clean = (value: unknown) => String(value ?? "").replace(/\t|\r|\n/g, " ").trim();
  return [
    headers.join("\t"),
    ...rows.map((row) =>
      [
        row.id,
        row.title,
        row.description,
        row.link,
        row.imageLink,
        row.price,
        row.availability,
        row.condition,
        row.brand,
        row.googleProductCategory,
        row.identifierExists,
      ]
        .map(clean)
        .join("\t"),
    ),
  ].join("\n");
}

router.get("/", async (req, res) => {
  const format = String(req.query.format || "meta").toLowerCase();
  const [products, categories] = await Promise.all([
    ProductModel.find({})
      .select("slug title description category categorySlug price stock images variants")
      .sort({ updatedAt: -1 })
      .lean<FeedProduct[]>(),
    CategoryModel.find({ active: true }).select("slug name").lean<FeedCategory[]>(),
  ]);
  const categoryMap = new Map(categories.map((category) => [String(category._id), category]));
  const rows = feedRows(products, categoryMap);

  res.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=3600");

  if (format === "google") {
    res.type("text/tab-separated-values; charset=utf-8");
    res.send(googleTsv(rows));
    return;
  }

  res.type("application/xml; charset=utf-8");
  res.send(metaXml(rows));
});

export default router;
