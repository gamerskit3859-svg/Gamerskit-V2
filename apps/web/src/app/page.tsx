import { api } from "@/lib/api";
import { Hero } from "@/components/Hero";
import { CategoryTiles } from "@/components/CategoryTiles";
import { Marquee } from "@/components/Marquee";
import { SectionHeader } from "@/components/SectionHeader";
import { ProductGrid } from "@/components/ProductGrid";
import { StorySection } from "@/components/StorySection";
import { Section, Card } from "@/components/ui";

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

      <Section spacing="md">
        <SectionHeader
          eyebrow="This week"
          title="Featured."
          linkHref="/shop"
          linkLabel="All products"
        />
        {featured.length > 0 ? <ProductGrid products={featured} /> : <EmptyState />}
      </Section>

      <CategoryTiles />

      <Section spacing="md" className="border-t border-line">
        <SectionHeader eyebrow="Most loved" title="Best sellers." />
        {bestSellers.length > 0 ? (
          <ProductGrid products={bestSellers} />
        ) : (
          <EmptyState />
        )}
      </Section>

      <StorySection />
    </main>
  );
}

function EmptyState() {
  return (
    <Card
      tone="soft"
      padding="lg"
      className="text-center border-dashed text-fg-soft"
    >
      <p>
        No products yet. Run{" "}
        <code className="rounded bg-bg-soft px-2 py-1 text-xs font-mono text-foreground">
          npm run seed
        </code>{" "}
        to import live products.
      </p>
    </Card>
  );
}
