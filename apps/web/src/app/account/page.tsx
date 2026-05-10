"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatBDT, formatDateTime } from "@/lib/format";
import type { Order } from "@gamerskit/shared";

export default function AccountPage() {
  const router = useRouter();
  const { token, user, clear } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      router.replace("/");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const r = await api.myOrders(token);
        if (!cancelled) setOrders(r.items);
      } catch {
        if (!cancelled) setOrders([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  if (!token || !user) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-[1080px] px-5 lg:px-8 py-16"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Account</span>
          <h1 className="text-4xl font-semibold tracking-tight mt-2">
            Hi {user.name || user.email}.
          </h1>
          <p className="text-sm text-[var(--fg-soft)] mt-1">{user.email}</p>
        </div>
        <button
          onClick={() => {
            clear();
            router.replace("/");
          }}
          className="btn btn-ghost"
        >
          Sign out
        </button>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight mb-4">Your orders</h2>
        {loading ? (
          <div className="card-soft p-8 text-sm text-[var(--fg-muted)]">Loading…</div>
        ) : orders.length === 0 ? (
          <div className="card-soft p-8 text-center">
            <p className="text-[var(--fg-soft)]">You haven&rsquo;t placed any orders yet.</p>
            <Link href="/shop" className="btn btn-primary mt-4">
              Start shopping
            </Link>
          </div>
        ) : (
          <div className="card-soft overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white text-xs text-[var(--fg-soft)] text-left">
                <tr>
                  <th className="py-3 px-4">Order</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Placed</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o._id} className="hairline-t bg-white">
                    <td className="py-3 px-4 font-mono text-xs">{o.orderNumber}</td>
                    <td className="py-3 px-4">{o.items.length}</td>
                    <td className="py-3 px-4 font-medium">{formatBDT(o.total)}</td>
                    <td className="py-3 px-4 capitalize">{o.status}</td>
                    <td className="py-3 px-4 text-xs text-[var(--fg-muted)]">
                      {formatDateTime(o.createdAt)}
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        href="/track"
                        className="text-xs underline underline-offset-4"
                      >
                        Track
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </motion.div>
  );
}
