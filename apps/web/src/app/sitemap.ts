import type { MetadataRoute } from "next";
import { api } from "@/lib/api";
import { SITE_URL, absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: absoluteUrl("/shop"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/track"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.35,
    },
  ];

  const [products, categories] = await Promise.all([
    api
      .listProducts({ limit: 1000 })
      .then((result) => result.items)
      .catch(() => []),
    api
      .listCategories()
      .then((result) => result.items)
      .catch(() => []),
  ]);

  const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
    url: absoluteUrl(`/product/${product.slug}`),
    lastModified: product.updatedAt ? new Date(product.updatedAt) : now,
    changeFrequency: "weekly",
    priority: 0.8,
    images: product.images?.slice(0, 1).map((image) => absoluteUrl(image)),
  }));

  const categoryRoutes: MetadataRoute.Sitemap = categories
    .filter((category) => category.active !== false && category.slug)
    .map((category) => ({
      url: absoluteUrl(`/shop?category=${encodeURIComponent(category.slug)}`),
      lastModified: category.updatedAt ? new Date(category.updatedAt) : now,
      changeFrequency: "daily",
      priority: category.featured ? 0.75 : 0.65,
      images: category.image ? [absoluteUrl(category.image)] : undefined,
    }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
