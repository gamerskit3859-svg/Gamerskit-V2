"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";
import { formatBDT, formatDateTime } from "@/lib/format";
import type { AdminCustomer } from "@gamerskit/shared";

export default function CustomersPage() {
  const [items, setItems] = useState<AdminCustomer[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const token = getAdminToken();
    if (!token) return;
    void (async () => {
      setLoading(true);
      try {
        const r = await api.customers({ q: q || undefined, limit: 100 }, token);
        if (cancelled) return;
        setItems(r.items);
        setTotal(r.total);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <header className="mb-6">
        <span className="eyebrow">Admin</span>
        <h1 className="text-3xl font-semibold tracking-tight mt-2">Customers</h1>
        <p className="text-sm text-[var(--fg-soft)] mt-1">
          {total} unique customers across the order history.
        </p>
        <div className="mt-5">
          <input
            className="input !w-80"
            placeholder="Search by name, phone, or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </header>

      <div className="card-soft p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-sm text-[var(--fg-muted)]">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-sm text-[var(--fg-muted)] text-center">
            No customers match.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white text-xs text-[var(--fg-soft)] text-left">
                <tr>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">City</th>
                  <th className="py-3 px-4">Orders</th>
                  <th className="py-3 px-4">Lifetime value</th>
                  <th className="py-3 px-4">Last order</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c, i) => (
                  <tr key={`${c._id}-${i}`} className="hairline-t bg-white">
                    <td className="py-3 px-4 font-medium">{c.name || "—"}</td>
                    <td className="py-3 px-4 text-[var(--fg-soft)]">
                      <div>{c.phone || "—"}</div>
                      <div className="text-xs text-[var(--fg-muted)]">{c.email || ""}</div>
                    </td>
                    <td className="py-3 px-4 text-[var(--fg-soft)]">{c.city || "—"}</td>
                    <td className="py-3 px-4">{c.orders}</td>
                    <td className="py-3 px-4 font-medium">{formatBDT(c.revenue)}</td>
                    <td className="py-3 px-4 text-xs text-[var(--fg-muted)]">
                      {c.lastOrderAt ? formatDateTime(c.lastOrderAt) : "—"}
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
