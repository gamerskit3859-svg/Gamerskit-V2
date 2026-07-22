"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
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
  const [damageTarget, setDamageTarget] = useState<Product | null>(null);

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

  async function markDamaged(
    id: string,
    quantity: number,
    reason: string,
  ): Promise<boolean> {
    const token = getAdminToken();
    if (!token) return false;
    setBusyId(id);
    setError(null);
    try {
      const r = await api.markDamaged(id, { quantity, reason: reason || undefined }, token);
      setItems((prev) => prev.map((p) => (p._id === id ? r.item : p)));
      const summaryResult = await api.inventorySummary(token);
      setSummary(summaryResult);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to record damage.";
      setError(message);
      return false;
    } finally {
      setBusyId(null);
    }
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
            <table className="min-w-[960px] w-full text-sm">
              <thead className="bg-white text-left text-xs text-fg-soft">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="w-40 px-4 py-3">Price</th>
                  <th className="w-56 px-4 py-3">Stock</th>
                  <th className="w-40 px-4 py-3">Damaged</th>
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
                      <button
                        type="button"
                        onClick={() => setDamageTarget(p)}
                        disabled={busyId === p._id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-fg-soft transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Mark damaged
                      </button>
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

      <DamageModal
        product={damageTarget}
        busy={damageTarget ? busyId === damageTarget._id : false}
        onClose={() => setDamageTarget(null)}
        onConfirm={async (quantity, reason) => {
          if (!damageTarget) return;
          const ok = await markDamaged(damageTarget._id, quantity, reason);
          if (ok) setDamageTarget(null);
        }}
      />
    </motion.div>
  );
}

/**
 * Modal for writing off damaged units of a product. Shows product context and
 * a live loss estimate; confirming decrements stock and deducts the buying
 * cost from accounting.
 */
function DamageModal({
  product,
  busy,
  onClose,
  onConfirm,
}: {
  product: Product | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (quantity: number, reason: string) => void | Promise<void>;
}) {
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("");

  // Reset the form whenever a different product is opened.
  useEffect(() => {
    if (product) {
      setQty(1);
      setReason("");
    }
  }, [product]);

  // Close on Escape while the modal is open.
  useEffect(() => {
    if (!product) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [product, busy, onClose]);

  const onHand = product ? totalStock(product) : 0;
  const unitCost = product?.buyingPrice ?? 0;
  const estimatedLoss = unitCost * Math.max(0, qty);

  function submit() {
    if (!Number.isFinite(qty) || qty < 1) return;
    void onConfirm(Math.floor(qty), reason.trim());
  }

  return (
    <AnimatePresence>
      {product && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.18 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="damage-modal-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div>
                  <h2
                    id="damage-modal-title"
                    className="text-base font-semibold tracking-tight"
                  >
                    Mark damaged
                  </h2>
                  <p className="mt-0.5 text-xs text-fg-soft">
                    Writes off stock and records the loss in accounting.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                aria-label="Close"
                className="rounded-lg p-1 text-fg-muted transition-colors hover:bg-bg-soft hover:text-foreground disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-bg-soft/60 p-3">
              <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-white">
                {product.images?.[0] && (
                  <Image
                    src={product.images[0]}
                    alt=""
                    fill
                    sizes="44px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{product.title}</div>
                <div className="mt-0.5 text-xs text-fg-soft">
                  In stock: <span className="font-medium text-foreground">{onHand}</span>
                  {unitCost > 0 && <> · Buying price {formatBDT(unitCost)}</>}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-fg-soft">
                  Damaged quantity
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQty((n) => Math.max(1, n - 1))}
                    disabled={busy || qty <= 1}
                    className="h-9 w-9 rounded-lg border border-line text-lg leading-none text-fg-soft transition-colors hover:bg-bg-soft disabled:opacity-50"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <Input
                    type="number"
                    min={1}
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                    className="!w-20 text-center"
                    aria-label="Damaged quantity"
                  />
                  <button
                    type="button"
                    onClick={() => setQty((n) => n + 1)}
                    disabled={busy}
                    className="h-9 w-9 rounded-lg border border-line text-lg leading-none text-fg-soft transition-colors hover:bg-bg-soft disabled:opacity-50"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-fg-soft">
                  Reason <span className="text-fg-muted">(optional)</span>
                </label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. broken in transit, water damage"
                  maxLength={200}
                  aria-label="Damage reason"
                />
              </div>

              {unitCost > 0 && (
                <div className="flex items-center justify-between rounded-xl bg-rose-50 px-4 py-3">
                  <span className="text-xs font-medium uppercase tracking-wide text-rose-700">
                    Estimated loss
                  </span>
                  <span className="text-lg font-semibold tabular-nums text-rose-700">
                    −{formatBDT(estimatedLoss)}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <button
                type="button"
                onClick={submit}
                disabled={busy || qty < 1}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
              >
                {busy ? "Saving…" : `Write off ${qty} unit${qty === 1 ? "" : "s"}`}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
