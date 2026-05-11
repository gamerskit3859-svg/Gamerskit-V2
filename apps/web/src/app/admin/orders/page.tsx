"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { clearAdminToken, getAdminToken } from "@/lib/admin-token";
import { formatBDT, formatDateTime } from "@/lib/format";
import { ORDER_STATUSES } from "@gamerskit/shared";
import {
  DateRangePicker,
  type DateRange,
} from "@/components/admin/DateRangePicker";
import type { Order } from "@gamerskit/shared";
import { Card, Input, LinkButton, Select } from "@/components/ui";
import { cn } from "@/lib/cn";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const SOURCE_OPTIONS = [
  { value: "all", label: "All sources" },
  { value: "storefront", label: "Storefront" },
  { value: "manual", label: "Manual / custom" },
];

function getAllTimeRange(): DateRange {
  const today = new Date().toISOString().slice(0, 10);
  return { from: "1970-01-01", to: today, label: "All time" };
}

export default function AdminOrdersPage() {
  const [range, setRange] = useState<DateRange>(getAllTimeRange());
  const [items, setItems] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const token = getAdminToken();
    if (!token) {
      clearAdminToken();
      router.replace("/admin");
      return;
    }

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
      } catch (err) {
        const status = (err as any)?.status;
        if (status === 401 || status === 403) {
          clearAdminToken();
          router.replace("/admin");
          return;
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, status, source, q, router]);

  return (
    <div>
      <header className="mb-6">
        <span className="block text-xs font-medium uppercase tracking-[0.18em] text-fg-soft">
          Admin
        </span>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
            <p className="mt-1 text-sm text-fg-soft">
              {total} orders in {range.label.toLowerCase()}
            </p>
          </div>
          <LinkButton href="/admin/orders/new">+ Custom order</LinkButton>
        </div>
        <div className="mt-5">
          <DateRangePicker value={range} onChange={setRange} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Select
            className="!w-auto"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            className="!w-auto"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Input
            className="!w-64"
            placeholder="Search order #, name, phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </header>

      <Card tone="soft" padding="none" className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-sm text-fg-muted">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-fg-muted">
            No orders match these filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white text-left text-xs text-fg-soft">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Placed</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((o) => (
                  <tr
                    key={o._id}
                    className="border-t border-line bg-white hover:bg-bg-soft"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      {o.orderNumber}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{o.customer.name}</div>
                      <div className="text-xs text-fg-muted">
                        {o.customer.phone}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {o.items.length}{" "}
                      <span className="text-fg-muted">
                        ({o.items.reduce((n, l) => n + l.quantity, 0)} units)
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatBDT(o.total)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest",
                          o.source === "manual"
                            ? "bg-black text-white"
                            : "bg-bg-soft text-fg-soft",
                        )}
                      >
                        {o.source}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        className="!w-auto !py-1 !text-xs"
                        value={o.status}
                        onChange={async (e) => {
                          const token = getAdminToken();
                          if (!token) return;
                          const newStatus = e.target.value;
                          const r = await api.updateOrder(
                            o._id,
                            { status: newStatus as typeof o.status },
                            token,
                          );
                          setItems((prev) =>
                            prev.map((x) =>
                              x._id === o._id ? r.order : x,
                            ),
                          );
                        }}
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-fg-soft">
                      {formatDateTime(o.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/orders/${o._id}`}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
