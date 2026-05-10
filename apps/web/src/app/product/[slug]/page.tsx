import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductBuyPanel } from "@/components/ProductBuyPanel";
import { ProductCard } from "@/components/ProductCard";
import { Section } from "@/components/ui";

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
    <article className="mx-auto w-full max-w-[1280px] px-5 py-10 md:py-16 lg:px-8">
      <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
        <ProductGallery images={item!.images} alt={item!.title} />
        <ProductBuyPanel product={item!} />
      </div>

      {related.length > 0 && (
        <Section width="full" flush spacing="md" className="mt-10 border-t border-line">
          <h2 className="text-[clamp(36px,5vw,64px)] leading-[1.06] tracking-[-0.035em] font-semibold">
            You may also like.
          </h2>
          <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-12 lg:grid-cols-4">
            {related.map((p, i) => (
              <ProductCard product={p} key={p._id} index={i} />
            ))}
          </div>
        </Section>
      )}
    </article>
  );
}
