"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { CldUploadWidget } from "next-cloudinary";
import type {
  CloudinaryUploadWidgetError,
  CloudinaryUploadWidgetResults,
} from "next-cloudinary";
import { Upload, X, AlertCircle, CheckCircle2 } from "lucide-react";

import { api } from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";
import { formatBDT } from "@/lib/format";
import { useDebouncedSearch, usePersistentFilters } from "@/lib/hooks";
import {
  PRODUCT_ACTIVE_OPTIONS,
  PRODUCT_SORT_OPTIONS,
} from "@/types/shared";
import type {
  Product,
  ProductActiveFilter,
  ProductListSort,
} from "@/types/shared";
import {
  Button,
  Card,
  FieldLabel,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { FilterTabs } from "@/components/admin/FilterTabs";
import { cn } from "@/lib/cn";

interface Category {
  _id: string;
  slug: string;
  name: string;
  parentId?: string | null;
}

type ProductCategory =
  | string
  | {
      _id?: string;
      slug?: string;
      name?: string;
    };

interface DraftProduct {
  title: string;
  slug: string;
  category: string;
  price: number;
  compareAtPrice: number;
  buyingPrice: number;
  stock: number;
  sizeChartUrl: string;
  description: string;
  images: string[];
  variants: NonNullable<Product["variants"]>;
  isFeatured: boolean;
  isBestSelling: boolean;
  isNewArrival: boolean;
  freeDelivery: boolean;
  readyStock: boolean;
  isActive: boolean;
}

const blank = (firstCategorySlug?: string): DraftProduct => ({
  title: "",
  slug: "",
  category: firstCategorySlug ?? "",
  price: 0,
  compareAtPrice: 0,
  buyingPrice: 0,
  stock: 0,
  sizeChartUrl: "",
  description: "",
  images: [],
  variants: [],
  isFeatured: false,
  isBestSelling: false,
  isNewArrival: false,
  freeDelivery: false,
  readyStock: false,
  // A new product is live unless the admin says otherwise; hiding it by default
  // would mean every create needs a second step before it sells.
  isActive: true,
});

const PAGE_SIZE = 30;

const FILTERS_STORAGE_KEY = "gk:admin:products:filters";

// Flat and JSON-safe so it can round-trip through localStorage. The search box
// is deliberately not persisted: a stale query would make the list look empty
// on the next visit with no obvious cause.
const DEFAULT_FILTERS = {
  category: "all",
  active: "all" as ProductActiveFilter,
  sort: "newest" as ProductListSort,
};

function getProductCategoryValue(category: ProductCategory): string {
  if (!category) return "";

  if (typeof category === "string") {
    return category;
  }

  return category.slug || category._id || "";
}

function fromProduct(p: Product, categories: Category[]): DraftProduct {
  const categoryValue = getProductCategoryValue(
    p.category as ProductCategory,
  );

  const matchedCategory = categories.find(
    (c) => c._id === categoryValue || c.slug === categoryValue,
  );

  return {
    title: p.title,
    slug: p.slug,
    category: matchedCategory?.slug ?? "",
    price: p.price,
    compareAtPrice: p.compareAtPrice ?? 0,
    buyingPrice: p.buyingPrice ?? 0,
    stock: p.stock,
    sizeChartUrl: p.sizeChartUrl ?? "",
    description: p.description ?? "",
    images: p.images ?? [],
    variants: p.variants ?? [],
    isFeatured: !!(p.isFeatured ?? p.featured),
    isBestSelling: !!p.isBestSelling,
    isNewArrival: !!p.isNewArrival,
    freeDelivery: !!p.freeDelivery,
    readyStock: !!p.readyStock,
    // Unset means active: products predate the flag, so only an explicit false
    // counts as deactivated.
    isActive: p.isActive !== false,
  };
}

function stockColor(stock: number): string {
  if (stock > 5) return "text-foreground";
  if (stock > 0) return "text-yellow-700";
  return "text-red-600";
}

function variantTotalStock(product: Product): number {
  const groups = product.variants ?? [];
  if (!groups.some((group) => group.options?.length)) return product.stock;
  return groups.reduce(
    (sum, group) =>
      sum +
      group.options.reduce(
        (optionSum, option) => optionSum + (Number(option.stock) || 0),
        0,
      ),
    0,
  );
}

/**
 * Storefront visibility as a switch rather than a checkbox: it is the one
 * control here that changes what customers can see, and a switch says "this is
 * on / off right now" where a checkbox says "this will be saved". Products that
 * predate the flag have it unset, which counts as visible.
 */
function StorefrontToggle({
  product,
  busy,
  onToggle,
}: {
  product: Product;
  busy: boolean;
  onToggle: () => void;
}) {
  const active = product.isActive !== false;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label={`${active ? "Hide" : "Show"} ${product.title} on the storefront`}
        title={
          active
            ? "Live on the storefront. Click to hide it."
            : "Hidden from the storefront. Click to put it back."
        }
        disabled={busy}
        onClick={onToggle}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
          active ? "bg-emerald-500" : "bg-neutral-300",
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
            active ? "translate-x-[18px]" : "translate-x-[2px]",
          )}
        />
      </button>
      <span
        className={cn(
          "text-xs",
          busy
            ? "text-fg-muted"
            : active
              ? "text-emerald-700"
              : "text-fg-muted",
        )}
      >
        {busy ? "Saving…" : active ? "Active" : "Hidden"}
      </span>
    </div>
  );
}

