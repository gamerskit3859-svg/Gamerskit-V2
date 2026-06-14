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

function flattenCategories(items: Category[], depth = 0): Array<Category & { depth: number }> {
  return items.flatMap((item) => [
    { ...item, depth },
    ...flattenCategories(item.subcategories || [], depth + 1),
  ]);
}

const NAVBAR_VISIBLE_EVENT = "GK Shop:navbar-visibility";
const MOBILE_BREAKPOINT = 768;
const DEFAULT_MOBILE_NAV_HEIGHT = 64;
const DEFAULT_DESKTOP_NAV_HEIGHT = 72;
const ANNOUNCEMENT_BAR_HEIGHT = 40;

const chipBase =
  "shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] transition-colors";
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
  const [stickyTop, setStickyTop] = useState(
    DEFAULT_MOBILE_NAV_HEIGHT + ANNOUNCEMENT_BAR_HEIGHT,
  );

  useEffect(() => {
    let latest = {
      visible: true,
      topOffset: 40,
      mobileHeight: DEFAULT_MOBILE_NAV_HEIGHT,
      desktopHeight: DEFAULT_DESKTOP_NAV_HEIGHT,
    };

    function calculateTop() {
      if (!latest.visible) return ANNOUNCEMENT_BAR_HEIGHT;
      const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
      const navHeight =
        isMobile ? latest.mobileHeight : latest.desktopHeight;
      return ANNOUNCEMENT_BAR_HEIGHT + navHeight;
    }

    function syncTop() {
      setStickyTop(calculateTop());
    }

    function handleNavbarVisibility(event: Event) {
      const detail =
        (event as CustomEvent<{
          visible?: boolean;
          topOffset?: number;
          mobileHeight?: number;
          desktopHeight?: number;
        }>).detail ?? {};
      latest = {
        visible: detail.visible !== false,
        topOffset: detail.topOffset ?? 0,
        mobileHeight: detail.mobileHeight ?? DEFAULT_MOBILE_NAV_HEIGHT,
        desktopHeight: detail.desktopHeight ?? DEFAULT_DESKTOP_NAV_HEIGHT,
      };
      syncTop();
    }

    window.addEventListener(NAVBAR_VISIBLE_EVENT, handleNavbarVisibility);
    window.addEventListener("resize", syncTop);
    syncTop();
    return () => {
      window.removeEventListener(NAVBAR_VISIBLE_EVENT, handleNavbarVisibility);
      window.removeEventListener("resize", syncTop);
    };
  }, []);

  useEffect(() => {
    if (initialCategories.length > 0) return;
    let cancelled = false;

    async function loadCategories() {
      try {
        const result = await api.listCategoriesFresh();
        if (cancelled) return;
        setCategories(result.items);
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          const message = err instanceof Error ? err.message : String(err);
          console.warn(`Failed to load categories: ${message}`);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadCategories();
    return () => {
      cancelled = true;
    };
  }, [initialCategories.length]);

  if (loading) {
    return (
      <div
        className="glass-strong sticky z-40 w-full max-w-full overflow-hidden border-b border-line transition-[top] duration-200 ease-out"
        style={{ top: stickyTop }}
      >
        <div className="no-scrollbar mx-auto w-full max-w-[1280px] overflow-x-auto px-5 py-3 lg:px-8">
          <div className="flex min-w-max gap-2">
            <div className="h-6 w-12 animate-pulse rounded-full bg-gray-200 px-4 py-1.5 text-[13px]" />
          </div>
        </div>
      </div>
    );
  }

  const categoryChips = flattenCategories(categories);

  return (
    <div
      className="glass-strong sticky z-40 w-full max-w-full overflow-hidden border-b border-line transition-[top] duration-200 ease-out"
      style={{ top: stickyTop }}
    >
      <div className="no-scrollbar mx-auto w-full max-w-[1280px] overflow-x-auto px-5 py-3 lg:px-8">
        <div className="flex min-w-max gap-2">
          <Link href="/shop" className={cn(chipBase, isAll ? chipActive : chipIdle)}>
            All
          </Link>
          {categoryChips.map((c) => {
            const active = c.slug === activeCategory;
            return (
              <Link
                key={c._id}
                href={`/shop?category=${c.slug}`}
                className={cn(chipBase, active ? chipActive : chipIdle)}
              >
                {c.depth > 0 ? `- ${c.name}` : c.name}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
