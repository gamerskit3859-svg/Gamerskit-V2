"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  formatCourierStatus,
  getCourierStatusText,
  getCourierTrackUrl,
} from "@/lib/courier";
import { formatBDT, formatDateTime } from "@/lib/format";
import type { Order, OrderStatus } from "@/types/shared";
import { Button, LinkButton, Card, Section, Input } from "@/components/ui";
import { cn } from "@/lib/cn";

// Two rails, not five: the in-between stages are the courier's, and the live
// courier status is shown underneath rather than guessed at from order status.
const STATUSES: Array<{ key: OrderStatus; label: string }> = [
  { key: "confirmed", label: "Confirmed" },
  { key: "delivered", label: "Delivered" },
];

/**
 * The call-centre statuses are steps inside confirmation rather than stages of
 * their own, so they sit on the timeline at the point they really represent
 * instead of leaving it blank.
 */
const TIMELINE_ALIASES: Partial<Record<OrderStatus, OrderStatus>> = {
  called_confirmed: "confirmed",
  called_no_answer: "confirmed",
  waiting_stock: "confirmed",
  exchange: "confirmed",
};

/** Orders that stopped before delivery: the progress rail does not apply. */
const CLOSED_STATUSES: OrderStatus[] = ["cancelled", "refunded", "returned"];