function BackorderBadge({ stock }: { stock: number }) {
  if (stock >= 0) return null;
  return (
    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
      Backorder: {Math.abs(stock)}
    </span>
  );
}

export default function AdminProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const {
    value: q,
    setValue: setQ,
    debouncedValue: searchQuery,
  } = useDebouncedSearch("");
  // Kept in localStorage: the category, the sort and the visibility filter used
  // to reset every time the admin opened a product or moved to another page,
  // which meant re-picking them on every return trip.
  const {
    filters,
    patchFilters,
    resetFilters,
    hydrated: filtersReady,
  } = usePersistentFilters(FILTERS_STORAGE_KEY, DEFAULT_FILTERS);
  const { category, active, sort } = filters;

  const filtersActive =
    category !== "all" || active !== "all" || sort !== "newest" || q !== "";

  function clearFilters() {
    setPage(1);
    resetFilters();
    setQ("");
  }

  const categoryTabs = useMemo(
    () => [
      { value: "all", label: "All" },
      ...categories.map((c) => ({ value: c.slug, label: c.name })),
    ],
    [categories],
  );

  // Row range for the footer, so "page 2 of 9" also says which products these
  // are. Mirrors the orders list.
  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = total === 0 ? 0 : firstRow + items.length - 1;

  const [draft, setDraft] = useState<DraftProduct>(blank());
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which row's storefront toggle is mid-flight, so it can be disabled without
  // freezing the rest of the list.
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [uploadState, setUploadState] = useState<
    | { kind: "idle" }
    | { kind: "uploading" }
    | { kind: "success"; count: number }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setCategoriesLoading(true);

      try {
        const result = await api.listCategoriesFresh();

        if (!cancelled) {
          const topLevel = (result.items as Category[]).filter(
            (c) => !c.parentId,
          );

          setCategories(topLevel);

          if (topLevel.length > 0) {
            setDraft(blank(topLevel[0].slug));
          }
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Failed to load categories:", err);
        }

        if (!cancelled) {
          setCategories([]);
        }
      } finally {
        if (!cancelled) {
          setCategoriesLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Hold the first fetch until the saved filters are in: firing now would
    // load the defaults and then immediately throw that page away.
    if (!filtersReady) return;
    let cancelled = false;

    void (async () => {
      setLoading(true);

      try {
        const token = getAdminToken();
        if (!token) throw new Error("Admin token not found.");

        const r = await api.listProductsAdmin({
          q: searchQuery || undefined,
          category: category === "all" ? undefined : category,
          active: active === "all" ? undefined : active,
          sort,
          page,
          limit: PAGE_SIZE,
        }, token);

        if (!cancelled) {
          setItems(r.items);
          setTotal(r.total);
          setTotalPages(Math.max(1, r.totalPages));
        }
      } catch {
        if (!cancelled) {
          setItems([]);
          setTotal(0);
          setTotalPages(1);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filtersReady, searchQuery, category, active, sort, page]);

  function startCreate() {
    setEditing(null);
    setDraft(blank(categories.length > 0 ? categories[0].slug : ""));
    setError(null);
    setUploadState({ kind: "idle" });
    setOpen(true);
  }

  function startEdit(p: Product) {
    if (categoriesLoading || categories.length === 0) {
      setError("Categories are still loading. Please try again.");
      return;
    }

    setEditing(p);
    setDraft(fromProduct(p, categories));
    setError(null);
    setUploadState({ kind: "idle" });
    setOpen(true);
  }

  async function save() {
    const token = getAdminToken();

    if (!token) {
      setError("Admin token not found. Please login again.");
      return;
    }

    setBusy(true);
    setError(null);

    const selectedCategory = categories.find(
      (c) => c.slug === draft.category || c._id === draft.category,
    );

    if (!selectedCategory) {
      setError("Please select a valid category");
      setBusy(false);
      return;
    }

    for (const group of draft.variants) {
      if (!group.name.trim()) {
        setError("Variant group name is required.");
        setBusy(false);
        return;
      }
      const seen = new Set<string>();
      for (const option of group.options) {
        const value = option.value.trim();
        if (!value) {
          setError(`Variant option value is required for ${group.name}.`);
          setBusy(false);
          return;
        }
        const key = value.toLowerCase();
        if (seen.has(key)) {
          setError(`Duplicate option "${value}" in ${group.name}.`);
          setBusy(false);
          return;
        }
        seen.add(key);
      }
    }

    const body: Partial<Product> = {
      title: draft.title.trim(),
      slug:
        draft.slug.trim() ||
        draft.title.trim().toLowerCase().replace(/\s+/g, "-"),
      category: selectedCategory._id,
      price: Number(draft.price),
      compareAtPrice: draft.compareAtPrice > 0 ? Number(draft.compareAtPrice) : undefined,
      buyingPrice: Number(draft.buyingPrice) || 0,
      stock: Number(draft.stock),
      sizeChartUrl: draft.sizeChartUrl.trim() || undefined,
      description: draft.description,
      images: draft.images,
      variants: draft.variants,
      featured: draft.isFeatured,
      isFeatured: draft.isFeatured,
      isBestSelling: draft.isBestSelling,
      isNewArrival: draft.isNewArrival,
      freeDelivery: draft.freeDelivery,
      readyStock: draft.readyStock,
      isActive: draft.isActive,
    };

    try {
      if (editing) {
        const r = await api.updateProduct(editing._id, body, token);

        // Same rule as the inline toggle: an edit that flips visibility against
        // the current filter takes the row out of the list.
        const stays =
          active === "all" || (active === "active") === draft.isActive;
        setItems((prev) =>
          stays
            ? prev.map((p) => (p._id === editing._id ? r.item : p))
            : prev.filter((p) => p._id !== editing._id),
        );
        if (!stays) setTotal((prev) => Math.max(0, prev - 1));
      } else {
        const r = await api.createProduct(body, token);

        setItems((prev) => [r.item, ...prev]);
      }

      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Show or hide a product on the storefront without opening the editor. The
   * server is the source of truth for the new value, so the row adopts what
   * came back rather than the value that was sent.
   */
  async function toggleActive(p: Product) {
    const token = getAdminToken();

    if (!token) {
      setError("Admin token not found. Please login again.");
      return;
    }

    const next = p.isActive === false;
    // A row that no longer matches the visibility filter leaves the list, rather
    // than sitting there contradicting the filter above it.
    const stays = active === "all" || (active === "active") === next;
    setTogglingId(p._id);
    setError(null);

    try {
      const r = await api.updateProduct(p._id, { isActive: next }, token);
      setItems((prev) =>
        stays
          ? prev.map((x) => (x._id === p._id ? r.item : x))
          : prev.filter((x) => x._id !== p._id),
      );
      // Keep the footer's "showing N of M" honest when a row drops out.
      if (!stays) setTotal((prev) => Math.max(0, prev - 1));
    } catch (err) {
      setError(
        `Could not ${next ? "activate" : "deactivate"} ${p.title}: ${(err as Error).message}`,
      );
    } finally {
      setTogglingId(null);
    }
  }

  async function remove(p: Product) {
    if (!confirm(`Delete ${p.title}?`)) return;

    const token = getAdminToken();

    if (!token) {
      setError("Admin token not found. Please login again.");
      return;
    }

    await api.deleteProduct(p._id, token);

    setItems((prev) => prev.filter((x) => x._id !== p._id));
  }

  function addVariantGroup() {
    setDraft((prev) => ({
      ...prev,
      variants: [
        ...prev.variants,
        { name: "", options: [{ value: "", stock: 0, sku: "", price: undefined }] },
      ],
    }));
  }

  function updateVariantGroup(index: number, name: string) {
    setDraft((prev) => ({
      ...prev,
      variants: prev.variants.map((group, i) =>
        i === index ? { ...group, name } : group,
      ),
    }));
  }

  function removeVariantGroup(index: number) {
    setDraft((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }));
  }

  function addVariantOption(groupIndex: number) {
    setDraft((prev) => ({
      ...prev,
      variants: prev.variants.map((group, i) =>
        i === groupIndex
          ? {
              ...group,
              options: [
                ...group.options,
                { value: "", stock: 0, sku: "", price: undefined },
              ],
            }
          : group,
      ),
    }));
  }

  function updateVariantOption(
    groupIndex: number,
    optionIndex: number,
    field: "value" | "stock" | "sku" | "price",
    value: string,
  ) {
    setDraft((prev) => ({
      ...prev,
      variants: prev.variants.map((group, i) =>
        i === groupIndex
          ? {
              ...group,
              options: group.options.map((option, j) =>
                j === optionIndex
                  ? {
                      ...option,
                      [field]:
                        field === "stock"
                          ? Number(value) || 0
                          : field === "price"
                            ? value === ""
                              ? undefined
                              : Math.max(0, Number(value) || 0)
                            : value,
                    }
                  : option,
              ),
            }
          : group,
      ),
    }));
  }

  function removeVariantOption(groupIndex: number, optionIndex: number) {
    setDraft((prev) => ({
      ...prev,
      variants: prev.variants.map((group, i) =>
        i === groupIndex
          ? {
              ...group,
              options: group.options.filter((_, j) => j !== optionIndex),
            }
          : group,
      ),
    }));
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <AdminPageHeader
        title="Products"
        description={`${total} products${filtersActive ? " matching these filters" : ""}.`}
        actions={
          <Button onClick={startCreate} disabled={categoriesLoading}>
            <span className="sm:hidden">+ Product</span>
            <span className="hidden sm:inline">+ New product</span>
          </Button>
        }
      >
        {error && !open && <p className="mt-2 text-sm text-red-600">{error}</p>}

        {/* Category is a tab strip at every width, matching the order list's
            status strip: it is the filter used constantly and the chips make
            the current one visible without opening anything. */}
        <FilterTabs
          className="mt-3"
          label="Filter by category"
          options={categoryTabs}
          value={category}
          disabled={categoriesLoading}
          onChange={(next) => {
            setPage(1);
            patchFilters({ category: next });
          }}
        />

        {/* The rest of the phone filters. Visibility and sort share a row; the
            search box gets one to itself. */}
        <div className="mt-2 md:hidden">
          <Input
            className="!w-full !py-2 !text-sm"
            placeholder="Search title or slug…"
            aria-label="Search products"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Select
              className="!w-full !py-2 !text-xs"
              aria-label="Filter by storefront visibility"
              value={active}
              onChange={(e) => {
                setPage(1);
                patchFilters({
                  active: e.target.value as ProductActiveFilter,
                });
              }}
            >
              {PRODUCT_ACTIVE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.value === "all" ? "All products" : o.label}
                </option>
              ))}
            </Select>
            <Select
              className="!w-full !py-2 !text-xs"
              aria-label="Sort products"
              value={sort}
              onChange={(e) => {
                setPage(1);
                patchFilters({ sort: e.target.value as ProductListSort });
              }}
            >
              {PRODUCT_SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          {/* Only when there is something to reset: on a phone an always-on
              disabled button costs a row for nothing. */}
          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 !w-full"
              onClick={clearFilters}
            >
              Reset filters
            </Button>
          )}
        </div>

        {/* Desktop filters: everything except category, which has its own strip. */}
        <div className="mt-2 hidden flex-wrap items-center gap-3 md:flex">
          <Select
            className="!w-auto"
            aria-label="Filter by storefront visibility"
            value={active}
            onChange={(e) => {
              setPage(1);
              patchFilters({ active: e.target.value as ProductActiveFilter });
            }}
          >
            {PRODUCT_ACTIVE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value === "all" ? "All products" : o.label}
              </option>
            ))}
          </Select>
          <Select
            className="!w-auto"
            aria-label="Sort products"
            value={sort}
            onChange={(e) => {
              setPage(1);
              patchFilters({ sort: e.target.value as ProductListSort });
            }}
          >
            {PRODUCT_SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Input
            className="!w-72"
            placeholder="Search title or slug…"
            aria-label="Search products"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            disabled={!filtersActive}
            title={
              filtersActive
                ? "Clear the category, visibility, sort and search"
                : "No filters applied"
            }
            onClick={clearFilters}
          >
            Reset filters
          </Button>
        </div>
      </AdminPageHeader>

      <Card tone="soft" padding="none" className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-sm text-fg-muted">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-fg-muted">
            <p>No products match these filters.</p>
            {filtersActive && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={clearFilters}
              >
                Reset filters
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Below md each product becomes a card: six columns, one of them a
                row of badges, will not fit a phone. */}
            <ul className="divide-y divide-line md:hidden">
              {items.map((p) => {
                const productCategoryValue = getProductCategoryValue(
                  p.category as ProductCategory,
                );
                const productCategory = categories.find(
                  (c) =>
                    c._id === productCategoryValue ||
                    c.slug === productCategoryValue,
                );
                const stock = variantTotalStock(p);
                return (
                  <li key={p._id} className="bg-white p-3">
                    <div className="flex items-start gap-3">
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-bg-soft">
                        {p.images?.[0] && (
                          <Image
                            src={p.images[0]}
                            alt=""
                            fill
                            sizes="44px"
                            className="object-cover"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.title}</p>
                        <p className="truncate text-[11px] capitalize text-fg-muted">
                          {productCategory?.name || "Unknown"}
                          {" · "}
                          <span className="font-mono normal-case">{p.slug}</span>
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold">
                          {formatBDT(p.price)}
                        </p>
                        <p className={cn("text-[11px]", stockColor(stock))}>
                          stock: {stock}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
                      <BackorderBadge stock={stock} />
                      {p.isActive === false && (
                        <span className="rounded-full bg-neutral-200 px-2 py-0.5 font-medium text-neutral-700">
                          Hidden
                        </span>
                      )}
                      {(p.isFeatured ?? p.featured) && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                          Featured
                        </span>
                      )}
                      {p.isBestSelling && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                          Best
                        </span>
                      )}
                      {p.isNewArrival && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">
                          New
                        </span>
                      )}
                      {p.readyStock && (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 font-medium text-sky-700">
                          Ready
                        </span>
                      )}
                      {p.variants?.some((group) => group.options?.length) && (
                        <span className="text-[11px] text-fg-muted">
                          {p.variants.length} variant group
                          {p.variants.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <StorefrontToggle
                        product={p}
                        busy={togglingId === p._id}
                        onToggle={() => toggleActive(p)}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(p)}
                          disabled={categoriesLoading}
                          className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <Link
                          href={`/product/${p.slug}`}
                          target="_blank"
                          className="rounded-lg border border-line px-2.5 py-1.5 text-center text-xs font-medium"
                        >
                          Open ↗
                        </Link>
                        <button
                          type="button"
                          onClick={() => remove(p)}
                          className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="hidden overflow-x-auto md:block">
            <table className="min-w-[980px] w-full text-sm">
              <thead className="bg-white text-left text-xs text-fg-soft">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Storefront</th>
                  <th className="px-4 py-3">Home sections</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {items.map((p) => {
                  const productCategoryValue = getProductCategoryValue(
                    p.category as ProductCategory,
                  );

                  const productCategory = categories.find(
                    (c) =>
                      c._id === productCategoryValue ||
                      c.slug === productCategoryValue,
                  );

                  return (
                    <tr
                      key={p._id}
                      className="border-t border-line bg-white hover:bg-bg-soft"
                    >
                      <td className="flex items-center gap-3 px-4 py-3">
                        <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-bg-soft">
                          {p.images?.[0] && (
                            <Image
                              src={p.images[0]}
                              alt=""
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          )}
                        </div>

                        <div>
                          <div className="font-medium">{p.title}</div>

                          <div className="font-mono text-xs text-fg-muted">
                            {p.slug}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 capitalize">
                        {productCategory?.name || "Unknown"}
                      </td>

                      <td className="px-4 py-3 font-medium">
                        {formatBDT(p.price)}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn("text-xs", stockColor(variantTotalStock(p)))}>
                            stock: {variantTotalStock(p)}
                          </span>
                          <BackorderBadge stock={variantTotalStock(p)} />
                        </div>
                        {p.variants?.some((group) => group.options?.length) && (
                          <div className="mt-1 text-[11px] text-fg-muted">
                            {p.variants.length} variant group
                            {p.variants.length !== 1 ? "s" : ""}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <StorefrontToggle
                          product={p}
                          busy={togglingId === p._id}
                          onToggle={() => toggleActive(p)}
                        />
                      </td>

                      <td className="px-4 py-3 text-xs">
                        <div className="flex flex-wrap gap-1">
                          {(p.isFeatured ?? p.featured) && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                              Featured
                            </span>
                          )}
                          {p.isBestSelling && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                              Best
                            </span>
                          )}
                          {p.isNewArrival && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">
                              New
                            </span>
                          )}
                          {p.readyStock && (
                            <span className="rounded-full bg-sky-100 px-2 py-0.5 font-medium text-sky-700">
                              Ready
                            </span>
                          )}
                          {!(p.isFeatured ?? p.featured) &&
                            !p.isBestSelling &&
                            !p.isNewArrival &&
                            !p.readyStock &&
                            "—"}
                        </div>
                      </td>

                      <td className="space-x-3 whitespace-nowrap px-4 py-3 text-right">
                        <Link
                          href={`/product/${p.slug}`}
                          target="_blank"
                          className="text-xs underline underline-offset-4"
                        >
                          Open ↗
                        </Link>

                        <button
                          type="button"
                          onClick={() => startEdit(p)}
                          disabled={categoriesLoading}
                          className="text-xs underline disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => remove(p)}
                          className="text-xs text-red-600 underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </>
        )}
      </Card>

      {!loading && items.length > 0 && (
        <div className="mt-4 flex flex-col gap-3 text-sm text-fg-soft sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {firstRow}–{lastRow} of {total}
          </span>
          {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-fg-muted">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-3 py-6 backdrop-blur-sm sm:p-4"
            onClick={() => !busy && setOpen(false)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ type: "spring", damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl rounded-2xl bg-white p-4 shadow-xl sm:p-6"
            >
              <h2 className="mb-4 text-xl font-semibold">
                {editing ? `Edit ${editing.title}` : "New product"}
              </h2>

              <div className="space-y-3">
                <FieldLabel label="Title">
                  <Input
                    value={draft.title}
                    onChange={(e) =>
                      setDraft({ ...draft, title: e.target.value })
                    }
                  />
                </FieldLabel>

                <div className="grid gap-3 sm:grid-cols-2">
                  <FieldLabel label="Slug">
                    <Input
                      className="font-mono"
                      value={draft.slug}
                      onChange={(e) =>
                        setDraft({ ...draft, slug: e.target.value })
                      }
                      placeholder="auto from title"
                    />
                  </FieldLabel>

                  <FieldLabel label="Category">
                    <Select
                      value={draft.category}
                      onChange={(e) =>
                        setDraft({ ...draft, category: e.target.value })
                      }
                      disabled={categoriesLoading}
                    >
                      <option value="" disabled>
                        Select category
                      </option>

                      {categories.map((c) => (
                        <option key={c._id} value={c.slug}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </FieldLabel>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <FieldLabel label="Selling price (৳)">
                    <Input
                      type="number"
                      value={draft.price}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          price: Number(e.target.value),
                        })
                      }
                    />
                  </FieldLabel>

                  <FieldLabel label="Discount price (৳)">
                    <Input
                      type="number"
                      value={draft.compareAtPrice || ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          compareAtPrice: Number(e.target.value),
                        })
                      }
                      placeholder="0"
                    />
                    <p className="mt-1 text-[11px] text-fg-muted">
                      Must be lower than selling price. The selling price will show crossed out.
                    </p>
                  </FieldLabel>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <FieldLabel label="Buying price (৳)">
                    <Input
                      type="number"
                      value={draft.buyingPrice}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          buyingPrice: Number(e.target.value),
                        })
                      }
                      placeholder="0"
                    />
                    <p className="mt-1 text-[11px] text-fg-muted">
                      Wholesale cost per unit. Used to compute gross profit in
                      reports.
                    </p>
                  </FieldLabel>

                  <FieldLabel label="Stock">
                    <Input
                      type="number"
                      value={draft.stock}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          stock: Number(e.target.value),
                        })
                      }
                    />
                  </FieldLabel>
                </div>

                <label className="flex items-start gap-2 rounded-lg border border-line bg-bg-soft p-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={draft.isActive}
                    onChange={(e) =>
                      setDraft({ ...draft, isActive: e.target.checked })
                    }
                  />
                  <span>
                    <span className="font-medium">Active on the storefront</span>
                    <span className="block text-xs text-fg-muted">
                      Off hides it from every listing, search, category count and
                      the shopping feeds, and its product page returns 404. It
                      stays here in the admin with its stock and history intact.
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-2 rounded-lg border border-line bg-bg-soft p-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={draft.readyStock}
                    onChange={(e) =>
                      setDraft({ ...draft, readyStock: e.target.checked })
                    }
                  />
                  <span>
                    <span className="font-medium">Ready stock</span>
                    <span className="block text-xs text-fg-muted">
                      On the shelf and shippable today. Internal only — customers
                      never see this. Use it to filter orders you can dispatch
                      straight away.
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-2 rounded-lg border border-line bg-bg-soft p-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={draft.freeDelivery}
                    onChange={(e) =>
                      setDraft({ ...draft, freeDelivery: e.target.checked })
                    }
                  />
                  <span>
                    <span className="font-medium">Free delivery</span>
                    <span className="block text-xs text-fg-muted">
                      Orders where every item has free delivery are shipped for ৳0.
                      Otherwise the standard delivery charge applies.
                    </span>
                  </span>
                </label>

                <FieldLabel label="Size chart URL">
                  <Input
                    type="text"
                    value={draft.sizeChartUrl}
                    onChange={(e) =>
                      setDraft({ ...draft, sizeChartUrl: e.target.value })
                    }
                    placeholder="https://... (image URL for the size chart)"
                  />
                  <p className="mt-1 text-[11px] text-fg-muted">
                    Optional. A &quot;Size Chart&quot; button will appear on the product page.
                  </p>
                </FieldLabel>

                <FieldLabel label="Product Images">
                  <div className="space-y-3">
                    {draft.images.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                        {draft.images.map((url, index) => (
                          <div key={url} className="group relative">
                            <div className="relative aspect-square overflow-hidden rounded-lg border border-line bg-bg-soft">
                              <Image
                                src={url}
                                alt={`Product image ${index + 1}`}
                                fill
                                className="object-cover"
                                sizes="(max-width: 768px) 50vw, 25vw"
                              />

                              <button
                                type="button"
                                onClick={() => {
                                  setDraft({
                                    ...draft,
                                    images: draft.images.filter(
                                      (_, i) => i !== index,
                                    ),
                                  });
                                }}
                                className="absolute right-1 top-1 rounded-full bg-red-500 p-1 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {uploadPreset ? (
                      <CldUploadWidget
                        uploadPreset={uploadPreset}
                        onOpen={() => setUploadState({ kind: "uploading" })}
                        onQueuesEnd={(
                          results: CloudinaryUploadWidgetResults,
                        ) => {
                          const info = results?.info;

                          if (info && typeof info === "object") {
                            // no-op
                          }
                        }}
                        onSuccess={(result: CloudinaryUploadWidgetResults) => {
                          if (
                            result.event === "success" &&
                            result.info &&
                            typeof result.info === "object" &&
                            "secure_url" in result.info &&
                            typeof result.info.secure_url === "string"
                          ) {
                            const url = result.info.secure_url;

                            setDraft((d) => ({
                              ...d,
                              images: d.images.includes(url)
                                ? d.images
                                : [...d.images, url],
                            }));

                            setUploadState((s) => ({
                              kind: "success",
                              count: s.kind === "success" ? s.count + 1 : 1,
                            }));
                          }
                        }}
                        onError={(error: CloudinaryUploadWidgetError) => {
                          const message =
                            typeof error === "string"
                              ? error
                              : (error as { statusText?: string })
                                  ?.statusText ??
                                "Upload failed. Please try again.";

                          setUploadState({ kind: "error", message });
                        }}
                        options={{
                          maxFiles: 10,
                          maxFileSize: 5_000_000,
                          resourceType: "image",
                          clientAllowedFormats: [
                            "jpg",
                            "jpeg",
                            "png",
                            "webp",
                          ],
                          multiple: true,
                        }}
                      >
                        {({ open, isLoading }) => (
                          <button
                            type="button"
                            onClick={() => {
                              setUploadState({ kind: "idle" });
                              open();
                            }}
                            disabled={isLoading}
                            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line bg-bg-soft py-8 text-sm text-fg-muted transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50"
                          >
                            <Upload size={20} />

                            {isLoading || uploadState.kind === "uploading"
                              ? "Uploading…"
                              : "Click to upload images"}
                          </button>
                        )}
                      </CldUploadWidget>
                    ) : (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                        <AlertCircle
                          size={14}
                          className="mt-0.5 flex-shrink-0"
                        />

                        <div>
                          Image upload is disabled — the{" "}
                          <code className="font-mono">
                            NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
                          </code>{" "}
                          environment variable is not set.
                        </div>
                      </div>
                    )}

                    {uploadState.kind === "success" && (
                      <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">
                        <CheckCircle2 size={14} />
                        Uploaded {uploadState.count}{" "}
                        {uploadState.count === 1 ? "image" : "images"} to
                        Cloudinary.
                      </div>
                    )}

                    {uploadState.kind === "error" && (
                      <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                        <AlertCircle size={14} />
                        {uploadState.message}
                      </div>
                    )}

                    <p className="text-xs text-fg-muted">
                      Upload up to 10 images. Max 5MB each. Supported formats:
                      JPG, PNG, WebP.
                    </p>
                  </div>
                </FieldLabel>

                <FieldLabel label="Description">
                  <Textarea
                    className="h-20"
                    value={draft.description}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        description: e.target.value,
                      })
                    }
                  />
                </FieldLabel>

                <div className="rounded-lg border border-line bg-white p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Product variants
                      </p>
                      <p className="text-xs text-fg-muted">
                        Add groups like Size, Color, Storage, Edition, or
                        Material. Variant stock is used instead of base stock.
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={addVariantGroup}>
                      Add variant group
                    </Button>
                  </div>

                  {draft.variants.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-line p-4 text-sm text-fg-muted">
                      No variants. This product will use the base stock field.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {draft.variants.map((group, groupIndex) => {
                        const duplicateValues = new Set<string>();
                        const seenValues = new Set<string>();
                        group.options.forEach((option) => {
                          const key = option.value.trim().toLowerCase();
                          if (!key) return;
                          if (seenValues.has(key)) duplicateValues.add(key);
                          seenValues.add(key);
                        });

                        return (
                          <div
                            key={groupIndex}
                            className="rounded-lg border border-line bg-bg-soft p-3">
                            <div className="mb-3 flex gap-2">
                              <Input
                                placeholder="Variant name e.g. Size"
                                value={group.name}
                                onChange={(e) =>
                                  updateVariantGroup(groupIndex, e.target.value)
                                }
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeVariantGroup(groupIndex)}>
                                Remove
                              </Button>
                            </div>

                            <div className="space-y-2">
                              {group.options.map((option, optionIndex) => {
                                const duplicate = duplicateValues.has(
                                  option.value.trim().toLowerCase(),
                                );
                                return (
                                  <div
                                    key={optionIndex}
                                    className="grid gap-2 sm:grid-cols-[1.2fr_100px_1fr_120px_auto]">
                                    <Input
                                      placeholder="Option value"
                                      value={option.value}
                                      onChange={(e) =>
                                        updateVariantOption(
                                          groupIndex,
                                          optionIndex,
                                          "value",
                                          e.target.value,
                                        )
                                      }
                                      className={duplicate ? "border-red-300" : ""}
                                    />
                                    <Input
                                      type="number"
                                      placeholder="Stock"
                                      value={option.stock}
                                      onChange={(e) =>
                                        updateVariantOption(
                                          groupIndex,
                                          optionIndex,
                                          "stock",
                                          e.target.value,
                                        )
                                      }
                                    />
                                    <Input
                                      placeholder="SKU optional"
                                      value={option.sku ?? ""}
                                      onChange={(e) =>
                                        updateVariantOption(
                                          groupIndex,
                                          optionIndex,
                                          "sku",
                                          e.target.value,
                                        )
                                      }
                                    />
                                    <Input
                                      type="number"
                                      min={0}
                                      placeholder="Price override"
                                      value={option.price ?? ""}
                                      onChange={(e) =>
                                        updateVariantOption(
                                          groupIndex,
                                          optionIndex,
                                          "price",
                                          e.target.value,
                                        )
                                      }
                                    />
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() =>
                                        removeVariantOption(
                                          groupIndex,
                                          optionIndex,
                                        )
                                      }>
                                      Remove
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>

                            <Button
                              className="mt-3"
                              size="sm"
                              variant="ghost"
                              onClick={() => addVariantOption(groupIndex)}>
                              Add option
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-line bg-bg-soft p-4">
                  <p className="mb-3 text-sm font-semibold text-foreground">
                    Homepage sections
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.isFeatured}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            isFeatured: e.target.checked,
                          })
                        }
                      />
                      Featured Product
                    </label>

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.isBestSelling}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            isBestSelling: e.target.checked,
                          })
                        }
                      />
                      Best Selling Product
                    </label>

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.isNewArrival}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            isNewArrival: e.target.checked,
                          })
                        }
                      />
                      New Arrival Product
                    </label>
                  </div>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                >
                  Cancel
                </Button>

                <Button
                  onClick={save}
                  disabled={
                    busy ||
                    !draft.title.trim() ||
                    !draft.category ||
                    categoriesLoading
                  }
                >
                  {busy ? "Saving…" : editing ? "Save changes" : "Create"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
