import type { Metadata } from "next";
import { api } from "@/lib/api";
import { absoluteUrl, createMetadata, truncateDescription } from "@/lib/seo";
import { ProductPageClient } from "./ProductPageClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const { item } = await api.getProduct(slug);
    const description = truncateDescription(item.description);

    return createMetadata({
      title: `${item.title} | Buy Online in Bangladesh`,
      description,
      path: `/product/${item.slug}`,
      keywords: [item.title, item.category, "buy online Bangladesh"],
      image: item.images[0] ?? "/brand/logo.png",
    });
  } catch {
    return createMetadata({
      title: "Product not found",
      description: "This GK Shop product may be unavailable or moved.",
      path: `/product/${slug}`,
      noIndex: true,
    });
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  let productJsonLd: Record<string, unknown> | null = null;

  try {
    const { item } = await api.getProduct(slug);
    productJsonLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: item.title,
      image: item.images.map((image) => absoluteUrl(image)),
      description: truncateDescription(item.description),
      sku: item._id,
      brand: {
        "@type": "Brand",
        name: "GK Shop",
      },
      category: item.category,
      offers: {
        "@type": "Offer",
        url: absoluteUrl(`/product/${item.slug}`),
        priceCurrency: "BDT",
        price: item.price,
        availability: "https://schema.org/InStock",
        itemCondition: "https://schema.org/NewCondition",
      },
    };
  } catch {
    productJsonLd = null;
  }

  return (
    <>
      {productJsonLd && (
        <script
          id={`product-jsonld-${slug}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
        />
      )}
      <ProductPageClient />
    </>
  );
}
