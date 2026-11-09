"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Clock, Package } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { clearAdminToken, getAdminToken } from "@/lib/admin-token";
import { getCourierStatusText, getCourierTrackUrl } from "@/lib/courier";
import {
  formatBDT,
  formatDateTime,
  formatRelativeTime,
  formatSmartDateTime,
} from "@/lib/format";
import {
  useDebouncedSearch,
  usePersistentFilters,
  useScrollRestoration,
} from "@/lib/hooks";
import {
  ORDER_SORT_OPTIONS,
  ORDER_STOCK_OPTIONS,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  TERMINAL_ORDER_STATUSES,
} from "@/types/shared";
import {
  DateRangePicker,
  isPresetKey,
  presetRange,
  type DateRange,
} from "@/components/admin/DateRangePicker";
import { FilterTabs } from "@/components/admin/FilterTabs";
import type {
  Order,
  OrderListSort,
  OrderStatusTone,
  OrderStockFilter,
  Product,
} from "@/types/shared";
import { Button, Card, Input, LinkButton, Select } from "@/components/ui";
import { cn } from "@/lib/cn";

// Built from the shared status list so a new status shows up in the filter
// automatically instead of needing a second edit here.
const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  ...ORDER_STATUSES.map((value) => ({
    value,
    label: ORDER_STATUS_LABELS[value],
  })),
];

/**
 * When the order last moved status, shown under the status control so a row
 * answers "when was this set, and how long has it been sitting here?" without
 * being opened.
 *
 * The clock icon is what separates this from the Placed column next to it. An
 * order that has never been moved says so outright rather than rendering
 * nothing — an empty cell reads as a broken feature, and it must not pass the
 * order's creation time off as a status change.
 */
function StatusChangedAt({ order }: { order: Order }) {
  const at = order.statusChangedAt;
  if (!at) {
    return (
      <span
        className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] text-fg-muted"
        title={`This order has not moved since it was placed on ${formatDateTime(
          order.createdAt,
        )}.`}
      >
        <Clock size={11} className="shrink-0 opacity-60" />
        not changed yet
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-fg-soft"
      title={`Status changed ${formatDateTime(at)} · ${formatRelativeTime(at)}`}
    >
      <Clock size={11} className="shrink-0 opacity-60" />
      {formatSmartDateTime(at)}
    </span>
  );
}

const SOURCE_OPTIONS = [
  { value: "all", label: "All sources" },
  { value: "storefront", label: "Storefront" },
  { value: "manual", label: "Manual / custom" },
];

// Colour the inline status control so the column can be scanned without
// reading every label.
const STATUS_SELECT_TONES: Record<OrderStatusTone, string> = {
  neutral: "!border-line !bg-bg-soft !text-fg-soft",
  success: "!border-emerald-200 !bg-emerald-50 !text-emerald-700",
  warning: "!border-amber-200 !bg-amber-50 !text-amber-700",
  info: "!border-sky-200 !bg-sky-50 !text-sky-700",
  danger: "!border-red-200 !bg-red-50 !text-red-700",
  accent: "!border-violet-200 !bg-violet-50 !text-violet-700",
};

const PAGE_SIZE = 30;
// The products endpoint caps a page at 100, so the product filter walks pages.
// This bounds that walk on a very large catalogue.
const PRODUCT_FILTER_MAX_PAGES = 10;

const FILTERS_STORAGE_KEY = "gk:admin:orders:filters";

// Flat and JSON-safe so it can round-trip through localStorage. The date range
// is stored as the preset it came from — re-deriving it on load keeps "Today"
// meaning today rather than the day the filter was set. rangeFrom / rangeTo
// only matter for a custom range.
const DEFAULT_FILTERS = {
  rangeKey: "all",
  rangeFrom: "",
  rangeTo: "",
  status: "all",
  source: "all",
  productId: "all",
  readyStock: "all" as OrderStockFilter,
  sort: "newest" as OrderListSort,
};

