"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatBDT, formatDateTime } from "@/lib/format";
import type { Order, OrderStatus } from "@/types/shared";
import { Button, LinkButton, Card, Section, Input } from "@/components/ui";
import { cn } from "@/lib/cn";

const STATUSES: Array<{ key: OrderStatus; label: string }> = [
  { key: "pending", label: "Pending confirmation" },
  { key: "confirmed", label: "Confirmed" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
];

function statusPillColor(status: OrderStatus) {
  if (status === "delivered") return "bg-emerald-100 text-emerald-700";
  if (status === "cancelled" || status === "refunded")
    return "bg-red-100 text-red-700";
  return "bg-sky-100 text-sky-700";
}

export default function TrackPage() {
  const [phone, setPhone] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = phone.trim();

    if (!query) {
      setError(null);
      setEmptyMessage("Please enter your order phone number to start tracking.");
      setSearched(false);
      setOrders([]);
      return;
    }

    setLoading(true);
    setError(null);
    setEmptyMessage(null);
    setSearched(true);

    try {
      const result = await api.getOrdersByPhone(query);
      setOrders(result.orders);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 404) {
        setEmptyMessage(
          "No order found with this tracking information. Please check your order ID or phone number and try again.",
        );
      } else {
        setError(
          "We could not search orders right now. Please try again in a moment.",
        );
      }
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  function resetSearch() {
    setPhone("");
    setOrders([]);
    setError(null);
    setEmptyMessage(null);
    setSearched(false);
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
          Enter your phone number to find all your orders.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto mb-12 max-w-md">
        <div className="flex gap-2">
          <Input
            type="tel"
            placeholder="01XXXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            pattern="^01[3-9]\d{8}$"
            title="Enter a valid Bangladeshi phone number (e.g., 01712345678)"
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !phone.trim()}>
            {loading ? "Searching..." : "Find Orders"}
          </Button>
        </div>
      </form>

      {error && (
        <div className="mx-auto mb-8 max-w-md rounded-lg border border-red-200 bg-red-50 p-4 text-center text-red-700">
          {error}
        </div>
      )}

      {(emptyMessage || (searched && !loading && orders.length === 0 && !error)) && (
        <div className="mx-auto mb-8 max-w-md rounded-lg border border-amber-200 bg-amber-50 p-4 text-center text-amber-700">
          {emptyMessage ??
            "No order found with this tracking information. Please check your order ID or phone number and try again."}
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
              Search for a different number
            </button>
          </div>

          {orders.map((order) => (
            <Card key={order._id} tone="soft">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">
                    Order {order.orderNumber}
                  </h3>
                  <p className="mt-1 text-sm text-fg-soft">
                    Placed on {formatDateTime(order.createdAt)}
                  </p>
                  <p className="text-sm text-fg-soft">
                    Customer: {order.customer.name}
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatBDT(order.total)}</div>
                  <div
                    className={cn(
                      "mt-1 rounded-full px-2 py-1 text-sm",
                      statusPillColor(order.status),
                    )}
                  >
                    {STATUSES.find((s) => s.key === order.status)?.label ||
                      order.status}
                  </div>
                </div>
              </div>

              {/* Status timeline */}
              <StatusTimeline status={order.status} />

              {/* Order items summary */}
              <div className="border-t border-line pt-4">
                <div className="flex items-center justify-between text-sm">
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

function StatusTimeline({ status }: { status: OrderStatus }) {
  const currentIndex = STATUSES.findIndex((s) => s.key === status);

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 text-sm">
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
      <div className="mt-1 flex justify-between text-xs text-fg-soft">
        {STATUSES.map((s) => (
          <span key={s.key}>{s.label}</span>
        ))}
      </div>
    </div>
  );
}
