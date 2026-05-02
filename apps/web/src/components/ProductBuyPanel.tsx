"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { Product } from "@gamerskit/shared";
import { useCart } from "@/lib/cart";
import { formatBDT } from "@/lib/format";
import { track } from "@/lib/fb-pixel";

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
  }, [product._id, product.title, product.category, product.price]);

  function handleAdd() {
    add(product, qty);
    track({
      event: "AddToCart",
      contentIds: [product._id],
      contentName: product.title,
      contentCategory: product.category,
      value: product.price * qty,
      currency: "BDT",
      items: [
        {
          id: product._id,
          name: product.title,
          category: product.category,
          price: product.price,
          quantity: qty,
        },
      ],
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  }

  function handleBuy() {
    add(product, qty);
    router.push("/checkout");
  }

  const inStock = product.stock > 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="eyebrow capitalize">{product.category.replace(/-/g, " ")}</span>
        <h1 className="display-2 mt-2">{product.title}</h1>
        <div className="mt-4 flex items-baseline gap-3">
          <span className="text-3xl font-semibold">{formatBDT(product.price)}</span>
          {product.compareAtPrice && product.compareAtPrice > product.price && (
            <span className="text-lg text-[var(--fg-muted)] line-through">
              {formatBDT(product.compareAtPrice)}
            </span>
          )}
          <span
            className={`text-xs px-3 py-1 rounded-full border ${
              inStock
                ? "border-[var(--line)] text-[var(--fg)]"
                : "border-[var(--line)] text-[var(--fg-muted)]"
            }`}
          >
            {inStock ? `In stock · ${product.stock}` : "Out of stock"}
          </span>
        </div>
      </div>

      <p className="text-[var(--fg-soft)] leading-relaxed whitespace-pre-line">
        {product.description}
      </p>

      <div className="flex items-center gap-3">
        <div className="flex items-center border border-[var(--line-strong)] rounded-full overflow-hidden">
          <button
            onClick={() => setQty(Math.max(1, qty - 1))}
            className="w-10 h-10 hover:bg-[var(--bg-soft)]"
            aria-label="Decrease"
          >
            −
          </button>
          <span className="w-10 text-center font-medium">{qty}</span>
          <button
            onClick={() => setQty(qty + 1)}
            className="w-10 h-10 hover:bg-[var(--bg-soft)]"
            aria-label="Increase"
          >
            +
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          disabled={!inStock}
          onClick={handleAdd}
          className="btn btn-light disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {added ? "Added" : "Add to bag"}
        </button>
        <button
          disabled={!inStock}
          onClick={handleBuy}
          className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Buy now
        </button>
      </div>

      <motion.div
        initial={false}
        animate={{ opacity: added ? 1 : 0 }}
        className="text-sm text-[var(--fg-soft)]"
      >
        Item added to your bag.
      </motion.div>

      <ul className="hairline-t pt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm text-[var(--fg-soft)]">
        <li>· Free delivery in Bangladesh</li>
        <li>· Cash on delivery</li>
        <li>· 7-day easy returns</li>
        <li>· WhatsApp support</li>
      </ul>
    </div>
  );
}
