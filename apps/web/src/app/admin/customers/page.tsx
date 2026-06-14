"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";
import { formatBDT, formatDateTime } from "@/lib/format";
import { useDebouncedSearch } from "@/lib/hooks";
import type { AdminCustomer } from "@/types/shared";
import { Button, Card, Input } from "@/components/ui";

const PAGE_SIZE = 30;

export default function CustomersPage() {
  const [items, setItems] = useState<AdminCustomer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const {
    value: q,
    setValue: setQ,
    debouncedValue: searchQuery,
  } = useDebouncedSearch("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const token = getAdminToken();
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        if (!token) throw new Error("Admin token not found. Please login again.");
        const r = await api.customers(
          { q: searchQuery || undefined, page, limit: PAGE_SIZE },
          token,
        );
        if (cancelled) return;
        setItems(r.items);
        setTotal(r.total);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load customers.");
          setItems([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchQuery, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Customers</h1>
        <p className="mt-1 text-sm text-fg-soft">
          {total} unique customers across the order history.
        </p>
        <div className="mt-5">
          <Input
            className="!w-full sm:!w-80"
            placeholder="Search by name, phone, or email…"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
        </div>
      </header>

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
            No customers match.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-sm">
              <thead className="bg-white text-left text-xs text-fg-soft">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Orders</th>
                  <th className="px-4 py-3">Lifetime value</th>
                  <th className="px-4 py-3">Last order</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c, i) => (
                  <tr
                    key={`${c._id}-${i}`}
                    className="border-t border-line bg-white"
                  >
                    <td className="px-4 py-3 font-medium">{c.name || "—"}</td>
                    <td className="px-4 py-3 text-fg-soft">
                      <div>{c.phone || "—"}</div>
                      <div className="text-xs text-fg-muted">
                        {c.email || ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-fg-soft">
                      {c.city || "—"}
                    </td>
                    <td className="px-4 py-3">{c.orders}</td>
                    <td className="px-4 py-3 font-medium">
                      {formatBDT(c.revenue)}
                    </td>
                    <td className="px-4 py-3 text-xs text-fg-muted">
                      {c.lastOrderAt ? formatDateTime(c.lastOrderAt) : "—"}
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
