import { CategoryNav } from "@/components/CategoryNav";
import { ProductListing } from "@/components/ProductListing";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Shop everything",
};

export default function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }> | Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // searchParams is async in Next.js App Router
  const getParams = async () => {
    const params = await searchParams;
    return params as { category?: string };
  };
  
  return (
    <>
      <CategoryNav />
      <ShopContent searchParams={searchParams} />
    </>
  );
}

async function ShopContent({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }> | Promise<{ [key: string]: string | string[] | undefined }>;
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
