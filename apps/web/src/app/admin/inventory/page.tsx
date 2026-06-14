"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";
import { formatBDT } from "@/lib/format";
import { useDebouncedSearch } from "@/lib/hooks";
import type { Product } from "@/types/shared";
import { Button, Card, Input } from "@/components/ui";
import { cn } from "@/lib/cn";

const LOW_THRESHOLD = 3;
const PAGE_SIZE = 30;

function hasVariants(product: Product): boolean {
  return product.variants?.some((group) => group.options?.length) ?? false;
}

function totalStock(product: Product): number {
  if (!hasVariants(product)) return product.stock;
  return (product.variants ?? []).reduce(
    (sum, group) =>
      sum +
      group.options.reduce(
        (optionSum, option) => optionSum + (Number(option.stock) || 0),
        0,
      ),
    0,
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

function stockColor(stock: number): string {
  if (stock <= 0) return "text-red-600";
  if (stock <= LOW_THRESHOLD) return "text-yellow-700";
  return "text-foreground";
}

export default function InventoryPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    low: 0,
    out: 0,
    stockValue: 0,
  });
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const {
    value: q,
    setValue: setQ,
    debouncedValue: searchQuery,
  } = useDebouncedSearch("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const token = getAdminToken();
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        if (!token) {
          throw new Error("Admin token not found. Please login again.");
        }
        const [r, summaryResult] = await Promise.all([
          api.listProductsAdmin({
            q: searchQuery || undefined,
            stock: filter === "all" ? undefined : filter,
            page,
            limit: PAGE_SIZE,
          }, token),
          api.inventorySummary(token),
        ]);
        if (!cancelled) {
          setItems(r.items);
          setSummary(summaryResult);
          setTotalPages(Math.max(1, r.totalPages));
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to load inventory.";
          setError(message);
          setItems([]);
          setTotalPages(1);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchQuery, filter, page]);

  async function adjust(id: string, delta: number) {
    const token = getAdminToken();
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      const r = await api.adjustStock(id, delta, token);
      setItems((prev) => prev.map((p) => (p._id === id ? r.item : p)));
      const summaryResult = await api.inventorySummary(token);
      setSummary(summaryResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update stock.";
      setError(message);
    } finally {
      setBusyId(null);
    }
  }

  async function setExactStock(id: string, value: number) {
    const product = items.find((p) => p._id === id);
    if (!product) return;
    if (hasVariants(product)) return;
    const delta = value - product.stock;
    if (delta === 0) return;
    await adjust(id, delta);
  }

  async function setPrice(id: string, value: number) {
    const token = getAdminToken();
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      const r = await api.updateProduct(id, { price: value }, token);
      setItems((prev) => prev.map((p) => (p._id === id ? r.item : p)));
      const summaryResult = await api.inventorySummary(token);
      setSummary(summaryResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update price.";
      setError(message);
    } finally {
      setBusyId(null);
    }
  }

  const filters = [
    { key: "all", label: "All" },
    { key: "low", label: `Low (${summary.low})` },
    { key: "out", label: `Out (${summary.out})` },
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <header className="mb-6">
        <span className="block text-xs font-medium uppercase tracking-[0.18em] text-fg-soft">
          Admin
        </span>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Inventory
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          {summary.total} SKUs · {summary.low} low · {summary.out} out · stock
          value{" "}
          <span className="font-medium text-foreground">
            {formatBDT(summary.stockValue)}
          </span>
        </p>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {filters.map(({ key, label }) => (
          <Button
            key={key}
            size="sm"
            variant={filter === key ? "primary" : "ghost"}
            onClick={() => {
              setPage(1);
              setFilter(key);
            }}
          >
            {label}
          </Button>
        ))}
        <Input
          className="!w-full sm:!ml-auto sm:!w-72"
          placeholder="Search…"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
        />
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card tone="soft" padding="none" className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-sm text-fg-muted">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-fg-muted">
            No products in this view.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[820px] w-full text-sm">
              <thead className="bg-white text-left text-xs text-fg-soft">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="w-40 px-4 py-3">Price</th>
                  <th className="w-56 px-4 py-3">Stock</th>
                  <th className="w-20 px-4 py-3">View</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr
                    key={p._id}
                    className="border-t border-line bg-white align-middle"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-bg-soft">
                          {p.images[0] && (
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
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize text-fg-soft">
                      {p.category.replace(/-/g, " ")}
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        defaultValue={p.price}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (Number.isFinite(v) && v !== p.price)
                            void setPrice(p._id, v);
                        }}
                        className="!w-28 !py-1.5 !px-2"
                        disabled={busyId === p._id}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {hasVariants(p) ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-sm font-medium", stockColor(totalStock(p)))}>
                              stock: {totalStock(p)}
                            </span>
                            <BackorderBadge stock={totalStock(p)} />
                          </div>
                          <div className="text-xs text-fg-muted">
                            Variant stock. Edit product variants to adjust.
                          </div>
                        </div>
                      ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => adjust(p._id, -1)}
                          disabled={busyId === p._id}
                          className="h-7 w-7 rounded-full border border-line bg-bg-soft hover:bg-white disabled:opacity-50"
                        >
                          −
                        </button>
                        <div className="flex flex-col gap-1">
                          <Input
                            type="number"
                            defaultValue={p.stock}
                            key={p.stock}
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (Number.isFinite(v))
                                void setExactStock(p._id, v);
                            }}
                            className={cn(
                              "!w-20 !py-1 !px-2 text-center",
                              p.stock <= 0
                                ? "text-red-600"
                                : p.stock <= LOW_THRESHOLD
                                  ? "text-yellow-700"
                                  : "",
                            )}
                            disabled={busyId === p._id}
                          />
                          <BackorderBadge stock={p.stock} />
                        </div>
                        <button
                          type="button"
                          onClick={() => adjust(p._id, 1)}
                          disabled={busyId === p._id}
                          className="h-7 w-7 rounded-full border border-line bg-bg-soft hover:bg-white disabled:opacity-50"
                        >
                          +
                        </button>
                      </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/product/${p.slug}`}
                        target="_blank"
                        className="text-xs underline underline-offset-4"
                      >
                        Open ↗
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!loading && totalPages > 1 && (
        <div className="mt-4 flex flex-col gap-3 text-sm text-fg-soft sm:flex-row sm:items-center sm:justify-between">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
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
        </div>
      )}
    </motion.div>
  );
}
