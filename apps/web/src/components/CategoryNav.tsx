"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CATEGORIES } from "@gamerskit/shared";

export function CategoryNav({ activeSlug }: { activeSlug?: string }) {
  const pathname = usePathname();
  const isAll = !activeSlug && pathname === "/shop";
  return (
    <div className="sticky top-12 z-40 glass-strong hairline-b">
      <div className="mx-auto max-w-[1280px] px-5 lg:px-8 py-3 flex gap-2 overflow-x-auto">
        <Link
          href="/shop"
          className={`px-4 py-1.5 rounded-full text-[13px] whitespace-nowrap transition-colors ${
            isAll
              ? "bg-black text-white"
              : "border border-[var(--line-strong)] text-[var(--fg-soft)] hover:text-[var(--fg)]"
          }`}
        >
          All
        </Link>
        {CATEGORIES.map((c) => {
          const active = c.slug === activeSlug;
          return (
            <Link
              key={c.slug}
              href={`/shop/${c.slug}`}
              className={`px-4 py-1.5 rounded-full text-[13px] whitespace-nowrap transition-colors ${
                active
                  ? "bg-black text-white"
                  : "border border-[var(--line-strong)] text-[var(--fg-soft)] hover:text-[var(--fg)]"
              }`}
            >
              {c.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
