"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Search, Menu, X, User } from "lucide-react";
import { CATEGORIES } from "@gamerskit/shared";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";

const NAV_LINKS = [
  { label: "Shop", href: "/shop" },
  { label: "Track order", href: "/track" },
];

export function Header() {
  const pathname = usePathname();
  const count = useCart((s) => s.lines.reduce((n, l) => n + l.quantity, 0));
  const user = useAuth((s) => s.user);
  const clear = useAuth((s) => s.clear);

  const [scrolled, setScrolled] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  function updatePill(index: number) {
    const el = itemRefs.current[index];
    const nav = navRef.current;
    if (!el || !nav) return;
    const navRect = nav.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    setPillStyle({
      left: elRect.left - navRect.left,
      width: elRect.width,
    });
  }

  // Admin has its own chrome (AdminShell) — hide the storefront header on /admin/*
  if (pathname?.startsWith("/admin")) return null;

  return (
    <>
      <nav className={`lg-navbar${scrolled ? " scrolled" : ""}`} aria-label="Primary">
        <div className="lg-inner">
          <Link href="/" className="lg-logo" aria-label="GamersKit home">
            <Image
              src="/brand/logo.png"
              alt=""
              width={26}
              height={26}
              priority
              className="h-[26px] w-[26px] object-contain"
            />
            <span className="hidden sm:inline text-[14px] font-semibold tracking-tight">
              GamersKit
            </span>
          </Link>

          <ul
            className="lg-links hidden md:flex"
            ref={navRef}
            onMouseLeave={() => setActiveIndex(null)}
          >
            <div
              className={`lg-pill${activeIndex !== null ? " visible" : ""}`}
              style={{ left: pillStyle.left, width: pillStyle.width }}
              aria-hidden
            />
            {NAV_LINKS.map((link, i) => (
              <li
                key={link.label}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                onMouseEnter={() => {
                  setActiveIndex(i);
                  updatePill(i);
                }}
              >
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>

          <div className="lg-actions">
            <Link href="/shop" className="lg-icon-btn" aria-label="Search">
              <Search size={16} strokeWidth={1.8} />
            </Link>

            <div className="relative hidden sm:block" ref={accountRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="lg-icon-btn"
                aria-label="Account"
                aria-expanded={menuOpen}
              >
                <User size={16} strokeWidth={1.8} />
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="absolute right-0 mt-3 w-60 rounded-2xl p-2 border border-white/40 shadow-xl"
                    style={{
                      background: "rgba(255,255,255,0.78)",
                      backdropFilter: "blur(40px) saturate(200%)",
                      WebkitBackdropFilter: "blur(40px) saturate(200%)",
                    }}
                  >
                    {user ? (
                      <>
                        <div className="px-3 py-2 text-[11px] uppercase tracking-widest text-[var(--fg-soft)] truncate">
                          {user.email}
                        </div>
                        <Link
                          href="/account"
                          onClick={() => setMenuOpen(false)}
                          className="block px-3 py-2 rounded-lg text-sm hover:bg-white/70"
                        >
                          My account
                        </Link>
                        <Link
                          href="/account"
                          onClick={() => setMenuOpen(false)}
                          className="block px-3 py-2 rounded-lg text-sm hover:bg-white/70"
                        >
                          Order history
                        </Link>
                        <button
                          onClick={() => {
                            clear();
                            setMenuOpen(false);
                          }}
                          className="block w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/70"
                        >
                          Sign out
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          href="/account/login"
                          onClick={() => setMenuOpen(false)}
                          className="block px-3 py-2 rounded-lg text-sm font-medium hover:bg-white/70"
                        >
                          Sign in
                        </Link>
                        <Link
                          href="/account/register"
                          onClick={() => setMenuOpen(false)}
                          className="block px-3 py-2 rounded-lg text-sm hover:bg-white/70"
                        >
                          Create account
                        </Link>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Link href="/cart" className="lg-icon-btn" aria-label="Cart">
              <ShoppingBag size={16} strokeWidth={1.8} />
              {count > 0 && <span className="lg-cart-badge">{count}</span>}
            </Link>

            <button
              className="lg-icon-btn md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={16} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </nav>

      {/* Spacer so page content doesn't render under the fixed navbar.
       * Constant height to avoid layout shift on scroll; pages whose hero
       * should bleed behind the nav (e.g. Hero) opt out via negative margin. */}
      <div aria-hidden className="h-[76px]" data-site-header-spacer="" />

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="lg-mobile-menu md:hidden"
          >
            <div className="absolute top-4 right-4">
              <button
                onClick={() => setMobileOpen(false)}
                className="lg-icon-btn"
                aria-label="Close"
              >
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>
            <Link href="/shop" onClick={() => setMobileOpen(false)}>
              Store
            </Link>
            {CATEGORIES.map((c) => (
              <Link
                key={c.slug}
                href={`/shop/${c.slug}`}
                onClick={() => setMobileOpen(false)}
              >
                {c.label}
              </Link>
            ))}
            <Link href="/track" onClick={() => setMobileOpen(false)}>
              Track order
            </Link>
            <div className="mt-auto pt-6">
              {user ? (
                <>
                  <Link href="/account" onClick={() => setMobileOpen(false)}>
                    My account
                  </Link>
                  <button
                    onClick={() => {
                      clear();
                      setMobileOpen(false);
                    }}
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/account/login" onClick={() => setMobileOpen(false)}>
                    Sign in
                  </Link>
                  <Link href="/account/register" onClick={() => setMobileOpen(false)}>
                    Create account
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
