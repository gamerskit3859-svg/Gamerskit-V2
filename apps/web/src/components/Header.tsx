"use client";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ShoppingBag, Search, User, Menu, X } from "lucide-react";
import { api, type CategoryItem } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { clearAdminToken } from "@/lib/admin-token";
import { cn } from "@/lib/cn";

const AuthDrawer = dynamic(
  () => import("./AuthDrawer").then((mod) => mod.AuthDrawer),
  { ssr: false },
);

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
  { label: "Track order", href: "/track" },
];

const MD_BREAKPOINT = 768;

type NavCategory = Pick<CategoryItem, "_id" | "name" | "slug" | "active"> & {
  subcategories?: NavCategory[];
};

function collectValidCategories(items: NavCategory[]): NavCategory[] {
  return items.flatMap((item) => {
    const current = item.active !== false && item.slug ? [item] : [];
    const children = item.subcategories
      ? collectValidCategories(item.subcategories)
      : [];
    return [...current, ...children];
  });
}

export function Header() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const authParam = searchParams.get("auth");
  const count = useCart((s) => s.lines.reduce((n, l) => n + l.quantity, 0));
  const user = useAuth((s) => s.user);
  const clear = useAuth((s) => s.clear);
  const accountHref = user?.role === "admin" ? "/admin" : "/account";

  const [scrolled, setScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 });
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [authDrawerOpen, setAuthDrawerOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [categories, setCategories] = useState<NavCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesFailed, setCategoriesFailed] = useState(false);
  const [authDrawerTab, setAuthDrawerTab] = useState<"login" | "register">(
    "login",
  );

  const navRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MD_BREAKPOINT);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileDrawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileDrawerOpen]);

  useEffect(() => {
    if (authParam === "login" && !user) {
      const id = window.setTimeout(() => {
        setAuthDrawerTab("login");
        setAuthDrawerOpen(true);
      }, 0);
      return () => window.clearTimeout(id);
    }
  }, [authParam, user]);

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      setCategoriesLoading(true);
      setCategoriesFailed(false);

      try {
        const result = await api.listCategories();
        if (!cancelled) {
          setCategories(collectValidCategories(result.items));
        }
      } catch {
        if (!cancelled) {
          setCategories([]);
          setCategoriesFailed(true);
        }
      } finally {
        if (!cancelled) setCategoriesLoading(false);
      }
    }

    void loadCategories();

    return () => {
      cancelled = true;
    };
  }, []);

  function updatePill(index: number) {
    const el = itemRefs.current[index];
    const nav = navRef.current;
    if (!el || !nav) return;
    const navRect = nav.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    setPillStyle({ left: elRect.left - navRect.left, width: elRect.width });
  }

  function openAuth(tab: "login" | "register") {
    setMobileDrawerOpen(false);
    setAuthDrawerTab(tab);
    setAuthDrawerOpen(true);
  }

  if (pathname?.startsWith("/admin")) return null;

  return (
    <>
      <nav
        className={cn("lg-navbar", scrolled && "scrolled")}
        aria-label="Primary"
      >
        <div className="lg-inner pt-5">
          <Link href="/" className="lg-logo" aria-label="GamersKit home">
            <Image
              src="/brand/logo.png"
              alt=""
              width={26}
              height={26}
              priority
              className="h-[26px] w-[26px] object-contain"
            />
            <span className="text-sm font-semibold tracking-[-0.02em]">
              GamersKit
            </span>
          </Link>

          {!isMobile && (
            <ul
              className="lg-links"
              ref={navRef}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <div
                className={cn("lg-pill", activeIndex !== null && "visible")}
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
              <li
                onMouseEnter={() => {
                  setActiveIndex(null);
                  setCategoriesOpen(true);
                }}
                onMouseLeave={() => setCategoriesOpen(false)}
              >
                <button
                  type="button"
                  className="lg-nav-trigger"
                  onClick={() => setCategoriesOpen((open) => !open)}
                  aria-expanded={categoriesOpen}
                >
                  Categories
                  <ChevronDown
                    size={14}
                    className={cn("transition-transform", categoriesOpen && "rotate-180")}
                  />
                </button>
                <AnimatePresence>
                  {categoriesOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.16 }}
                      className="absolute left-1/2 top-full z-[700] mt-3 w-64 -translate-x-1/2 rounded-2xl border border-white/70 bg-white/95 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl"
                    >
                      {categoriesLoading ? (
                        <div className="space-y-2 p-2">
                          <div className="h-8 animate-pulse rounded-xl bg-gray-100" />
                          <div className="h-8 animate-pulse rounded-xl bg-gray-100" />
                          <div className="h-8 animate-pulse rounded-xl bg-gray-100" />
                        </div>
                      ) : categories.length === 0 ? (
                        <div className="rounded-xl px-3 py-4 text-center text-sm text-fg-soft">
                          {categoriesFailed
                            ? "Categories could not load."
                            : "No categories yet."}
                        </div>
                      ) : (
                        <div className="max-h-[320px] overflow-y-auto">
                          {categories.map((category) => (
                            <Link
                              key={category._id}
                              href={`/shop?category=${encodeURIComponent(category.slug)}`}
                              onClick={() => setCategoriesOpen(false)}
                              className="block rounded-xl px-3 py-2 text-sm font-medium text-foreground no-underline hover:bg-bg-soft"
                            >
                              {category.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            </ul>
          )}

          <div className="lg-actions">
            <Link href="/shop" className="lg-icon-btn" aria-label="Search">
              <Search size={16} strokeWidth={1.8} />
            </Link>



            {!isMobile &&
              (user ? (
                <Link
                  href={accountHref}
                  className="lg-icon-btn"
                  aria-label={user.role === "admin" ? "Admin dashboard" : "My account"}
                >
                  <User size={16} strokeWidth={1.8} />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => openAuth("login")}
                  className="lg-icon-btn"
                  aria-label="Sign in"
                >
                  <User size={14} strokeWidth={2} />
                </button>
              ))}

            <Link href="/cart" className="lg-icon-btn" aria-label="Cart">
              <ShoppingBag size={16} strokeWidth={1.8} />
              {count > 0 && <span className="lg-cart-badge">{count}</span>}
            </Link>

            {isMobile && (
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                className="lg-icon-btn"
                aria-label="Open menu"
              >
                <Menu size={18} strokeWidth={1.8} />
              </button>
            )}
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {mobileDrawerOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              onClick={() => setMobileDrawerOpen(false)}
              className="fixed inset-0 z-40 bg-black/35 backdrop-blur-sm"
              aria-hidden
            />

            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed bottom-0 left-0 top-0 z-[999] flex w-[280px] flex-col bg-[linear-gradient(160deg,rgba(255,255,255,0.97),rgba(245,245,247,0.99))] shadow-[4px_0_40px_rgba(0,0,0,0.14)] backdrop-blur-[40px] backdrop-saturate-200"
              aria-label="Mobile navigation"
            >
              <div className="flex h-[76px] items-center justify-between border-b border-line/60 px-5">
                <Link
                  href="/"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="flex items-center gap-2 text-foreground no-underline"
                >
                  <Image
                    src="/brand/logo.png"
                    alt=""
                    width={26}
                    height={26}
                    className="h-[26px] w-[26px] object-contain"
                  />
                  <span className="text-sm font-semibold tracking-[-0.02em]">
                    GamersKit
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="lg-icon-btn"
                  aria-label="Close menu"
                >
                  <X size={18} strokeWidth={1.8} />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-3 py-5">
                <ul className="m-0 flex flex-col gap-1 p-0">
                  {NAV_LINKS.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        onClick={() => setMobileDrawerOpen(false)}
                        className={cn(
                          "flex items-center rounded-xl px-4 py-3 text-[15px] font-medium",
                          pathname === link.href
                            ? "bg-black text-white"
                            : "text-foreground hover:bg-bg-soft",
                        )}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <div className="px-4 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
                      Categories
                    </div>
                    {categoriesLoading ? (
                      <div className="space-y-2 px-4">
                        <div className="h-9 animate-pulse rounded-xl bg-bg-soft" />
                        <div className="h-9 animate-pulse rounded-xl bg-bg-soft" />
                      </div>
                    ) : categories.length === 0 ? (
                      <div className="rounded-xl px-4 py-3 text-sm text-fg-muted">
                        {categoriesFailed
                          ? "Categories could not load."
                          : "No categories yet."}
                      </div>
                    ) : (
                      <ul className="m-0 flex flex-col gap-1 p-0">
                        {categories.map((category) => (
                          <li key={category._id}>
                            <Link
                              href={`/shop?category=${encodeURIComponent(category.slug)}`}
                              onClick={() => setMobileDrawerOpen(false)}
                              className="flex items-center rounded-xl px-4 py-3 text-[15px] font-medium text-foreground hover:bg-bg-soft"
                            >
                              {category.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                </ul>
              </nav>

              <div className="flex flex-col gap-2 border-t border-line/60 px-4 pb-8 pt-4">
                {user ? (
                  <>
                    <p className="m-0 truncate px-3 py-1 text-[11px] uppercase tracking-[0.1em] text-fg-muted">
                      {user.email}
                    </p>
                    <Link
                      href={accountHref}
                      onClick={() => setMobileDrawerOpen(false)}
                      className="flex items-center gap-3 rounded-xl bg-black/[0.04] px-4 py-3 text-[15px] font-medium text-foreground no-underline"
                    >
                      <User size={16} strokeWidth={1.8} />
                      {user.role === "admin" ? "Admin Dashboard" : "My Account"}
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        clearAdminToken();
                        clear();
                        setMobileDrawerOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[15px] font-medium text-red-500"
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => openAuth("login")}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-[15px] font-medium text-white"
                    >
                      <User size={15} strokeWidth={2} />
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => openAuth("register")}
                      className="flex w-full items-center justify-center rounded-xl border border-line-strong px-4 py-3 text-[15px] font-medium text-foreground"
                    >
                      Create Account
                    </button>
                  </>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AuthDrawer
        key={authDrawerOpen ? authDrawerTab : "closed"}
        isOpen={authDrawerOpen}
        onClose={() => setAuthDrawerOpen(false)}
        initialTab={authDrawerTab}
        nextParam={nextParam}
      />
    </>
  );
}
