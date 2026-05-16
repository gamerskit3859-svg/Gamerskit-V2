"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";

interface Category {
  _id: string;
  slug: string;
  name: string;
  subcategories?: Category[];
}

const chipBase =
  "whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] transition-colors";
const chipActive = "bg-black text-white";
const chipIdle =
  "border border-line-strong text-fg-soft hover:text-foreground";

export function CategoryNav({
  activeSlug,
  initialCategories = [],
}: {
  activeSlug?: string;
  initialCategories?: Category[];
}) {
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get("category") || activeSlug;
  const isAll = !activeCategory;
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [loading, setLoading] = useState(initialCategories.length === 0);

  useEffect(() => {
    if (initialCategories.length > 0) return;

    async function loadCategories() {
      try {
        const result = await api.listCategories();
        setCategories(result.items);
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Failed to load categories:", err);
        }
      } finally {
        setLoading(false);
      }
    }
    loadCategories();
  }, [initialCategories.length]);

  if (loading) {
    return (
      <div className="glass-strong sticky top-12 z-40 border-b border-line">
        <div className="mx-auto flex max-w-[1280px] gap-2 overflow-x-auto px-5 py-3 lg:px-8">
          <div className="h-6 w-12 animate-pulse rounded-full bg-gray-200 px-4 py-1.5 text-[13px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="glass-strong sticky top-12 z-40 border-b border-line">
      <div className="mx-auto flex max-w-[1280px] gap-2 overflow-x-auto px-5 py-3 lg:px-8">
        <Link href="/shop" className={cn(chipBase, isAll ? chipActive : chipIdle)}>
          All
        </Link>
        {categories.map((c) => {
          const active = c.slug === activeCategory;
          return (
            <Link
              key={c._id}
              href={`/shop?category=${c.slug}`}
              className={cn(chipBase, active ? chipActive : chipIdle)}
            >
              {c.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
