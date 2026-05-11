"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import type { Product } from "@/types/shared";
import { useCart } from "@/lib/cart";
import { formatBDT } from "@/lib/format";
import { track } from "@/lib/fb-pixel";
import { Button } from "@/components/ui";

const FEATURES = [
  "Free delivery in BD",
  "Cash on delivery",
  "7-day easy returns",
  "WhatsApp support",
];

export function ProductBuyPanel({ product }: { product: Product }) {
  const router = useRouter();
  const add = useCart((s) => s.add);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    track({
      event: "ViewContent",
      contentIds: [product._id],
      contentName: product.title,
      contentCategory: product.category,
      value: product.price,
      currency: "BDT",
    });
  }, [product]);

  function handleAdd() {
    add(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  function handleBuy() {
    add(product, qty);
    router.push("/checkout");
  }

  return (
    <div>
      <div>
        <h1 className="mt-3 text-3xl font-bold leading-[1.1] tracking-tight md:text-4xl lg:text-5xl">
          {product.title}
        </h1>
        <div className="mt-4 flex items-baseline gap-3">
          <span className="text-3xl font-semibold">
            {formatBDT(product.price)}
          </span>
          {product.compareAtPrice && product.compareAtPrice > product.price && (
            <span className="text-lg text-fg-muted line-through">
              {formatBDT(product.compareAtPrice)}
            </span>
          )}
        </div>
      </div>

      <p className="whitespace-pre-line leading-relaxed text-fg-soft">
        {product.description}
      </p>

      <ul className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-6 text-sm text-fg-soft">
        {FEATURES.map((feature) => (
          <li key={feature}>· {feature}</li>
        ))}
      </ul>

      {/* Mobile fixed bottom bar / desktop inline panel */}
      <div className="pb-safe fixed bottom-0 left-0 right-0 z-50 border-t border-line bg-white/80 p-4 backdrop-blur-xl md:relative md:z-auto md:border-none md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="mx-auto flex max-w-[1280px] gap-3 md:flex-col">
          <div className="flex items-center justify-between gap-4">
            <div className="flex h-11 items-center overflow-hidden rounded-full border border-line-strong bg-white">
              <button
                type="button"
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="flex h-full w-8 items-center justify-center transition-colors hover:bg-bg-soft active:bg-line md:w-11"
                aria-label="Decrease"
              >
                <Minus size={14} />
              </button>
              <span className="w-4 text-center font-bold md:w-8">{qty}</span>
              <button
                type="button"
                onClick={() => setQty(qty + 1)}
                className="flex h-full w-8 items-center justify-center transition-colors hover:bg-bg-soft active:bg-line md:w-11"
                aria-label="Increase"
              >
                <Plus size={14} />
              </button>
            </div>

            <AnimatePresence>
              {added && (
                <motion.span
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-full border border-green-100 bg-green-50 px-3 py-1 text-xs font-medium text-green-600"
                >
                  Added to bag
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={handleAdd}>
              {added ? "Added" : "Add to bag"}
            </Button>
            <Button onClick={handleBuy}>Buy now</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
