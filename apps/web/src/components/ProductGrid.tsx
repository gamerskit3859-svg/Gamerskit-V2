import { ProductCard } from "./ProductCard";
import type { Product } from "@gamerskit/shared";

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-5 md:gap-x-6 md:gap-y-16">
      {products.map((p, i) => (
        <ProductCard product={p} key={p._id} index={i} />
      ))}
    </div>
  );
}