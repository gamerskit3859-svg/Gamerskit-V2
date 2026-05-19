import { Suspense } from "react";
import { CategoryNav } from "@/components/CategoryNav";
import { ProductListing } from "@/components/ProductListing";
import { ShopBanner, ShopBannerLoading } from "@/components/ShopBanner";
import { api } from "@/lib/api";
import { createMetadata, truncateDescription } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;
type ShopSearchParams =
  | Promise<{ category?: string }>
  | Promise<{ [key: string]: string | string[] | undefined }>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: ShopSearchParams;
}) {
  const params = await searchParams;
  const categorySlug = (params as { category?: string }).category;

  if (categorySlug) {
    try {
      const { item } = await api.getCategoryFresh(categorySlug);
      const description = truncateDescription(
        item.description ||
          `Shop ${item.name} at GamersKit with cash on delivery across Bangladesh.`,
      );

      return createMetadata({
        title: `${item.name} | Shop GamersKit`,
        description,
        path: `/shop?category=${encodeURIComponent(item.slug)}`,
        keywords: [item.name, `${item.name} Bangladesh`, "GamersKit category"],
        image: item.image || "/brand/logo.png",
      });
    } catch {
      // Fall through to default shop metadata.
    }
  }

  return createMetadata({
    title: "Shop Gaming Gear, RC Cars & Jerseys",
    description:
      "Browse all GamersKit products including RC drift cars, F1 jerseys, e-sports apparel, and gaming accessories in Bangladesh.",
    path: "/shop",
    keywords: ["shop gaming gear", "RC cars", "F1 jerseys", "Bangladesh"],
  });
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: ShopSearchParams;
}) {
  const categories = await api
    .listCategoriesFresh()
    .then((r) => r.items)
    .catch(() => []);

  return (
    <main className="w-full max-w-full">
      <CategoryNav initialCategories={categories} />
      <Suspense fallback={<ShopBannerLoading />}>
        <ShopBanner />
      </Suspense>
      <ShopContent searchParams={searchParams} />
    </main>
  );
}

async function ShopContent({
  searchParams,
}: {
  searchParams: ShopSearchParams;
}) {
  const params = await searchParams;
  const category = (params as { category?: string }).category;
  const categoryData = category
    ? await api
        .getCategoryFresh(category)
        .then((res) => res.item)
        .catch(() => null)
    : null;

  return (
    <ProductListing
      category={category}
      title={
        categoryData ? `${categoryData.name}.` : "Everything in one place."
      }
      subtitle={
        categoryData?.description ||
        "Free delivery across Bangladesh, cash on delivery available, easy returns."
      }
    />
  );
}
