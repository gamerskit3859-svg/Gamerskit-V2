"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";
import { formatBDT } from "@/lib/format";
import type { Product } from "@gamerskit/shared";

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
    if (filter === "low") return items.filter((p) => p.stock > 0 && p.stock <= LOW_THRESHOLD);
    if (filter === "out") return items.filter((p) => p.stock <= 0);
    return items;
  }, [items, filter]);

  const counts = useMemo(
    () => ({
      total: items.length,
      low: items.filter((p) => p.stock > 0 && p.stock <= LOW_THRESHOLD).length,
      out: items.filter((p) => p.stock <= 0).length,
      stockValue: items.reduce((n, p) => n + p.price * Math.max(0, p.stock), 0),
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <header className="mb-6">
        <span className="eyebrow">Admin</span>
        <h1 className="text-3xl font-semibold tracking-tight mt-2">Inventory</h1>
        <p className="text-sm text-[var(--fg-soft)] mt-1">
          {counts.total} SKUs · {counts.low} low · {counts.out} out · stock value{" "}
          <span className="font-medium text-[var(--fg)]">{formatBDT(counts.stockValue)}</span>
        </p>
      </header>

      <div className="flex flex-wrap gap-2 mb-5">
        {(
          [
            ["all", "All"],
            ["low", `Low (${counts.low})`],
            ["out", `Out (${counts.out})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`btn ${filter === k ? "btn-primary" : "btn-ghost"} !py-2 !px-4 text-xs`}
          >
            {label}
          </button>
        ))}
        <input
          className="input !w-72 !ml-auto"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="card-soft p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-sm text-[var(--fg-muted)]">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-sm text-[var(--fg-muted)] text-center">No products in this view.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white text-xs text-[var(--fg-soft)] text-left">
                <tr>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 w-40">Price</th>
                  <th className="py-3 px-4 w-56">Stock</th>
                  <th className="py-3 px-4 w-20">View</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p._id} className="hairline-t bg-white align-middle">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 bg-[var(--bg-soft)] rounded overflow-hidden flex-shrink-0">
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
                          <div className="text-xs text-[var(--fg-muted)] font-mono">{p.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 capitalize text-[var(--fg-soft)]">
                      {p.category.replace(/-/g, " ")}
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="number"
                        defaultValue={p.price}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (Number.isFinite(v) && v !== p.price) void setPrice(p._id, v);
                        }}
                        className="input !py-1.5 !px-2 !w-28"
                        disabled={busyId === p._id}
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => adjust(p._id, -1)}
                          disabled={busyId === p._id}
                          className="w-7 h-7 rounded-full bg-[var(--bg-soft)] hover:bg-white border border-[var(--line)]"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          defaultValue={p.stock}
                          key={p.stock}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (Number.isFinite(v)) void setExactStock(p._id, v);
                          }}
                          className={`input !py-1 !px-2 !w-16 text-center ${
                            p.stock <= 0
                              ? "text-red-600"
                              : p.stock <= LOW_THRESHOLD
                                ? "text-yellow-700"
                                : ""
                          }`}
                          disabled={busyId === p._id}
                        />
                        <button
                          onClick={() => adjust(p._id, 1)}
                          disabled={busyId === p._id}
                          className="w-7 h-7 rounded-full bg-[var(--bg-soft)] hover:bg-white border border-[var(--line)]"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4">
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
      </div>
    </motion.div>
  );
}
