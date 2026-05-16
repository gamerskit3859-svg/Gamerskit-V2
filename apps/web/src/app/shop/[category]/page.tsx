import { notFound } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { CategoryNav } from "@/components/CategoryNav";
import { ProductListing } from "@/components/ProductListing";
import { Section } from "@/components/ui";

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
  let categories: Category[] = [];

  try {
    const [catRes, categoryList] = await Promise.all([
      api.getCategory(category),
      api.listCategories().catch(() => ({ items: [] as Category[] })),
    ]);
    categoryData = catRes.item;
    categories = categoryList.items;
  } catch {
    notFound();
  }

  if (!categoryData) {
    notFound();
  }

  return (
    <>
      <CategoryNav activeSlug={category} initialCategories={categories} />
      <Section width="wide" spacing="md">
        <header className="mb-10">
          <span className="block text-xs font-medium uppercase tracking-[0.18em] text-fg-soft">
            Category
          </span>
          <h1 className="mt-2 text-[clamp(36px,5vw,64px)] leading-[1.06] tracking-[-0.035em] font-semibold">
            {categoryData.name}.
          </h1>
          {categoryData.description && (
            <p className="mt-3 text-fg-soft">{categoryData.description}</p>
          )}
        </header>

        {categoryData.subcategories && categoryData.subcategories.length > 0 && (
          <div className="mb-12">
            <h2 className="mb-4 text-lg font-semibold">Subcategories</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {categoryData.subcategories.map((subcat) => (
                <Link
                  key={subcat._id}
                  href={`/shop/${subcat.slug}`}
                  className="rounded-lg border border-line-strong p-4 text-center transition-colors hover:border-black"
                >
                  <div className="text-sm font-medium">{subcat.name}</div>
                  {subcat.description && (
                    <div className="mt-1 text-xs text-fg-soft">
                      {subcat.description}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </Section>

      <ProductListing category={category} />
    </>
  );
}
