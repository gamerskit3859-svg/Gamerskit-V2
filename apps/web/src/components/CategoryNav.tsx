"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Category {
  _id: string;
  slug: string;
  name: string;
  subcategories?: Category[];
}

export function CategoryNav({ activeSlug }: { activeSlug?: string }) {
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get("category") || activeSlug;
  const isAll = !activeCategory;
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCategories() {
      try {
        const result = await api.listCategories();
        setCategories(result.items);
      } catch (err) {
        console.error("Failed to load categories:", err);
      } finally {
        setLoading(false);
      }
    }
    loadCategories();
  }, []);

  if (loading) {
    return (
      <div className="sticky top-12 z-40 glass-strong hairline-b">
        <div className="mx-auto max-w-[1280px] px-5 lg:px-8 py-3 flex gap-2 overflow-x-auto">
          <div className="px-4 py-1.5 rounded-full text-[13px] bg-gray-200 animate-pulse w-12 h-6" />
        </div>
      </div>
    );
  }

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
        {categories.map((c) => {
          const active = c.slug === activeCategory;
          return (
            <Link
              key={c._id}
              href={`/shop?category=${c.slug}`}
              className={`px-4 py-1.5 rounded-full text-[13px] whitespace-nowrap transition-colors ${
                active
                  ? "bg-black text-white"
                  : "border border-[var(--line-strong)] text-[var(--fg-soft)] hover:text-[var(--fg)]"
              }`}
            >
              {c.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
