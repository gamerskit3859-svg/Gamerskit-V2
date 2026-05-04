"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Footer() {
  const pathname = usePathname();
  // Admin has its own layout — don't render the storefront footer on /admin/*
  if (pathname?.startsWith("/admin")) return null;

  return (
    <footer className="hairline-t bg-[var(--bg-soft)] mt-24">
      <div className="mx-auto max-w-[1280px] px-5 lg:px-8 py-14 grid gap-10 md:grid-cols-4 text-[13px] text-[var(--fg-soft)]">
        <div>
          <div className="text-[var(--fg)] font-semibold text-[15px] tracking-tight">
            GamersKit
          </div>
          <p className="mt-2 leading-relaxed">
            Bangladesh&apos;s gaming gear store. RC drift cars, F1 jerseys,
            e-sports apparel.
          </p>
        </div>
        <div>
          <div className="text-[var(--fg)] font-medium mb-3">Shop</div>
          <ul className="space-y-2">
            <li>
              <Link href="/shop/rc-car">RC cars</Link>
            </li>
            <li>
              <Link href="/shop/f1-jersey">F1 jerseys</Link>
            </li>
            <li>
              <Link href="/shop/esports">E-sports</Link>
            </li>
            <li>
              <Link href="/shop/tshirt">T-shirts</Link>
            </li>
          </ul>
        </div>
        <div>
          <div className="text-[var(--fg)] font-medium mb-3">Help</div>
          <ul className="space-y-2">
            <li>
              <Link href="/track">Track order</Link>
            </li>
            <li>
              <Link href="/policies/shipping">Shipping</Link>
            </li>
            <li>
              <Link href="/policies/returns">Returns</Link>
            </li>
            <li>
              <Link href="/contact">Contact</Link>
            </li>
          </ul>
        </div>
        <div>
          <div className="text-[var(--fg)] font-medium mb-3">Contact</div>
          <ul className="space-y-2">
            <li>WhatsApp: 01303-775977</li>
            <li>Dhaka, Bangladesh</li>
          </ul>
        </div>
      </div>
      <div className="hairline-t">
        <div className="mx-auto max-w-[1280px] px-5 lg:px-8 py-6 text-[12px] text-[var(--fg-muted)] flex justify-between">
          <span>© {new Date().getFullYear()} GamersKit. All rights reserved.</span>
          <span>Made in Bangladesh.</span>
        </div>
      </div>
    </footer>
  );
}
