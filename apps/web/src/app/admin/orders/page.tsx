"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { clearAdminToken, getAdminToken } from "@/lib/admin-token";
import {
  getCourierStatusText,
  getCourierTrackUrl,
  getStatusFromResponse,
} from "@/lib/courier";
import { formatBDT, formatDateTime } from "@/lib/format";
import { useDebouncedSearch } from "@/lib/hooks";
import { ORDER_STATUSES } from "@/types/shared";
import {
  DateRangePicker,
  type DateRange,
} from "@/components/admin/DateRangePicker";
import type { Order } from "@/types/shared";
import { Button, Card, Input, LinkButton, Select } from "@/components/ui";
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

const PAGE_SIZE = 30;

function getAllTimeRange(): DateRange {
  const today = new Date().toISOString().slice(0, 10);
  return { from: "1970-01-01", to: today, label: "All time" };
}

export default function AdminOrdersPage() {
  const [range, setRange] = useState<DateRange>(getAllTimeRange());
  const [items, setItems] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [courierLoading, setCourierLoading] = useState<Record<string, string>>({});
  const {
    value: q,
    setValue: setQ,
    debouncedValue: searchQuery,
  } = useDebouncedSearch("");

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
      setError(null);
      try {
        const r = await api.listOrdersAdmin(
          {
            from: range.from,
            to: range.to,
            status,
            source,
            q: searchQuery,
            page,
            limit: PAGE_SIZE,
          },
          token,
        );
        if (cancelled) return;
        setItems(r.items);
        setSelectedIds([]);
        setTotal(r.total);
        setTotalPages(Math.max(1, r.totalPages));
      } catch (err) {
        const status = (err as Error & { status?: number })?.status;
        if (status === 401 || status === 403) {
          clearAdminToken();
          router.replace("/admin");
          return;
        }
        if (!cancelled) {
          setError((err as Error).message);
          setItems([]);
          setTotal(0);
          setTotalPages(1);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, status, source, searchQuery, page, router]);

  const selectableOrders = items.filter((order) => !order.courier);
  const allSelectableChecked =
    selectableOrders.length > 0 &&
    selectableOrders.every((order) => selectedIds.includes(order._id));

  function toggleSelected(orderId: string) {
    setSelectedIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId],
    );
  }

  async function sendToSteadfast(order: Order) {
    const token = getAdminToken();
    if (!token || order.courier) return;
    setCourierLoading((prev) => ({ ...prev, [order._id]: "send" }));
    setNotice(null);
    try {
      const result = await api.sendOrderToSteadfast(order._id, token);
      setItems((prev) =>
        prev.map((item) => (item._id === order._id ? result.order : item)),
      );
      setSelectedIds((prev) => prev.filter((id) => id !== order._id));
      setNotice(`Order ${order.orderNumber} sent to Steadfast.`);
    } catch (err) {
      setNotice(`Could not send ${order.orderNumber}: ${(err as Error).message}`);
    } finally {
      setCourierLoading((prev) => {
        const next = { ...prev };
        delete next[order._id];
        return next;
      });
    }
  }

  async function syncCourierStatus(order: Order) {
    const token = getAdminToken();
    if (!token || !order.courier) return;
    setCourierLoading((prev) => ({ ...prev, [order._id]: "sync" }));
    setNotice(null);
    try {
      const result = await api.syncCourierStatus(order._id, token);
      const syncedStatus = getStatusFromResponse(result.item);
      setItems((prev) =>
        prev.map((item) =>
          item._id === order._id
            ? {
                ...item,
                courier: {
                  ...item.courier,
                  status: syncedStatus ?? item.courier?.status,
                  response: result.item,
                  updatedAt: new Date().toISOString(),
                },
              }
            : item,
        ),
      );
      setNotice(`Courier status synced for ${order.orderNumber}.`);
    } catch (err) {
      setNotice(`Could not sync ${order.orderNumber}: ${(err as Error).message}`);
    } finally {
      setCourierLoading((prev) => {
        const next = { ...prev };
        delete next[order._id];
        return next;
      });
    }
  }

  async function sendSelectedToSteadfast() {
    const token = getAdminToken();
    if (!token || selectedIds.length === 0) return;
    const selected = items.filter((order) => selectedIds.includes(order._id));
    const sendable = selected.filter(
      (order) => !order.courier,
    );
    let successful = 0;
    let failed = 0;
    const skipped = selected.length - sendable.length;
    setCourierLoading((prev) => ({
      ...prev,
      bulk: "send",
      ...Object.fromEntries(sendable.map((order) => [order._id, "send"])),
    }));
    setNotice(null);
    for (const order of sendable) {
      try {
        const result = await api.sendOrderToSteadfast(order._id, token);
        successful += 1;
        setItems((prev) =>
          prev.map((item) => (item._id === order._id ? result.order : item)),
        );
      } catch {
        failed += 1;
      }
    }
    setSelectedIds([]);
    setCourierLoading({});
    setNotice(
      `Steadfast bulk send: ${successful} successful, ${failed} failed, ${skipped} skipped.`,
    );
  }

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
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="secondary"
              disabled={selectedIds.length === 0 || Boolean(courierLoading.bulk)}
              onClick={sendSelectedToSteadfast}
            >
              {courierLoading.bulk ? "Sending..." : "Send selected to Steadfast"}
            </Button>
            <LinkButton href="/admin/orders/new">+ Custom order</LinkButton>
          </div>
        </div>
        <div className="mt-5">
          <DateRangePicker
            value={range}
            onChange={(nextRange) => {
              setPage(1);
              setRange(nextRange);
            }}
          />
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Select
            className="!w-full sm:!w-auto"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            className="!w-full sm:!w-auto"
            value={source}
            onChange={(e) => {
              setPage(1);
              setSource(e.target.value);
            }}
          >
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Input
            className="!w-full sm:!w-64"
            placeholder="Search order #, name, phone…"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
        </div>
        {notice && (
          <div className="mt-3 rounded-lg border border-line bg-white px-4 py-3 text-sm text-fg-soft">
            {notice}
          </div>
        )}
      </header>

      <Card tone="soft" padding="none" className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-sm text-fg-muted">Loading…</div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-600">
            Could not load orders.
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-fg-muted">
            No orders match these filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full text-sm">
              <thead className="bg-white text-left text-xs text-fg-soft">
                <tr>
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allSelectableChecked}
                      disabled={selectableOrders.length === 0}
                      onChange={(e) =>
                        setSelectedIds(
                          e.target.checked
                            ? selectableOrders.map((order) => order._id)
                            : [],
                        )
                      }
                      aria-label="Select all unsent orders"
                    />
                  </th>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Courier</th>
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
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(o._id)}
                        disabled={Boolean(o.courier)}
                        onChange={() => toggleSelected(o._id)}
                        aria-label={`Select order ${o.orderNumber}`}
                      />
                    </td>
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
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest",
                            o.courier
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-bg-soft text-fg-muted",
                          )}
                        >
                          {o.courier ? getCourierStatusText(o.courier) : "Not sent"}
                        </span>
                        {o.courier?.trackingCode && (
                          <div className="font-mono text-[11px] text-fg-muted">
                            {o.courier.trackingCode}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-fg-soft">
                      {formatDateTime(o.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={
                            Boolean(o.courier) ||
                            Boolean(courierLoading[o._id])
                          }
                          onClick={() => sendToSteadfast(o)}
                        >
                          {courierLoading[o._id] === "send"
                            ? "Sending..."
                            : "Send to Steadfast"}
                        </Button>
                        {o.courier && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={Boolean(courierLoading[o._id])}
                            onClick={() => syncCourierStatus(o)}
                          >
                            {courierLoading[o._id] === "sync" ? "Syncing..." : "Sync"}
                          </Button>
                        )}
                        {getCourierTrackUrl(o.courier?.trackingCode) && (
                          <a
                            href={getCourierTrackUrl(o.courier?.trackingCode) ?? "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-9 items-center rounded-lg border border-black/10 px-3 text-xs font-semibold hover:bg-neutral-100"
                          >
                            Track
                          </a>
                        )}
                        <Link
                          href={`/admin/orders/${o._id}`}
                          className="inline-flex h-9 items-center rounded-lg border border-black/10 px-3 text-xs font-semibold text-blue-600 hover:bg-neutral-100"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!loading && !error && totalPages > 1 && (
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
    </div>
  );
}
