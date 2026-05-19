import { api } from "@/lib/api";
import { Hero } from "@/components/Hero";
import { CategoryTiles } from "@/components/CategoryTiles";
import { Marquee } from "@/components/Marquee";
import { SectionHeader } from "@/components/SectionHeader";
import { ProductGrid } from "@/components/ProductGrid";
import { StorySection } from "@/components/StorySection";
import { CustomerReviews } from "@/components/CustomerReviews";
import { Section, Card } from "@/components/ui";
import { createMetadata } from "@/lib/seo";

type Product = Awaited<ReturnType<typeof api.listProducts>>["items"][number];
type Category = Awaited<ReturnType<typeof api.listCategories>>["items"][number];
type HeroImage = Awaited<ReturnType<typeof api.getHeroImages>>["items"][number];

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = createMetadata({
  title: "GamersKit | Gaming Store in Bangladesh",
  description:
    "Shop RC drift cars, F1 jerseys, e-sports apparel, gaming gear, and accessories in Bangladesh with free delivery and cash on delivery.",
  path: "/",
  keywords: ["RC drift car", "F1 jersey", "gaming gear Bangladesh"],
});

export default async function Home() {
  let featured: Product[] = [];
  let bestSellers: Product[] = [];
  let newArrivals: Product[] = [];
  let categories: Category[] = [];
  let heroImages: HeroImage[] = [];

  try {
    const [f, all, newest, categoryList, hero] = await Promise.all([
      api.listProductsFresh({ isFeatured: true, limit: 12 }),
      api.listProductsFresh({ isBestSelling: true, limit: 8 }),
      api.listProductsFresh({ isNewArrival: true, limit: 8 }),
      api.listCategoriesFresh(),
      api.getHeroImages(),
    ]);
    featured = f.items;
    bestSellers = all.items;
    newArrivals = newest.items;
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

      {newArrivals.length > 0 && (
        <Section spacing="md" className="border-t border-line">
          <SectionHeader eyebrow="Fresh drop" title="New arrivals." />
          <ProductGrid products={newArrivals} />
        </Section>
      )}

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
