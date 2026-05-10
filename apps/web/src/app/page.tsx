import { api } from "@/lib/api";
import { Hero } from "@/components/Hero";
import { CategoryTiles } from "@/components/CategoryTiles";
import { Marquee } from "@/components/Marquee";
import { SectionHeader } from "@/components/SectionHeader";
import { ProductGrid } from "@/components/ProductGrid";
import { StorySection } from "@/components/StorySection";

type Product = Awaited<ReturnType<typeof api.listProducts>>["items"][number];

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
  } catch (err) {
    console.error("Failed to fetch products:", err);
  }

  return (
    <main>
      <Hero />
      <Marquee />

      {/* Featured Section */}
      <section className="px-5 lg:px-8 max-w-[1280px] mx-auto py-10 md:py-24">
        <SectionHeader 
          eyebrow="This week" 
          title="Featured." 
          linkHref="/shop" 
          linkLabel="All products" 
        />
        {featured.length > 0 ? <ProductGrid products={featured} /> : <EmptyState />}
      </section>

      <CategoryTiles />

      {/* Best Sellers Section */}
      <section className="px-5 lg:px-8 max-w-[1280px] mx-auto py-1 md:py-24 border-t border-white/5">
        <SectionHeader 
          eyebrow="Most loved" 
          title="Best sellers." 
        />
        {bestSellers.length > 0 ? <ProductGrid products={bestSellers} /> : <EmptyState />}
      </section>

      <StorySection />
    </main>
  );
}

function EmptyState() {
  return (
    <div className="card-soft p-12 text-center rounded-2xl border border-dashed border-white/10">
      <p className="text-[var(--fg-soft)]">
        No products yet. Run <code className="bg-white/10 px-2 py-1 rounded text-pink-400">npm run seed</code> to import live products.
      </p>
    </div>
  );
}