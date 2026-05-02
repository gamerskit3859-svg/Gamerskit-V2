"use client";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/lib/cart";
import { formatBDT } from "@/lib/format";
import { motion, AnimatePresence } from "framer-motion";

export default function CartPage() {
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const subtotal = useCart((s) => s.subtotal());

  return (
    <section className="px-5 lg:px-8 max-w-[1100px] mx-auto py-12">
      <span className="eyebrow">Bag</span>
      <h1 className="display-2 mt-2 mb-10">Your bag.</h1>

      {lines.length === 0 ? (
        <div className="card-soft p-16 text-center">
          <p className="text-[var(--fg-soft)] mb-6">Your bag is empty.</p>
          <Link href="/shop" className="btn btn-primary">
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_360px] gap-10">
          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {lines.map((l) => (
                <motion.div
                  layout
                  key={l.productId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="card-soft p-4 flex gap-4"
                >
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-white flex-shrink-0">
                    {l.image && (
                      <Image
                        src={l.image}
                        alt={l.title}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/product/${l.slug}`}
                      className="font-medium leading-tight line-clamp-2 hover:underline"
                    >
                      {l.title}
                    </Link>
                    <div className="text-sm text-[var(--fg-muted)] capitalize">
                      {l.category.replace(/-/g, " ")}
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex items-center border border-[var(--line-strong)] rounded-full">
                        <button
                          onClick={() => setQty(l.productId, l.quantity - 1)}
                          className="w-8 h-8"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm">{l.quantity}</span>
                        <button
                          onClick={() => setQty(l.productId, l.quantity + 1)}
                          className="w-8 h-8"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => remove(l.productId)}
                        className="text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] underline underline-offset-4"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="text-right font-semibold whitespace-nowrap">
                    {formatBDT(l.unitPrice * l.quantity)}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <aside className="glass-strong rounded-[var(--radius-lg)] p-6 h-fit sticky top-24">
            <h2 className="font-semibold text-lg">Summary</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-[var(--fg-soft)]">Subtotal</dt>
                <dd>{formatBDT(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--fg-soft)]">Shipping</dt>
                <dd>Free</dd>
              </div>
              <div className="flex justify-between font-semibold text-base hairline-t pt-3 mt-2">
                <dt>Total</dt>
                <dd>{formatBDT(subtotal)}</dd>
              </div>
            </dl>
            <Link href="/checkout" className="btn btn-primary w-full mt-6">
              Continue to checkout
            </Link>
            <p className="text-xs text-[var(--fg-muted)] mt-3 text-center">
              Cash on delivery available across Bangladesh.
            </p>
          </aside>
        </div>
      )}
    </section>
  );
}
