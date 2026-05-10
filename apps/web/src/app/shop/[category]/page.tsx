import { notFound } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { CategoryNav } from "@/components/CategoryNav";
import { ProductListing } from "@/components/ProductListing";

export const dynamic = "force-dynamic";

interface Category {
  _id: string;
  slug: string;
  name: string;
  description: string;
  image: string;
  subcategories?: Category[];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  try {
    const res = await api.getCategory(category);
    return { title: res.item?.name ?? "Shop" };
  } catch {
    return { title: "Shop" };
  }
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;

  let categoryData: Category | null = null;

  try {
    const catRes = await api.getCategory(category);
    categoryData = catRes.item;
  } catch {
    notFound();
  }

  if (!categoryData) {
    notFound();
  }

  return (
    <>
      <CategoryNav activeSlug={category} />
      <section className="px-5 lg:px-8 max-w-[1280px] mx-auto py-12">
        <header className="mb-10">
          <span className="eyebrow">Category</span>
          <h1 className="display-2 mt-2">{categoryData.name}.</h1>
          {categoryData.description && (
            <p className="mt-3 text-[var(--fg-soft)]">{categoryData.description}</p>
          )}
        </header>

        {/* Subcategories */}
        {categoryData.subcategories && categoryData.subcategories.length > 0 && (
          <div className="mb-12">
            <h2 className="text-lg font-semibold mb-4">Subcategories</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {categoryData.subcategories.map((subcat) => (
                <Link
                  key={subcat._id}
                  href={`/shop/${subcat.slug}`}
                  className="p-4 rounded-lg border border-[var(--line-strong)] hover:border-black transition-colors text-center"
                >
                  <div className="font-medium text-sm">{subcat.name}</div>
                  {subcat.description && (
                    <div className="text-xs text-[var(--fg-soft)] mt-1">
                      {subcat.description}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Product listing moved to client component */}
      <ProductListing category={category} />
    </>
  );
}
