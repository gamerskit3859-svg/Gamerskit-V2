"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Search, Menu, X } from "lucide-react";
import { CATEGORIES } from "@gamerskit/shared";
import { useCart } from "@/lib/cart";

export function Header() {
  const count = useCart((s) => s.lines.reduce((n, l) => n + l.quantity, 0));
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-colors ${
        scrolled ? "glass" : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-[1280px] px-5 lg:px-8 h-12 flex items-center justify-between text-[13px]">
        <div className="flex items-center gap-8">
          <Link href="/" className="font-semibold tracking-tight text-[15px]">
            GamersKit
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-[var(--fg-soft)]">
            <Link href="/shop" className="hover:text-[var(--fg)] transition-colors">
              Shop
            </Link>
            {CATEGORIES.slice(0, 5).map((c) => (
              <Link
                key={c.slug}
                href={`/shop/${c.slug}`}
                className="hover:text-[var(--fg)] transition-colors"
              >
                {c.label}
              </Link>
            ))}
            <Link
              href="/track"
              className="hover:text-[var(--fg)] transition-colors"
            >
              Track order
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/search"
            className="p-2 rounded-full hover:bg-[var(--bg-soft)] transition-colors"
            aria-label="Search"
          >
            <Search size={16} />
          </Link>
          <Link
            href="/cart"
            className="relative p-2 rounded-full hover:bg-[var(--bg-soft)] transition-colors"
            aria-label="Cart"
          >
            <ShoppingBag size={16} />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-black text-white text-[10px] rounded-full min-w-[16px] h-[16px] px-1 flex items-center justify-center">
                {count}
              </span>
            )}
          </Link>
          <button
            className="md:hidden p-2 rounded-full hover:bg-[var(--bg-soft)]"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={16} />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 z-50 glass-strong"
          >
            <div className="flex items-center justify-between px-5 h-12">
              <span className="font-semibold">GamersKit</span>
              <button
                onClick={() => setOpen(false)}
                className="p-2"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="px-5 mt-4 flex flex-col gap-3 text-2xl font-medium">
              <Link href="/shop" onClick={() => setOpen(false)}>
                Shop
              </Link>
              {CATEGORIES.map((c) => (
                <Link
                  key={c.slug}
                  href={`/shop/${c.slug}`}
                  onClick={() => setOpen(false)}
                >
                  {c.label}
                </Link>
              ))}
              <Link href="/track" onClick={() => setOpen(false)}>
                Track order
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
