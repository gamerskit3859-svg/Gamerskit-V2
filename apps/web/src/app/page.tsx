import { api } from "@/lib/api";
import { Hero } from "@/components/Hero";
import { CategoryTiles } from "@/components/CategoryTiles";
import { Marquee } from "@/components/Marquee";
import { SectionHeader } from "@/components/SectionHeader";
import { ProductGrid } from "@/components/ProductGrid";
import { StorySection } from "@/components/StorySection";
import { CustomerReviews } from "@/components/CustomerReviews";
import { Section, Card } from "@/components/ui";

type Product = Awaited<ReturnType<typeof api.listProducts>>["items"][number];
type Category = Awaited<ReturnType<typeof api.listCategories>>["items"][number];
type HeroImage = Awaited<ReturnType<typeof api.getHeroImages>>["items"][number];

export const dynamic = "force-dynamic";

export default async function Home() {
  let featured: Product[] = [];
  let bestSellers: Product[] = [];
  let categories: Category[] = [];
  let heroImages: HeroImage[] = [];

  try {
    const [f, all, categoryList, hero] = await Promise.all([
      api.listProducts({ featured: true, limit: 4 }),
      api.listProducts({ limit: 20 }),
      api.listCategories(),
      api.getHeroImages(),
    ]);
    featured = f.items;
    bestSellers = all.items.filter((p) => p.stock > 0).slice(0, 8);
    categories = categoryList.items;
    heroImages = hero.items;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Failed to fetch home data:", err);
    }
  }

  return (
    <main>
      <Hero initialImages={heroImages} />
      <Marquee />

      <Section spacing="md">
        <SectionHeader
          eyebrow="This week"
          title="Featured."
          linkHref="/shop"
          linkLabel="All products"
        />
        {featured.length > 0 ? (
          <ProductGrid products={featured} />
        ) : (
          <EmptyState />
        )}
      </Section>

      <CategoryTiles initialCategories={categories} />

      <Section spacing="md" className="border-t border-line">
        <SectionHeader eyebrow="Most loved" title="Best sellers." />
        {bestSellers.length > 0 ? (
          <ProductGrid products={bestSellers} />
        ) : (
          <EmptyState />
        )}
      </Section>
      <CustomerReviews />
      <StorySection />
    </main>
  );
}

function EmptyState() {
  return (
    <Card
      tone="soft"
      padding="lg"
      className="text-center border-dashed text-fg-soft">
      <p>No products yet.</p>
    </Card>
  );
}
