"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { Product } from "@gamerskit/shared";
import { useCart } from "@/lib/cart";
import { formatBDT } from "@/lib/format";
import { track } from "@/lib/fb-pixel";
import { Minus, Plus, ShoppingBag } from "lucide-react";

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
    <div className="">
      {/* Product Info Section */}
      <div>
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mt-3 leading-[1.1] tracking-tight text-[var(--fg)]">
          {product.title}
        </h1>
        <div className="mt-4 flex items-baseline gap-3">
          <span className="text-3xl font-semibold">
            {formatBDT(product.price)}
          </span>
          {product.compareAtPrice && product.compareAtPrice > product.price && (
            <span className="text-lg text-[var(--fg-muted)] line-through">
              {formatBDT(product.compareAtPrice)}
            </span>
          )}
        </div>
      </div>

      <p className="text-[var(--fg-soft)] leading-relaxed whitespace-pre-line">
        {product.description}
      </p>

      {/* Features Grid (Hidden on very small screens to save space if needed) */}
      <ul className="hairline-t pt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm text-[var(--fg-soft)]">
        <li>· Free delivery in BD</li>
        <li>· Cash on delivery</li>
        <li>· 7-day easy returns</li>
        <li>· WhatsApp support</li>
      </ul>

      {/* --- MOBILE FIXED BAR / DESKTOP INLINE PANEL --- */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-t border-[var(--line)] p-4 pb-safe md:relative md:p-0 md:bg-transparent md:backdrop-blur-none md:border-none md:z-auto">
        <div className="max-w-[1280px] mx-auto flex md:flex-col gap-3">
          {/* Quantity and Feedback Row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center border border-[var(--line-strong)] rounded-full bg-white overflow-hidden h-11">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="w-8 md:w-11 h-full flex items-center justify-center hover:bg-[var(--bg-soft)] active:bg-[var(--line)] transition-colors"
                aria-label="Decrease">
                <Minus size={14} />
              </button>
              <span className="w-4 md:w-8 text-center font-bold">{qty}</span>
              <button
                onClick={() => setQty(qty + 1)}
                className="w-8 md:w-11 h-full flex items-center justify-center hover:bg-[var(--bg-soft)] active:bg-[var(--line)] transition-colors"
                aria-label="Increase">
                <Plus size={14} />
              </button>
            </div>

            <AnimatePresence>
              {added && (
                <motion.span
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                  Added to bag
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Buttons Row */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={handleAdd} className="btn btn-light">
              {added ? "Added" : "Add to bag"}
            </button>

            <button onClick={handleBuy} className="btn btn-primary">
              Buy now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
