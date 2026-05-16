import { Suspense } from "react";
import { CategoryNav } from "@/components/CategoryNav";
import { ProductListing } from "@/components/ProductListing";
import { ShopBanner, ShopBannerLoading } from "@/components/ShopBanner";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Shop everything",
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams:
    | Promise<{ category?: string }>
    | Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const categories = await api
    .listCategories()
    .then((r) => r.items)
    .catch(() => []);

  return (
    <>
      <Suspense fallback={<ShopBannerLoading />}>
        <ShopBanner />
      </Suspense>
      <CategoryNav initialCategories={categories} />
      <ShopContent searchParams={searchParams} />
    </>
  );
}

async function ShopContent({
  searchParams,
}: {
  searchParams:
    | Promise<{ category?: string }>
    | Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const category = (params as { category?: string }).category;

  return (
    <ProductListing
      category={category}
      title="Everything in one place."
      subtitle="Free delivery across Bangladesh, cash on delivery available, easy returns."
    />
  );
}
