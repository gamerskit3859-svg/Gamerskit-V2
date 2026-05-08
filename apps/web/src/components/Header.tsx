"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Search, User, Menu, X } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { AuthDrawer } from "./AuthDrawer";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
  { label: "Track order", href: "/track" },
];

const MD_BREAKPOINT = 768;

export function Header() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const count = useCart((s) => s.lines.reduce((n, l) => n + l.quantity, 0));
  const user = useAuth((s) => s.user);
  const clear = useAuth((s) => s.clear);

  const [scrolled, setScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 });
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [authDrawerOpen, setAuthDrawerOpen] = useState(false);
  const [authDrawerTab, setAuthDrawerTab] = useState<"login" | "register">("login");

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
    return () => { document.body.style.overflow = ""; };
  }, [mobileDrawerOpen]);

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
        className={`lg-navbar${scrolled ? " scrolled" : ""}`}
        aria-label="Primary">
        <div className="lg-inner">

          {/* Logo */}
          <Link href="/" className="lg-logo" aria-label="GamersKit home">
            <Image
              src="/brand/logo.png"
              alt=""
              width={26}
              height={26}
              priority
              className="h-[26px] w-[26px] object-contain"
            />
            <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.02em" }}>
              GamersKit
            </span>
          </Link>

          {/* Desktop nav links — rendered only when not mobile */}
          {!isMobile && (
            <ul
              className="lg-links"
              ref={navRef}
              onMouseLeave={() => setActiveIndex(null)}>
              <div
                className={`lg-pill${activeIndex !== null ? " visible" : ""}`}
                style={{ left: pillStyle.left, width: pillStyle.width }}
                aria-hidden
              />
              {NAV_LINKS.map((link, i) => (
                <li
                  key={link.label}
                  ref={(el) => { itemRefs.current[i] = el; }}
                  onMouseEnter={() => { setActiveIndex(i); updatePill(i); }}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          )}

          <div className="lg-actions">
            {/* Search */}
            <Link href="/shop" className="lg-icon-btn" aria-label="Search">
              <Search size={16} strokeWidth={1.8} />
            </Link>

            {/* Account / Sign In — desktop only */}
            {!isMobile && (
              user ? (
                <Link href="/account" className="lg-icon-btn" aria-label="My account">
                  <User size={16} strokeWidth={1.8} />
                </Link>
              ) : (
                <button
                  onClick={() => openAuth("login")}
                  className="lg-icon-btn"
                  aria-label="Sign in">
                  <User size={14} strokeWidth={2} />
                </button>
              )
            )}

            {/* Cart */}
            <Link href="/cart" className="lg-icon-btn" aria-label="Cart">
              <ShoppingBag size={16} strokeWidth={1.8} />
              {count > 0 && <span className="lg-cart-badge">{count}</span>}
            </Link>

            {/* Hamburger — mobile only */}
            {isMobile && (
              <button
                onClick={() => setMobileDrawerOpen(true)}
                className="lg-icon-btn"
                aria-label="Open menu">
                <Menu size={18} strokeWidth={1.8} />
              </button>
            )}
          </div>
        </div>
      </nav>

      <div aria-hidden className="h-[76px]" data-site-header-spacer="" />

      {/* ── Mobile Drawer ───────────────────────────────────── */}
      <AnimatePresence>
        {mobileDrawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              onClick={() => setMobileDrawerOpen(false)}
              style={{
                position: "fixed", inset: 0, zIndex: 40,
                background: "rgba(0,0,0,0.35)",
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
              }}
              aria-hidden
            />

            {/* Drawer panel */}
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              style={{
                position: "fixed",
                top: 0, left: 0, bottom: 0,
                zIndex: 999,
                width: 280,
                display: "flex",
                flexDirection: "column",
                background: "linear-gradient(160deg, rgba(255,255,255,0.97), rgba(245,245,247,0.99))",
                backdropFilter: "blur(40px) saturate(200%)",
                WebkitBackdropFilter: "blur(40px) saturate(200%)",
                boxShadow: "4px 0 40px rgba(0,0,0,0.14)",
              }}
              aria-label="Mobile navigation">

              {/* Drawer header */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0 20px", height: 76,
                borderBottom: "1px solid rgba(0,0,0,0.06)",
              }}>
                <Link
                  href="/"
                  onClick={() => setMobileDrawerOpen(false)}
                  style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit" }}>
                  <Image src="/brand/logo.png" alt="" width={26} height={26} style={{ height: 26, width: 26, objectFit: "contain" }} />
                  <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.02em" }}>GamersKit</span>
                </Link>
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="lg-icon-btn"
                  aria-label="Close menu">
                  <X size={18} strokeWidth={1.8} />
                </button>
              </div>

              {/* Nav links */}
              <nav style={{ flex: 1, padding: "20px 12px", overflowY: "auto" }}>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                  {NAV_LINKS.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        onClick={() => setMobileDrawerOpen(false)}
                        style={{
                          display: "flex", alignItems: "center",
                          padding: "12px 16px", borderRadius: 12,
                          fontSize: 15, fontWeight: 500, textDecoration: "none",
                          background: pathname === link.href ? "#000" : "transparent",
                          color: pathname === link.href ? "#fff" : "#1a1a1a",
                        }}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              {/* Auth / Account at bottom */}
              <div style={{
                padding: "16px 16px 32px",
                borderTop: "1px solid rgba(0,0,0,0.06)",
                display: "flex", flexDirection: "column", gap: 8,
              }}>
                {user ? (
                  <>
                    <p style={{
                      padding: "4px 12px", margin: 0,
                      fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em",
                      color: "#999", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {user.email}
                    </p>
                    <Link
                      href="/account"
                      onClick={() => setMobileDrawerOpen(false)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "12px 16px", borderRadius: 12,
                        fontSize: 15, fontWeight: 500,
                        color: "#1a1a1a", textDecoration: "none",
                        background: "rgba(0,0,0,0.04)",
                      }}>
                      <User size={16} strokeWidth={1.8} />
                      My Account
                    </Link>
                    <button
                      onClick={() => { clear(); setMobileDrawerOpen(false); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "12px 16px", borderRadius: 12,
                        fontSize: 15, fontWeight: 500,
                        color: "#ef4444", background: "none",
                        border: "none", cursor: "pointer", width: "100%", textAlign: "left",
                      }}>
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => openAuth("login")}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        padding: "13px 16px", borderRadius: 12,
                        fontSize: 15, fontWeight: 500,
                        background: "#000", color: "#fff",
                        border: "none", cursor: "pointer", width: "100%",
                      }}>
                      <User size={15} strokeWidth={2} />
                      Sign In
                    </button>
                    <button
                      onClick={() => openAuth("register")}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        padding: "13px 16px", borderRadius: 12,
                        fontSize: 15, fontWeight: 500,
                        background: "none", border: "1px solid rgba(0,0,0,0.14)",
                        color: "#1a1a1a", cursor: "pointer", width: "100%",
                      }}>
                      Create Account
                    </button>
                  </>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Auth Drawer */}
      <AuthDrawer
        isOpen={authDrawerOpen}
        onClose={() => setAuthDrawerOpen(false)}
        initialTab={authDrawerTab}
        nextParam={nextParam}
      />
    </>
  );
}