const STATUS_LABELS: Record<OrderStatus, string> = {
  confirmed: "Confirmed",
  called_confirmed: "Confirmed by phone",
  called_no_answer: "Awaiting your confirmation",
  waiting_stock: "Waiting on stock",
  exchange: "Exchange on the way",
  delivered: "Delivered",
  returned: "Returned",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const CLOSED_MESSAGES: Partial<Record<OrderStatus, string>> = {
  cancelled: "This order was cancelled, so it was never handed to the courier.",
  refunded: "This order was refunded.",
  returned: "This parcel came back to us instead of being delivered.",
};

function statusPillColor(status: OrderStatus) {
  if (status === "delivered") return "bg-emerald-100 text-emerald-700";
  if (CLOSED_STATUSES.includes(status)) return "bg-red-100 text-red-700";
  return "bg-sky-100 text-sky-700";
}

export default function TrackPage() {
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncingCourier, setSyncingCourier] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  // Every lookup gets a number so a slow courier refresh from an earlier
  // search can never overwrite the results of a later one.
  const searchIdRef = useRef(0);

  /**
   * Ask the courier for the current state of each dispatched parcel. Orders
   * only carry the status an admin last synced, which can be days old, so the
   * page refreshes them itself once the customer has found their orders.
   */
  async function refreshCourierStatuses(
    found: Order[],
    lookup: string,
    searchId: number,
  ) {
    const dispatched = found.filter((order) => order.courier);
    if (dispatched.length === 0) return;

    setSyncingCourier(true);
    const results = await Promise.allSettled(
      dispatched.map((order) =>
        api.refreshCourierStatus({ q: lookup, orderNumber: order.orderNumber }),
      ),
    );
    if (searchIdRef.current !== searchId) return;

    const updated = new Map<string, Order>();
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.order) {
        updated.set(result.value.order.orderNumber, result.value.order);
      }
    }
    if (updated.size > 0) {
      setOrders((prev) =>
        prev.map((order) => updated.get(order.orderNumber) ?? order),
      );
    }
    setSyncingCourier(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const lookup = query.trim();

    if (!lookup) {
      setError(null);
      setEmptyMessage(
        "Enter your phone number, order number or courier tracking code to start tracking.",
      );
      setSearched(false);
      setOrders([]);
      return;
    }

    const searchId = searchIdRef.current + 1;
    searchIdRef.current = searchId;
    setLoading(true);
    setSyncingCourier(false);
    setError(null);
    setEmptyMessage(null);
    setSearched(true);

    try {
      const result = await api.trackOrders(lookup);
      if (searchIdRef.current !== searchId) return;
      setOrders(result.orders);
      void refreshCourierStatuses(result.orders, lookup, searchId);
    } catch (err) {
      if (searchIdRef.current !== searchId) return;
      const status = (err as { status?: number }).status;
      if (status === 404 || status === 400) {
        setEmptyMessage(
          "No order found. Check your phone number, order number or tracking code and try again.",
        );
      } else {
        setError(
          "We could not search orders right now. Please try again in a moment.",
        );
      }
      setOrders([]);
    } finally {
      if (searchIdRef.current === searchId) setLoading(false);
    }
  }

  function resetSearch() {
    searchIdRef.current += 1;
    setQuery("");
    setOrders([]);
    setError(null);
    setEmptyMessage(null);
    setSearched(false);
    setSyncingCourier(false);
  }

  return (
    <Section width="narrow" spacing="lg" className="!max-w-4xl">
      <div className="mb-12 text-center">
        <span className="block text-xs font-medium uppercase tracking-[0.18em] text-fg-soft">
          Tracking
        </span>
        <h1 className="mt-2 text-[clamp(36px,5vw,64px)] leading-[1.06] tracking-[-0.035em] font-semibold">
          Find your order.
        </h1>
        <p className="mt-3 text-fg-soft">
          Use your phone number, an order number or the courier tracking code
          from your parcel.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto mb-12 max-w-md">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="search"
            inputMode="search"
            autoComplete="off"
            placeholder="01XXXXXXXXX, GK-… or tracking code"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Phone number, order number or courier tracking code"
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={loading || !query.trim()}
            className="w-full sm:w-auto"
          >
            {loading ? "Searching..." : "Find Orders"}
          </Button>
        </div>
        <p className="mt-2 text-center text-xs text-fg-muted sm:text-left">
          A phone number finds every order placed with it. An order number or
          tracking code finds just that parcel.
        </p>
      </form>

      {error && (
        <div className="mx-auto mb-8 max-w-md rounded-lg border border-red-200 bg-red-50 p-4 text-center text-red-700">
          {error}
        </div>
      )}

      {(emptyMessage || (searched && !loading && orders.length === 0 && !error)) && (
        <div className="mx-auto mb-8 max-w-md rounded-lg border border-amber-200 bg-amber-50 p-4 text-center text-amber-700">
          {emptyMessage ??
            "No order found. Check your phone number, order number or tracking code and try again."}
        </div>
      )}

      {orders.length > 0 && (
        <div className="space-y-6">
          <div className="mb-8 text-center">
            <h2 className="text-xl font-semibold">
              Found {orders.length} order{orders.length !== 1 ? "s" : ""}
            </h2>
            <button
              type="button"
              onClick={resetSearch}
              className="mt-2 text-sm text-fg-soft underline hover:text-foreground"
            >
              Search for something else
            </button>
          </div>

          {orders.map((order) => (
            <Card key={order._id} tone="soft">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="break-words text-lg font-semibold">
                    Order {order.orderNumber}
                  </h3>
                  <p className="mt-1 text-sm text-fg-soft">
                    Placed on {formatDateTime(order.createdAt)}
                  </p>
                  <p className="text-sm text-fg-soft">
                    Customer: {order.customer.name}
                  </p>
                </div>
                <div className="sm:text-right">
                  <div className="font-semibold">{formatBDT(order.total)}</div>
                  <div
                    className={cn(
                      "mt-1 rounded-full px-2 py-1 text-sm",
                      statusPillColor(order.status),
                    )}
                  >
                    {STATUS_LABELS[order.status] ?? order.status}
                  </div>
                </div>
              </div>

              {/* Status timeline */}
              <StatusTimeline status={order.status} />

              <CourierPanel order={order} syncing={syncingCourier} />

              {/* Order items summary */}
              <div className="border-t border-line pt-4">
                <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-fg-soft">
                    {order.items.length} item
                    {order.items.length !== 1 ? "s" : ""}
                  </span>
                  <Link
                    href={`/order/${order.orderNumber}`}
                    className="font-medium text-black hover:underline"
                  >
                    View details →
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-12 text-center">
        <LinkButton href="/shop" variant="ghost">
          Continue shopping
        </LinkButton>
      </div>
    </Section>
  );
}

function CourierPanel({ order, syncing }: { order: Order; syncing: boolean }) {
  const courier = order.courier;
  const trackUrl = getCourierTrackUrl(courier?.trackingCode);
  // An order is with the courier once a consignment exists, whether or not
  // Steadfast handed back a tracking code for the public tracking page.
  const dispatched = Boolean(
    courier?.consignmentId || courier?.trackingCode || courier?.invoice,
  );
  const closedMessage = CLOSED_MESSAGES[order.status];

  let detail: string;
  if (dispatched) {
    detail = `Steadfast · ${formatCourierStatus(getCourierStatusText(courier))}`;
  } else if (closedMessage) {
    detail = closedMessage;
  } else {
    detail =
      "Your parcel has not reached the courier yet. Tracking appears here as soon as it is handed over.";
  }

  return (
    <div className="mb-4 rounded-lg border border-line bg-white p-4 text-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h4 className="font-semibold">Delivery Tracking</h4>
          <p className="mt-1 text-fg-soft">{detail}</p>
          {dispatched && courier?.trackingCode && (
            <p className="mt-1 font-mono text-xs text-fg-muted">
              {courier.trackingCode}
            </p>
          )}
          {dispatched && (
            <p className="mt-1 text-xs text-fg-muted">
              {syncing
                ? "Checking with the courier…"
                : courier?.updatedAt
                  ? `Updated ${formatDateTime(courier.updatedAt)}`
                  : "Waiting for the first courier update"}
            </p>
          )}
        </div>
        {trackUrl && (
          <a
            href={trackUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-black/10 px-4 text-xs font-semibold hover:bg-neutral-100"
          >
            Track Delivery
          </a>
        )}
      </div>
    </div>
  );
}

function StatusTimeline({ status }: { status: OrderStatus }) {
  // A cancelled, refunded or returned order never walks the rest of the rail,
  // and drawing five empty steps for it reads as a broken timeline.
  if (CLOSED_STATUSES.includes(status)) {
    return (
      <div className="mb-4 rounded-lg border border-line bg-white px-4 py-3 text-sm">
        <span className="font-medium">{STATUS_LABELS[status]}</span>
        <span className="text-fg-soft">
          {" "}
          · {CLOSED_MESSAGES[status] ?? "This order is closed."}
        </span>
      </div>
    );
  }

  const timelineStatus = TIMELINE_ALIASES[status] ?? status;
  const currentIndex = STATUSES.findIndex((s) => s.key === timelineStatus);

  return (
    <div className="mb-4 overflow-x-auto pb-1">
      <div className="flex min-w-[520px] items-center gap-2 text-sm">
        {STATUSES.map((s, i) => {
          const isCompleted = i <= currentIndex;
          const isCurrent = i === currentIndex;

          return (
            <div key={s.key} className="flex items-center">
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  isCompleted ? "bg-black" : "bg-gray-300",
                  isCurrent && "ring-2 ring-offset-1 ring-black",
                )}
              />
              {i < STATUSES.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 w-8",
                    isCompleted ? "bg-black" : "bg-gray-300",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex min-w-[520px] justify-between text-xs text-fg-soft">
        {STATUSES.map((s) => (
          <span key={s.key}>{s.label}</span>
        ))}
      </div>
      {status === "called_no_answer" && (
        <p className="mt-2 text-xs text-amber-700">
          We tried to reach you to confirm this order. Please expect another
          call, or contact us to confirm it.
        </p>
      )}
      {status === "waiting_stock" && (
        <p className="mt-2 text-xs text-amber-700">
          One of the items in this order is out of stock. It ships as soon as we
          have it back in — we will call you if that is going to take a while.
        </p>
      )}
    </div>
  );
}
