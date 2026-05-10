"use client";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import type { Product } from "@gamerskit/shared";
import { formatBDT } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { track } from "@/lib/fb-pixel";

export function ProductCard({
  product,
  index = 0,
}: {
  product: Product;
  index?: number;
}) {
  const img = product.images[0];
  const router = useRouter();
  const add = useCart((s) => s.add);
  const [added, setAdded] = useState(false);

  // The storefront intentionally lets customers place orders even when a
  // product is out of stock — Buy now / Add to cart always work. Inventory
  // enforcement happens in /admin/inventory.
  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    add(product, 1);
    track({
      event: "AddToCart",
      contentIds: [product._id],
      contentName: product.title,
      contentCategory: product.category,
      value: product.price,
      currency: "BDT",
      items: [
        {
          id: product._id,
          name: product.title,
          category: product.category,
          price: product.price,
          quantity: 1,
        },
      ],
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  }

  function handleBuyNow(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    add(product, 1);
    router.push("/checkout");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{
        duration: 0.6,
        delay: Math.min(index * 0.04, 0.3),
        ease: [0.16, 1, 0.3, 1],
      }}
      className="group flex flex-col rounded-[var(--radius-lg)] border border-[var(--line)] bg-white overflow-hidden transition-all duration-300 hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-md)]">
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative aspect-square w-full overflow-hidden bg-[var(--bg-soft)]">
          {img ? (
            <Image
              src={img}
              alt={product.title}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[var(--fg-muted)] text-xs">
              No image
            </div>
          )}
          {product.featured && (
            <span className="absolute top-3 left-3 glass-dark text-white text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border-white/20">
              Featured
            </span>
          )}
        </div>
        <div className="px-2 md:px-4 pt-2 md:pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[14px] font-medium leading-tight text-[var(--fg)] line-clamp-2">
              {product.title}
            </h3>
            <span className="text-[14px] font-semibold whitespace-nowrap">
              {formatBDT(product.price)}
            </span>
          </div>
        </div>
      </Link>
      <div className="px-2 md:px-4 pb-4 pt-3 mt-auto flex items-center gap-2">
        <button
          type="button"
          onClick={handleBuyNow}
          className="flex-1 inline-flex items-center justify-center h-9 rounded-full bg-black text-white text-[12px] font-medium tracking-tight hover:bg-[#1d1d1f] transition-colors">
          Buy now
        </button>
        <button
          type="button"
          onClick={handleAddToCart}
          aria-label={added ? "Added to cart" : "Add to cart"}
          title={added ? "Added" : "Add to cart"}
          className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-[var(--line-strong)] bg-white text-[var(--fg)] hover:bg-[var(--bg-soft)] transition-colors">
          <ShoppingBag
            size={15}
            className={added ? "scale-110 transition-transform" : ""}
          />
        </button>
      </div>
    </motion.div>
  );
}
