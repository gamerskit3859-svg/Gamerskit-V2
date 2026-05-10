import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductBuyPanel } from "@/components/ProductBuyPanel";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  try {
    const { item } = await api.getProduct(slug);
    return {
      title: item.title,
      description: item.description.slice(0, 160),
    };
  } catch {
    return { title: "Product" };
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let item: Awaited<ReturnType<typeof api.getProduct>>["item"];
  try {
    item = (await api.getProduct(slug)).item;
  } catch {
    notFound();
  }

  // pull "you may also like" from same category
  let related: Awaited<ReturnType<typeof api.listProducts>>["items"] = [];
  try {
    const all = await api.listProducts({ category: item!.category });
    related = all.items.filter((p) => p._id !== item!._id).slice(0, 4);
  } catch {}

  return (
    <article className="px-5 lg:px-8 max-w-[1280px] mx-auto py-10 md:py-16">
      <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
        <ProductGallery images={item!.images} alt={item!.title} />
        <ProductBuyPanel product={item!} />
      </div>

      {related.length > 0 && (
        <section className="py-10 mt-10 md:py-16 hairline-t">
          <h2 className="display-2">You may also like.</h2>
          <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-12">
            {related.map((p, i) => (
              <ProductCard product={p} key={p._id} index={i} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
