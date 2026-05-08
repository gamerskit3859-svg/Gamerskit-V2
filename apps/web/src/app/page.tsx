import Link from "next/link";
import { api } from "@/lib/api";
import { Hero } from "@/components/Hero";
import { CategoryTiles } from "@/components/CategoryTiles";
import { Marquee } from "@/components/Marquee";
import { ProductCard } from "@/components/ProductCard";
import type { Product } from "@gamerskit/shared";

export const dynamic = "force-dynamic";

export default async function Home() {
  let featured: Product[] = [];
  let bestSellers: Product[] = [];
  try {
    const [f, all] = await Promise.all([
      api.listProducts({ featured: true }),
      api.listProducts({}),
    ]);
    featured = f.items.slice(0, 4);
    bestSellers = all.items.filter((p) => p.stock > 0).slice(0, 8);
  } catch {
    // API not yet seeded — render empty states gracefully
  }

  return (
    <>
      <Hero />
      <Marquee />

      <section className="px-5 lg:px-8 max-w-[1280px] mx-auto pt-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <span className="eyebrow">This week</span>
            <h2 className="display-2 mt-2">Featured.</h2>
          </div>
          <Link
            href="/shop"
            className="text-sm font-medium underline underline-offset-4 hidden md:inline">
            All products →
          </Link>
        </div>
        {featured.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-12">
            {featured.map((p, i) => (
              <ProductCard product={p} key={p._id} index={i} />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </section>

      <CategoryTiles />

      <section className="px-5 lg:px-8 max-w-[1280px] mx-auto py-20 hairline-t">
        <div className="flex items-end justify-between mb-10">
          <div>
            <span className="eyebrow">Most loved</span>
            <h2 className="display-2 mt-2">Best sellers.</h2>
          </div>
        </div>
        {bestSellers.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-12">
            {bestSellers.map((p, i) => (
              <ProductCard product={p} key={p._id} index={i} />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </section>

      <section className="px-5 lg:px-8 max-w-[1280px] mx-auto py-24">
        <div className="card-soft rounded-[var(--radius-xl)] p-10 lg:p-16 text-center">
          <span className="eyebrow">The story</span>
          <h2 className="display-2 mt-3 mx-auto max-w-3xl">
            We started building gear for gamers who actually compete.
          </h2>
          <p className="mt-6 mx-auto max-w-2xl text-[var(--fg-soft)] text-lg leading-relaxed">
            From RC drift sessions at Hatirjheel to LAN nights in Dhanmondi,
            GamersKit is built around the players. Every piece in our catalog is
            sourced, tested, and supported by people who use it.
          </p>
          <Link href="/shop" className="btn btn-primary mt-8">
            Start browsing
          </Link>
        </div>
      </section>
    </>
  );
}

function EmptyState() {
  return (
    <div className="card-soft p-10 text-center text-[var(--fg-soft)]">
      <p className="text-sm">
        No products yet. Run{" "}
        <code className="text-[var(--fg)]">npm run seed</code> to import 34 live
        products from gamerskitbd.com.
      </p>
    </div>
  );
}
