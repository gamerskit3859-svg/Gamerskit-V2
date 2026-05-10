"use client";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/lib/cart";
import { formatBDT } from "@/lib/format";
import { LinkButton, Card, Section } from "@/components/ui";

export default function CartPage() {
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const subtotal = useCart((s) => s.subtotal());

  return (
    <Section width="narrow" spacing="md" className="!max-w-[1100px]">
      <span className="block text-xs font-medium uppercase tracking-[0.18em] text-fg-soft">
        Bag
      </span>
      <h1 className="mt-2 mb-10 text-[clamp(36px,5vw,64px)] leading-[1.06] tracking-[-0.035em] font-semibold">
        Your bag.
      </h1>

      {lines.length === 0 ? (
        <Card tone="soft" padding="lg" className="text-center">
          <p className="mb-6 text-fg-soft">Your bag is empty.</p>
          <LinkButton href="/shop">Start shopping</LinkButton>
        </Card>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {lines.map((l) => (
                <motion.div
                  layout
                  key={l.productId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <Card tone="soft" padding="sm" className="flex gap-4">
                    <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-white">
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
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/product/${l.slug}`}
                        className="line-clamp-2 font-medium leading-tight hover:underline"
                      >
                        {l.title}
                      </Link>
                      <div className="text-sm capitalize text-fg-muted">
                        {l.category.replace(/-/g, " ")}
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex items-center rounded-full border border-line-strong">
                          <button
                            type="button"
                            onClick={() => setQty(l.productId, l.quantity - 1)}
                            className="h-8 w-8 rounded-l-full transition-colors hover:bg-bg-soft"
                            aria-label="Decrease quantity"
                          >
                            −
                          </button>
                          <span className="w-8 text-center text-sm">{l.quantity}</span>
                          <button
                            type="button"
                            onClick={() => setQty(l.productId, l.quantity + 1)}
                            className="h-8 w-8 rounded-r-full transition-colors hover:bg-bg-soft"
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(l.productId)}
                          className="text-sm text-fg-muted underline underline-offset-4 transition-colors hover:text-foreground"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="whitespace-nowrap text-right font-semibold">
                      {formatBDT(l.unitPrice * l.quantity)}
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <aside className="glass-strong sticky top-24 h-fit rounded-[var(--radius-lg)] p-6">
            <h2 className="text-lg font-semibold">Summary</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-fg-soft">Subtotal</dt>
                <dd>{formatBDT(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-fg-soft">Shipping</dt>
                <dd>Free</dd>
              </div>
              <div className="mt-2 flex justify-between border-t border-line pt-3 text-base font-semibold">
                <dt>Total</dt>
                <dd>{formatBDT(subtotal)}</dd>
              </div>
            </dl>
            <LinkButton href="/checkout" className="mt-6 w-full">
              Continue to checkout
            </LinkButton>
            <p className="mt-3 text-center text-xs text-fg-muted">
              Cash on delivery available across Bangladesh.
            </p>
          </aside>
        </div>
      )}
    </Section>
  );
}
