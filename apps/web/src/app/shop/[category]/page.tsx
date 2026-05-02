import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";
import { CategoryNav } from "@/components/CategoryNav";
import { CATEGORIES } from "@gamerskit/shared";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const def = CATEGORIES.find((c) => c.slug === category);
  return { title: def?.label ?? "Shop" };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const def = CATEGORIES.find((c) => c.slug === category);
  if (!def) notFound();

  let items: Awaited<ReturnType<typeof api.listProducts>>["items"] = [];
  try {
    const r = await api.listProducts({ category });
    items = r.items;
  } catch {
    items = [];
  }

  return (
    <>
      <CategoryNav activeSlug={category} />
      <section className="px-5 lg:px-8 max-w-[1280px] mx-auto py-12">
        <header className="mb-10">
          <span className="eyebrow">Category</span>
          <h1 className="display-2 mt-2">{def.label}.</h1>
          <p className="mt-3 text-[var(--fg-soft)]">{items.length} products.</p>
        </header>
        {items.length === 0 ? (
          <div className="card-soft p-10 text-center text-[var(--fg-soft)]">
            Nothing here yet.
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
