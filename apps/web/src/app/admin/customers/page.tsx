"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";
import { formatBDT, formatDateTime } from "@/lib/format";
import { useDebouncedSearch } from "@/lib/hooks";
import type { AdminCustomer } from "@/types/shared";
import { Button, Card, Input } from "@/components/ui";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

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
      <AdminPageHeader
        title="Customers"
        description={`${total} unique customers across the order history.`}
      >
        <div className="mt-4 sm:mt-5">
          <Input
            className="!w-full sm:!w-80"
            placeholder="Search by name, phone, or email…"
            aria-label="Search customers"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
        </div>
      </AdminPageHeader>

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
          <>
            {/* Six columns cannot survive a 390px screen, so below md each
                customer becomes a card carrying the same figures. */}
            <ul className="divide-y divide-line md:hidden">
              {items.map((c, i) => (
                <li key={`${c._id}-${i}`} className="bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {c.name || "—"}
                      </p>
                      <p className="truncate text-xs text-fg-soft">
                        {c.phone ? (
                          <a
                            href={`tel:${c.phone}`}
                            className="underline underline-offset-2"
                          >
                            {c.phone}
                          </a>
                        ) : (
                          "—"
                        )}
                        {c.city && ` · ${c.city}`}
                      </p>
                      {c.email && (
                        <p className="truncate text-[11px] text-fg-muted">
                          {c.email}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold">
                        {formatBDT(c.revenue)}
                      </p>
                      <p className="text-[11px] text-fg-muted">
                        {c.orders} {c.orders === 1 ? "order" : "orders"}
                      </p>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[11px] text-fg-muted">
                    Last order{" "}
                    {c.lastOrderAt ? formatDateTime(c.lastOrderAt) : "—"}
                  </p>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto md:block">
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
          </>
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