export default function AdminOrdersPage() {
  const {
    filters,
    patchFilters,
    resetFilters,
    hydrated: filtersReady,
  } = usePersistentFilters(FILTERS_STORAGE_KEY, DEFAULT_FILTERS);
  const { status, source, productId, readyStock, sort } = filters;
  const range = useMemo<DateRange>(() => {
    if (filters.rangeKey === "custom" && filters.rangeFrom && filters.rangeTo) {
      return {
        from: filters.rangeFrom,
        to: filters.rangeTo,
        label: "Custom",
        key: "custom",
      };
    }
    // A preset that no longer exists falls back to the default rather than to
    // whichever preset happens to be first in the picker.
    return presetRange(
      isPresetKey(filters.rangeKey) ? filters.rangeKey : DEFAULT_FILTERS.rangeKey,
    );
  }, [filters.rangeKey, filters.rangeFrom, filters.rangeTo]);
  const setRange = (next: DateRange) =>
    patchFilters({ rangeKey: next.key, rangeFrom: next.from, rangeTo: next.to });
  const [items, setItems] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [totalPages, setTotalPages] = useState(1);
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [courierLoading, setCourierLoading] = useState<Record<string, string>>({});
  const [statusSaving, setStatusSaving] = useState<Record<string, boolean>>({});
  const {
    value: q,
    setValue: setQ,
    debouncedValue: searchQuery,
  } = useDebouncedSearch("");

  const router = useRouter();

  useEffect(() => {
    // Hold the first fetch until the saved filters are in: firing now would
    // load the defaults and then immediately throw that page away.
    if (!filtersReady) return;
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
            productId,
            readyStock,
            sort,
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
        setStatusCounts(r.statusCounts ?? {});
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
          setStatusCounts({});
          setTotalPages(1);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    filtersReady,
    range.from,
    range.to,
    status,
    source,
    productId,
    readyStock,
    sort,
    searchQuery,
    page,
    router,
  ]);

  // Catalogue for the product filter. Fetched once — it changes far more slowly
  // than the order list, and a failure here only costs the filter.
  useEffect(() => {
    let cancelled = false;
    const token = getAdminToken();
    if (!token) return;
    void (async () => {
      try {
        const collected: Product[] = [];
        for (let p = 1; p <= PRODUCT_FILTER_MAX_PAGES; p += 1) {
          const r = await api.listProductsAdmin({ page: p, limit: 100 }, token);
          collected.push(...r.items);
          if (p >= r.totalPages) break;
        }
        if (!cancelled) {
          setProducts(collected.sort((a, b) => a.title.localeCompare(b.title)));
        }
      } catch {
        // Leaving the list empty hides the filter; the page still works.
        if (!cancelled) setProducts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Coming back from an order should land where the list was left, not at the
  // top. Keyed by the current query so an offset is never re-applied to a
  // different set of rows.
  useScrollRestoration(
    `admin-orders:${range.from}:${range.to}:${status}:${source}:${productId}:${readyStock}:${sort}:${searchQuery}:${page}`,
    !loading && items.length > 0,
  );

  const filtersActive =
    range.key !== "all" ||
    status !== "all" ||
    source !== "all" ||
    productId !== "all" ||
    readyStock !== "all" ||
    sort !== "newest" ||
    q !== "";

  function clearFilters() {
    setPage(1);
    resetFilters();
    setQ("");
  }

  // The status strip, with the orders behind each chip. Counts come from the
  // list response and ignore the status filter itself, so a chip says how many
  // orders it would show rather than how many are on screen now.
  const statusTabs = useMemo(
    () =>
      STATUS_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        count: statusCounts[option.value],
      })),
    [statusCounts],
  );

  const selectableOrders = items.filter((order) => !order.courier);
  // "Sync all" covers the orders on this page that are actually in flight:
  // they're with the courier and haven't reached a terminal status yet.
  const syncableOrders = items.filter(
    (order) => order.courier && !TERMINAL_ORDER_STATUSES.includes(order.status),
  );
  const allSelectableChecked =
    selectableOrders.length > 0 &&
    selectableOrders.every((order) => selectedIds.includes(order._id));

  // Row range for the footer, so "page 2 of 9" also says which orders these are.
  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = total === 0 ? 0 : firstRow + items.length - 1;

  const pageTotal = useMemo(
    () => items.reduce((sum, order) => sum + order.total, 0),
    [items],
  );

  function toggleSelected(orderId: string) {
    setSelectedIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId],
    );
  }

  async function changeStatus(order: Order, nextStatus: Order["status"]) {
    const token = getAdminToken();
    if (!token || nextStatus === order.status) return;
    setStatusSaving((prev) => ({ ...prev, [order._id]: true }));
    setNotice(null);
    try {
      const r = await api.updateOrder(order._id, { status: nextStatus }, token);
      setItems((prev) => prev.map((x) => (x._id === order._id ? r.order : x)));
    } catch (err) {
      // Without this a failed save silently snapped the select back and there
      // was no way to tell it apart from a saved one.
      setNotice(
        `Could not update ${order.orderNumber}: ${(err as Error).message}`,
      );
    } finally {
      setStatusSaving((prev) => {
        const next = { ...prev };
        delete next[order._id];
        return next;
      });
    }
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
      // The server persists the sync (including the auto "delivered" flip), so
      // adopt the saved order rather than patching local state.
      const result = await api.syncCourierStatus(order._id, token);
      setItems((prev) =>
        prev.map((item) => (item._id === order._id ? result.order : item)),
      );
      setNotice(
        `Courier status synced for ${order.orderNumber}${
          result.deliveryStatus ? `: ${result.deliveryStatus}` : ""
        }.`,
      );
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

  async function syncAllCourierStatuses() {
    const token = getAdminToken();
    if (!token || syncableOrders.length === 0) return;
    setCourierLoading((prev) => ({
      ...prev,
      bulk: "sync",
      ...Object.fromEntries(syncableOrders.map((order) => [order._id, "sync"])),
    }));
    setNotice(null);
    try {
      const result = await api.bulkSyncCourierStatus(
        syncableOrders.map((order) => order._id),
        token,
      );
      const byId = new Map(result.orders.map((order) => [order._id, order]));
      setItems((prev) => prev.map((item) => byId.get(item._id) ?? item));
      const nowDelivered = result.orders.filter(
        (order) =>
          order.status === "delivered" &&
          syncableOrders.find((prev) => prev._id === order._id)?.status !== "delivered",
      ).length;
      setNotice(
        `Synced ${result.successful} of ${syncableOrders.length} orders` +
          (result.failed > 0 ? `, ${result.failed} failed` : "") +
          (nowDelivered > 0 ? `. ${nowDelivered} marked delivered` : "") +
          ".",
      );
    } catch (err) {
      setNotice(`Could not sync courier statuses: ${(err as Error).message}`);
    } finally {
      setCourierLoading({});
    }
  }

  async function sendSelectedToSteadfast() {
    const token = getAdminToken();
    if (!token || selectedIds.length === 0) return;
    const selected = items.filter((order) => selectedIds.includes(order._id));
    const sendable = selected.filter((order) => !order.courier);
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
      <header className="mb-4 sm:mb-6">
        {/* Decorative on a phone, where vertical space is the scarce thing. */}
        <span className="hidden text-xs font-medium uppercase tracking-[0.18em] text-fg-soft sm:block">
          Admin
        </span>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:mt-2 sm:gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-3xl">
              Orders
            </h1>
            <p className="text-xs text-fg-soft sm:mt-1 sm:text-sm">
              {total} orders in {range.label.toLowerCase()}
              {filtersActive && " matching these filters"}
            </p>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>
          {/* Three across on a phone instead of two rows. Buttons run at the
              small size there and step up to the default from sm. */}
          <div className="grid w-full grid-cols-3 gap-1.5 sm:flex sm:w-auto sm:flex-row sm:gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="!px-2 sm:!h-11 sm:!px-6 sm:!text-sm"
              disabled={syncableOrders.length === 0 || Boolean(courierLoading.bulk)}
              title={
                syncableOrders.length === 0
                  ? "No in-flight courier orders on this page"
                  : `Sync ${syncableOrders.length} courier order(s) on this page`
              }
              onClick={syncAllCourierStatuses}
            >
              {courierLoading.bulk === "sync" ? (
                "Syncing..."
              ) : (
                <>
                  <span className="sm:hidden">Sync ({syncableOrders.length})</span>
                  <span className="hidden sm:inline">
                    Sync all ({syncableOrders.length})
                  </span>
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="!px-2 sm:!h-11 sm:!px-6 sm:!text-sm"
              disabled={selectedIds.length === 0 || Boolean(courierLoading.bulk)}
              onClick={sendSelectedToSteadfast}
            >
              {courierLoading.bulk === "send" ? (
                "Sending..."
              ) : (
                <>
                  <span className="sm:hidden">
                    Send
                    {selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
                  </span>
                  <span className="hidden sm:inline">
                    {selectedIds.length > 0
                      ? `Send ${selectedIds.length} to Steadfast`
                      : "Send selected to Steadfast"}
                  </span>
                </>
              )}
            </Button>
            <LinkButton
              size="sm"
              href="/admin/orders/new"
              className="!px-2 sm:!h-11 sm:!px-6 sm:!text-sm"
            >
              <span className="sm:hidden">+ Order</span>
              <span className="hidden sm:inline">+ Custom order</span>
            </LinkButton>
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
        {/* Status is a tab strip at every width, not just on a phone: it is the
            filter used constantly, the chips carry their counts without being
            opened, and moving between two statuses is one click. */}
        <FilterTabs
          className="mt-3"
          label="Filter by status"
          options={statusTabs}
          value={status}
          onChange={(next) => {
            setPage(1);
            patchFilters({ status: next });
          }}
        />

        {/* The rest of the phone filters. Source / Product are dropped entirely —
            they are desk work and each cost a full row on a 390px screen. */}
        <div className="mt-2 md:hidden">
          <Input
            className="!w-full !py-2 !text-sm"
            placeholder="Search order #, name, phone…"
            aria-label="Search orders"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Select
              className="!w-full !py-2 !text-xs"
              aria-label="Filter by ready stock"
              value={readyStock}
              onChange={(e) => {
                setPage(1);
                patchFilters({
                  readyStock: e.target.value as OrderStockFilter,
                });
              }}
            >
              {ORDER_STOCK_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select
              className="!w-full !py-2 !text-xs"
              aria-label="Sort orders"
              value={sort}
              onChange={(e) => {
                setPage(1);
                patchFilters({ sort: e.target.value as OrderListSort });
              }}
            >
              {ORDER_SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          {/* Only when there is something to reset: on a phone an always-on
              disabled button costs a row for nothing. */}
          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 !w-full"
              onClick={clearFilters}
            >
              Reset filters
            </Button>
          )}
        </div>

        {/* Desktop filters: everything except status, which has its own strip. */}
        <div className="mt-2 hidden flex-wrap items-center gap-3 md:flex">
          <Select
            className="!w-auto"
            aria-label="Filter by source"
            value={source}
            onChange={(e) => {
              setPage(1);
              patchFilters({ source: e.target.value });
            }}
          >
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          {products.length > 0 && (
            <Select
              className="!w-56"
              aria-label="Filter by product"
              value={productId}
              onChange={(e) => {
                setPage(1);
                patchFilters({ productId: e.target.value });
              }}
            >
              <option value="all">All products</option>
              {products.map((product) => (
                <option key={product._id} value={product._id}>
                  {product.title}
                </option>
              ))}
            </Select>
          )}
          <Select
            className="!w-auto"
            aria-label="Filter by ready stock"
            value={readyStock}
            onChange={(e) => {
              setPage(1);
              patchFilters({ readyStock: e.target.value as OrderStockFilter });
            }}
          >
            {ORDER_STOCK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            className="!w-auto"
            aria-label="Sort orders"
            value={sort}
            onChange={(e) => {
              setPage(1);
              patchFilters({ sort: e.target.value as OrderListSort });
            }}
          >
            {ORDER_SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Input
            className="!w-64"
            placeholder="Search order #, name, phone…"
            aria-label="Search orders"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            disabled={!filtersActive}
            title={
              filtersActive
                ? "Clear every filter and go back to all time"
                : "No filters applied"
            }
            onClick={clearFilters}
          >
            Reset filters
          </Button>
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
            <p>No orders match these filters.</p>
            {filtersActive && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={clearFilters}
              >
                Reset filters
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* A ten-column table cannot survive a 390px screen, so below md
                each order becomes a card carrying the same controls. */}
            <ul className="divide-y divide-line md:hidden">
              {items.map((o) => {
                const units = o.items.reduce((n, l) => n + l.quantity, 0);
                const thumb = o.items.find((l) => l.image)?.image;
                return (
                  <li key={o._id} className="bg-white p-3">
                    <div className="flex gap-2.5">
                      <input
                        type="checkbox"
                        className="mt-1 shrink-0"
                        checked={selectedIds.includes(o._id)}
                        disabled={Boolean(o.courier)}
                        onChange={() => toggleSelected(o._id)}
                        aria-label={`Select order ${o.orderNumber}`}
                      />
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-bg-soft">
                        {thumb ? (
                          <Image
                            src={thumb}
                            alt=""
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-fg-muted">
                            <Package size={18} />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 truncate text-sm font-medium">
                            {o.items[0]?.title ?? "—"}
                          </p>
                          <p className="shrink-0 text-sm font-semibold">
                            {formatBDT(o.total)}
                          </p>
                        </div>
                        <p className="truncate text-[11px] text-fg-muted">
                          {o.items.length > 1 && `+${o.items.length - 1} more · `}
                          {units} {units === 1 ? "unit" : "units"}
                          {" · "}
                          {o.orderNumber}
                        </p>
                        <p className="mt-0.5 truncate text-xs">
                          <span className="font-medium">{o.customer.name}</span>
                          {" · "}
                          <a
                            href={`tel:${o.customer.phone}`}
                            className="text-fg-muted underline underline-offset-2"
                          >
                            {o.customer.phone}
                          </a>
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Select
                        className={cn(
                          "!w-auto !py-1 !text-xs font-medium",
                          STATUS_SELECT_TONES[ORDER_STATUS_TONES[o.status]],
                        )}
                        aria-label={`Status for order ${o.orderNumber}`}
                        disabled={Boolean(statusSaving[o._id])}
                        value={o.status}
                        onChange={(e) =>
                          changeStatus(o, e.target.value as Order["status"])
                        }
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {ORDER_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </Select>
                      <StatusChangedAt order={o} />
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
                      {o.source === "manual" && (
                        <span className="rounded-full bg-black px-2 py-0.5 text-[10px] uppercase tracking-widest text-white">
                          manual
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="shrink-0 text-[11px] text-fg-muted">
                        {formatDateTime(o.createdAt)}
                      </span>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="!px-2.5 !text-xs"
                          disabled={
                            Boolean(o.courier) || Boolean(courierLoading[o._id])
                          }
                          onClick={() => sendToSteadfast(o)}
                        >
                          {courierLoading[o._id] === "send"
                            ? "Sending..."
                            : "Steadfast"}
                        </Button>
                        {o.courier && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="!px-2.5 !text-xs"
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
                            className="inline-flex h-8 items-center rounded-lg border border-black/10 px-2.5 text-xs font-semibold"
                          >
                            Track
                          </a>
                        )}
                        <Link
                          href={`/admin/orders/${o._id}`}
                          className="inline-flex h-8 items-center rounded-lg border border-black/10 px-2.5 text-xs font-semibold text-blue-600"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="hidden overflow-x-auto md:block">
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
                {items.map((o) => {
                  const units = o.items.reduce((n, l) => n + l.quantity, 0);
                  const allTitles = o.items
                    .map((line) => `${line.quantity} x ${line.title}`)
                    .join("\n");
                  return (
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
                      {/* What was ordered, not just how many lines — the bare
                          count forced a click into every order. */}
                      <td className="px-4 py-3">
                        <div
                          className="flex max-w-[240px] items-center gap-2"
                          title={allTitles}
                        >
                          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-bg-soft">
                            {o.items.find((l) => l.image)?.image ? (
                              <Image
                                src={o.items.find((l) => l.image)!.image!}
                                alt=""
                                fill
                                sizes="36px"
                                className="object-cover"
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-fg-muted">
                                <Package size={14} />
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {o.items[0]?.title ?? "—"}
                            </div>
                            <div className="text-xs text-fg-muted">
                              {o.items.length > 1 &&
                                `+${o.items.length - 1} more · `}
                              {units} {units === 1 ? "unit" : "units"}
                            </div>
                          </div>
                        </div>
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
                          className={cn(
                            "!w-auto !py-1 !text-xs font-medium",
                            STATUS_SELECT_TONES[ORDER_STATUS_TONES[o.status]],
                          )}
                          aria-label={`Status for order ${o.orderNumber}`}
                          disabled={Boolean(statusSaving[o._id])}
                          value={o.status}
                          onChange={(e) =>
                            changeStatus(o, e.target.value as Order["status"])
                          }
                        >
                          {ORDER_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {ORDER_STATUS_LABELS[s]}
                            </option>
                          ))}
                        </Select>
                        <div className="mt-1">
                          <StatusChangedAt order={o} />
                        </div>
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
                              Boolean(o.courier) || Boolean(courierLoading[o._id])
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
                  );
                })}
              </tbody>
            </table>
            </div>
          </>
        )}
      </Card>

      {!loading && !error && items.length > 0 && (
        <div className="mt-4 flex flex-col gap-3 text-sm text-fg-soft sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {firstRow}–{lastRow} of {total}
            <span className="text-fg-muted">
              {" · "}
              {formatBDT(pageTotal)} on this page
            </span>
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-fg-muted">
                Page {page} of {totalPages}
              </span>
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
          )}
        </div>
      )}
    </div>
  );
}
