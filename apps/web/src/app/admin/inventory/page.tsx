"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";
import { formatBDT } from "@/lib/format";
import type { Product } from "@/types/shared";
import { Button, Card, Input } from "@/components/ui";
import { cn } from "@/lib/cn";

const LOW_THRESHOLD = 3;

export default function InventoryPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const token = getAdminToken();
    if (!token) return;
    void (async () => {
      setLoading(true);
      try {
        const r = await api.listProducts({ q: q || undefined, limit: 200 });
        if (!cancelled) setItems(r.items);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q]);

  const filtered = useMemo(() => {
    if (filter === "low")
      return items.filter((p) => p.stock > 0 && p.stock <= LOW_THRESHOLD);
    if (filter === "out") return items.filter((p) => p.stock <= 0);
    return items;
  }, [items, filter]);

  const counts = useMemo(
    () => ({
      total: items.length,
      low: items.filter((p) => p.stock > 0 && p.stock <= LOW_THRESHOLD).length,
      out: items.filter((p) => p.stock <= 0).length,
      stockValue: items.reduce(
        (n, p) => n + p.price * Math.max(0, p.stock),
        0,
      ),
    }),
    [items],
  );

  async function adjust(id: string, delta: number) {
    const token = getAdminToken();
    if (!token) return;
    setBusyId(id);
    try {
      const r = await api.adjustStock(id, delta, token);
      setItems((prev) => prev.map((p) => (p._id === id ? r.item : p)));
    } finally {
      setBusyId(null);
    }
  }

  async function setExactStock(id: string, value: number) {
    const product = items.find((p) => p._id === id);
    if (!product) return;
    const delta = value - product.stock;
    if (delta === 0) return;
    await adjust(id, delta);
  }

  async function setPrice(id: string, value: number) {
    const token = getAdminToken();
    if (!token) return;
    setBusyId(id);
    try {
      const r = await api.updateProduct(id, { price: value }, token);
      setItems((prev) => prev.map((p) => (p._id === id ? r.item : p)));
    } finally {
      setBusyId(null);
    }
  }

  const filters = [
    { key: "all", label: "All" },
    { key: "low", label: `Low (${counts.low})` },
    { key: "out", label: `Out (${counts.out})` },
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
          {counts.total} SKUs · {counts.low} low · {counts.out} out · stock
          value{" "}
          <span className="font-medium text-foreground">
            {formatBDT(counts.stockValue)}
          </span>
        </p>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {filters.map(({ key, label }) => (
          <Button
            key={key}
            size="sm"
            variant={filter === key ? "primary" : "ghost"}
            onClick={() => setFilter(key)}
          >
            {label}
          </Button>
        ))}
        <Input
          className="!ml-auto !w-72"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <Card tone="soft" padding="none" className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-sm text-fg-muted">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-fg-muted">
            No products in this view.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
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
                {filtered.map((p) => (
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
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => adjust(p._id, -1)}
                          disabled={busyId === p._id}
                          className="h-7 w-7 rounded-full border border-line bg-bg-soft hover:bg-white disabled:opacity-50"
                        >
                          −
                        </button>
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
                            "!w-16 !py-1 !px-2 text-center",
                            p.stock <= 0
                              ? "text-red-600"
                              : p.stock <= LOW_THRESHOLD
                                ? "text-yellow-700"
                                : "",
                          )}
                          disabled={busyId === p._id}
                        />
                        <button
                          type="button"
                          onClick={() => adjust(p._id, 1)}
                          disabled={busyId === p._id}
                          className="h-7 w-7 rounded-full border border-line bg-bg-soft hover:bg-white disabled:opacity-50"
                        >
                          +
                        </button>
                      </div>
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
    </motion.div>
  );
}
