import { CategoryNav } from "@/components/CategoryNav";
import { ProductListing } from "@/components/ProductListing";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Shop everything",
};

export default function ShopPage() {
  return (
    <>
      <CategoryNav />
      <ProductListing
        title="Everything in one place."
        subtitle="Free delivery across Bangladesh, cash on delivery available, easy returns."
      />
    </>
  );
}
