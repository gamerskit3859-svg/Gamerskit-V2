import { api } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";
import { CategoryNav } from "@/components/CategoryNav";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Shop everything",
};

export default async function ShopPage() {
  let items: Awaited<ReturnType<typeof api.listProducts>>["items"] = [];
  try {
    const r = await api.listProducts({});
    items = r.items;
  } catch {
    items = [];
  }
  return (
    <>
      <CategoryNav />
      <section className="px-5 lg:px-8 max-w-[1280px] mx-auto py-12">
        <header className="mb-10">
          <span className="eyebrow">Shop</span>
          <h1 className="display-2 mt-2">Everything in one place.</h1>
          <p className="mt-3 text-[var(--fg-soft)] max-w-2xl">
            {items.length} products. Free delivery across Bangladesh, cash on
            delivery available, easy returns.
          </p>
        </header>
        {items.length === 0 ? (
          <div className="card-soft p-10 text-center text-[var(--fg-soft)]">
            No products. Seed the database with{" "}
            <code className="text-[var(--fg)]">npm run seed</code>.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-12">
            {items.map((p, i) => (
              <ProductCard product={p} key={p._id} index={i} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
