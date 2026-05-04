"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Search, Menu, X, User } from "lucide-react";
import { CATEGORIES } from "@gamerskit/shared";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";

export function Header() {
  const pathname = usePathname();
  const count = useCart((s) => s.lines.reduce((n, l) => n + l.quantity, 0));
  const user = useAuth((s) => s.user);
  const clear = useAuth((s) => s.clear);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  // Admin has its own chrome (AdminShell) — hide the storefront header on /admin/*
  if (pathname?.startsWith("/admin")) return null;

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 glass ${
        scrolled ? "shadow-[0_1px_0_rgba(0,0,0,0.04)]" : ""
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
            <Link href="/track" className="hover:text-[var(--fg)] transition-colors">
              Track order
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/shop"
            className="p-2 rounded-full hover:bg-[var(--bg-soft)] transition-colors"
            aria-label="Search"
          >
            <Search size={16} />
          </Link>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="hidden md:flex p-2 rounded-full hover:bg-[var(--bg-soft)] transition-colors items-center gap-1"
              aria-label="Account"
            >
              <User size={16} />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-56 glass-strong rounded-xl p-2 shadow-xl"
                >
                  {user ? (
                    <div>
                      <div className="px-3 py-2 text-xs text-[var(--fg-soft)] truncate">
                        {user.email}
                      </div>
                      <Link
                        href="/account"
                        onClick={() => setMenuOpen(false)}
                        className="block px-3 py-2 rounded-lg text-sm hover:bg-white/60"
                      >
                        My account
                      </Link>
                      <Link
                        href="/account"
                        onClick={() => setMenuOpen(false)}
                        className="block px-3 py-2 rounded-lg text-sm hover:bg-white/60"
                      >
                        Order history
                      </Link>
                      <button
                        onClick={() => {
                          clear();
                          setMenuOpen(false);
                        }}
                        className="block w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/60"
                      >
                        Sign out
                      </button>
                    </div>
                  ) : (
                    <div>
                      <Link
                        href="/account/login"
                        onClick={() => setMenuOpen(false)}
                        className="block px-3 py-2 rounded-lg text-sm font-medium hover:bg-white/60"
                      >
                        Sign in
                      </Link>
                      <Link
                        href="/account/register"
                        onClick={() => setMenuOpen(false)}
                        className="block px-3 py-2 rounded-lg text-sm hover:bg-white/60"
                      >
                        Create account
                      </Link>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

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
              <div className="hairline-t pt-3 mt-2" />
              {user ? (
                <>
                  <Link href="/account" onClick={() => setOpen(false)}>
                    My account
                  </Link>
                  <button
                    onClick={() => {
                      clear();
                      setOpen(false);
                    }}
                    className="text-left"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/account/login" onClick={() => setOpen(false)}>
                    Sign in
                  </Link>
                  <Link href="/account/register" onClick={() => setOpen(false)}>
                    Create account
                  </Link>
                </>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
