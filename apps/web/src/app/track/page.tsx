"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatBDT, formatDateTime } from "@/lib/format";
import type { Order } from "@gamerskit/shared";

const STATUSES: Array<{ key: string; label: string }> = [
  { key: "pending", label: "Pending confirmation" },
  { key: "confirmed", label: "Confirmed" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
];

export default function TrackPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const result = await api.getOrdersByPhone(phone.trim());
      setOrders(result.orders);
    } catch (err) {
      setError((err as Error).message);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const resetSearch = () => {
    setPhone("");
    setOrders([]);
    setError(null);
    setSearched(false);
  };

  return (
    <section className="px-5 lg:px-8 max-w-4xl mx-auto py-16">
      <div className="text-center mb-12">
        <span className="eyebrow">Tracking</span>
        <h1 className="display-2 mt-2">Find your order.</h1>
        <p className="mt-3 text-[var(--fg-soft)]">
          Enter your phone number to find all your orders.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-md mx-auto mb-12">
        <div className="flex gap-2">
          <input
            type="tel"
            className="input flex-1"
            placeholder="01XXXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            pattern="^01[3-9]\d{8}$"
            title="Enter a valid Bangladeshi phone number (e.g., 01712345678)"
          />
          <button
            type="submit"
            disabled={loading || !phone.trim()}
            className="btn btn-primary disabled:opacity-50">
            {loading ? "Searching..." : "Find Orders"}
          </button>
        </div>
      </form>

      {error && (
        <div className="max-w-md mx-auto mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
          {error === "not found"
            ? "No orders found for this phone number."
            : `Error: ${error}`}
        </div>
      )}

      {searched && !loading && orders.length === 0 && !error && (
        <div className="max-w-md mx-auto mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-center">
          No orders found for this phone number. Please check the number and try
          again.
        </div>
      )}

      {orders.length > 0 && (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold">
              Found {orders.length} order{orders.length !== 1 ? "s" : ""}
            </h2>
            <button
              onClick={resetSearch}
              className="mt-2 text-sm text-[var(--fg-soft)] hover:text-[var(--fg)] underline">
              Search for a different number
            </button>
          </div>

          {orders.map((order) => (
            <div key={order._id} className="card-soft p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-lg">
                    Order {order.orderNumber}
                  </h3>
                  <p className="text-sm text-[var(--fg-soft)] mt-1">
                    Placed on {formatDateTime(order.createdAt)}
                  </p>
                  <p className="text-sm text-[var(--fg-soft)]">
                    Customer: {order.customer.name}
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatBDT(order.total)}</div>
                  <div
                    className={`text-sm px-2 py-1 rounded-full mt-1 ${
                      order.status === "delivered"
                        ? "bg-green-100 text-green-700"
                        : order.status === "cancelled" ||
                            order.status === "refunded"
                          ? "bg-red-100 text-red-700"
                          : "bg-blue-100 text-blue-700"
                    }`}>
                    {STATUSES.find((s) => s.key === order.status)?.label ||
                      order.status}
                  </div>
                </div>
              </div>

              {/* Status timeline */}
              <div className="mb-4">
                <div className="flex items-center gap-2 text-sm">
                  {STATUSES.map((status, i) => {
                    const currentIndex = STATUSES.findIndex(
                      (s) => s.key === order.status,
                    );
                    const isCompleted = i <= currentIndex;
                    const isCurrent = i === currentIndex;

                    return (
                      <div key={status.key} className="flex items-center">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            isCompleted ? "bg-black" : "bg-gray-300"
                          } ${isCurrent ? "ring-2 ring-black ring-offset-1" : ""}`}
                        />
                        {i < STATUSES.length - 1 && (
                          <div
                            className={`w-8 h-0.5 ${
                              isCompleted ? "bg-black" : "bg-gray-300"
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-[var(--fg-soft)] mt-1">
                  {STATUSES.map((status) => (
                    <span key={status.key}>{status.label}</span>
                  ))}
                </div>
              </div>

              {/* Order items summary */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--fg-soft)]">
                    {order.items.length} item
                    {order.items.length !== 1 ? "s" : ""}
                  </span>
                  <Link
                    href={`/order/${order.orderNumber}`}
                    className="text-black hover:underline font-medium">
                    View details →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-center mt-12">
        <Link href="/shop" className="btn btn-ghost">
          Continue shopping
        </Link>
      </div>
    </section>
  );
}
