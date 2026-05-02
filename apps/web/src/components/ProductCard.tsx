"use client";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import type { Product } from "@gamerskit/shared";
import { formatBDT } from "@/lib/format";

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const img = product.images[0];
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay: Math.min(index * 0.04, 0.3), ease: [0.16, 1, 0.3, 1] }}
      className="group"
    >
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative aspect-square w-full overflow-hidden rounded-[var(--radius-lg)] bg-[var(--bg-soft)]">
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
          {product.stock <= 0 && (
            <span className="absolute top-3 left-3 glass text-[10px] uppercase tracking-widest px-2 py-1 rounded-full">
              Sold out
            </span>
          )}
          {product.featured && product.stock > 0 && (
            <span className="absolute top-3 left-3 glass-dark text-white text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border-white/20">
              Featured
            </span>
          )}
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-3">
          <h3 className="text-[14px] font-medium leading-tight text-[var(--fg)] line-clamp-2">
            {product.title}
          </h3>
          <span className="text-[14px] font-semibold whitespace-nowrap">
            {formatBDT(product.price)}
          </span>
        </div>
        <span className="text-[12px] text-[var(--fg-muted)] capitalize">
          {product.category.replace(/-/g, " ")}
        </span>
      </Link>
    </motion.div>
  );
}
