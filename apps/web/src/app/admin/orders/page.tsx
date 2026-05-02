"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";
import { formatBDT, formatDateTime } from "@/lib/format";
import {
  DateRangePicker,
  defaultRange,
  type DateRange,
} from "@/components/admin/DateRangePicker";
import type { Order } from "@gamerskit/shared";

export default function AdminOrdersPage() {
  const [range, setRange] = useState<DateRange>(defaultRange());
  const [items, setItems] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const token = getAdminToken();
    if (!token) return;
    void (async () => {
      setLoading(true);
      try {
        const r = await api.listOrdersAdmin(
          { from: range.from, to: range.to, status, source, q, limit: 50 },
          token,
        );
        if (cancelled) return;
        setItems(r.items);
        setTotal(r.total);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, status, source, q]);

  return (
    <div>
      <header className="mb-6">
        <span className="eyebrow">Admin</span>
        <div className="flex flex-wrap items-center justify-between gap-4 mt-2">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
            <p className="text-sm text-[var(--fg-soft)] mt-1">
              {total} orders in {range.label.toLowerCase()}
            </p>
          </div>
          <Link href="/admin/orders/new" className="btn btn-primary">
            + Custom order
          </Link>
        </div>
        <div className="mt-5 flex flex-wrap gap-3 items-center">
          <DateRangePicker value={range} onChange={setRange} />
        </div>
        <div className="mt-3 flex flex-wrap gap-3 items-center">
          <select
            className="select !w-auto"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            className="select !w-auto"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="all">All sources</option>
            <option value="storefront">Storefront</option>
            <option value="manual">Manual / custom</option>
          </select>
          <input
            className="input !w-64"
            placeholder="Search order #, name, phone…"
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
            No orders match these filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white text-xs text-[var(--fg-soft)] text-left">
                <tr>
                  <th className="py-3 px-4">Order</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Placed</th>
                </tr>
              </thead>
              <tbody>
                {items.map((o) => (
                  <tr key={o._id} className="hairline-t bg-white hover:bg-[var(--bg-soft)]">
                    <td className="py-3 px-4 font-mono text-xs">
                      {o.orderNumber}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium">{o.customer.name}</div>
                      <div className="text-xs text-[var(--fg-muted)]">
                        {o.customer.phone}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {o.items.length}{" "}
                      <span className="text-[var(--fg-muted)]">
                        ({o.items.reduce((n, l) => n + l.quantity, 0)} units)
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium">
                      {formatBDT(o.total)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full ${
                          o.source === "manual"
                            ? "bg-black text-white"
                            : "bg-[var(--bg-soft)] text-[var(--fg-soft)]"
                        }`}
                      >
                        {o.source}
                      </span>
                    </td>
                    <td className="py-3 px-4 capitalize">{o.status}</td>
                    <td className="py-3 px-4 text-[var(--fg-soft)]">
                      {formatDateTime(o.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
