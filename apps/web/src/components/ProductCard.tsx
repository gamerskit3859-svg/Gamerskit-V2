"use client";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { ShoppingBag, Truck } from "lucide-react";
import type { Product } from "@/types/shared";
import { formatBDT } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { getEffectivePrice } from "@/lib/pricing";
import { trackAddToCart } from "@/lib/fb-pixel";
import { optimizeCloudinaryImage } from "@/lib/images";
import { Button } from "@/components/ui";

interface ProductCardProps {
  product: Product;
  index?: number;
}

/**
 * Storefront product tile. Public buyers can always Buy now / Add to cart;
 * inventory visibility is reserved for admin screens.
 */
export function ProductCard({ product, index = 0 }: ProductCardProps) {
  const img = product.images[0];
  const router = useRouter();
  const add = useCart((s) => s.add);
  const [added, setAdded] = useState(false);
  const hasVariants = product.variants?.some((group) => group.options?.length) ?? false;
  const effectivePrice = getEffectivePrice(product);
  const hasDiscount = effectivePrice < product.price;

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (hasVariants) {
      router.push(`/product/${product.slug}`);
      return;
    }
    add(product, 1);
    trackAddToCart({ ...product, price: effectivePrice }, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  }

  function handleBuyNow(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (hasVariants) {
      router.push(`/product/${product.slug}`);
      return;
    }
    add(product, 1);
    trackAddToCart({ ...product, price: effectivePrice }, 1);
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
      className="group flex flex-col overflow-hidden rounded-lg border border-line bg-white ">
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative aspect-square w-full overflow-hidden bg-bg-soft">
          {img ? (
            <Image
              src={optimizeCloudinaryImage(img, "f_auto,q_auto,c_fill,w_700")}
              alt={product.title}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-fg-muted text-xs">
              No image
            </div>
          )}
          {(product.isFeatured ?? product.featured) && (
            <span className="absolute top-3 left-3 glass-dark text-white text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border-white/20">
              Featured
            </span>
          )}
          {hasDiscount && (
            <span className="absolute top-3 right-3 bg-red-500 text-white text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full">
              SALE
            </span>
          )}
        </div>
        <div className="px-2 pt-2 md:px-4 md:pt-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 text-sm font-medium leading-tight text-foreground">
              {product.title}
            </h3>
            <div className="flex flex-col items-end whitespace-nowrap">
              <span className="text-sm font-semibold">
                {formatBDT(effectivePrice)}
              </span>
              {hasDiscount && (
                <span className="text-xs text-fg-muted line-through">
                  {formatBDT(product.price)}
                </span>
              )}
            </div>
          </div>
          {product.freeDelivery && (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              <Truck size={10} /> Free delivery
            </span>
          )}
        </div>
      </Link>

      <div className="mt-auto flex items-center gap-2 px-2 pb-4 pt-3 md:px-4">
        <Button
          variant="primary"
          size="sm"
          onClick={handleBuyNow}
          className="flex-1 text-xs">
          Buy now
        </Button>
        <Button
          variant="secondary"
          size="sm"
          iconOnly
          onClick={handleAddToCart}
          aria-label={added ? "Added to cart" : "Add to cart"}
          title={added ? "Added" : "Add to cart"}>
          <ShoppingBag
            size={15}
            className={added ? "scale-110 transition-transform" : ""}
          />
        </Button>
      </div>
    </motion.div>
  );
}
