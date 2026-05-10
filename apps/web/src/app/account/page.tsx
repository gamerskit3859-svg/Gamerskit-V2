"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatBDT, formatDateTime } from "@/lib/format";
import type { Order } from "@gamerskit/shared";
import { Button, LinkButton, Card, Section } from "@/components/ui";

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
    >
      <Section width="narrow" spacing="lg" className="!max-w-[1080px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="block text-xs font-medium uppercase tracking-[0.18em] text-fg-soft">
              Account
            </span>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              Hi {user.name || user.email}.
            </h1>
            <p className="mt-1 text-sm text-fg-soft">{user.email}</p>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              clear();
              router.replace("/");
            }}
          >
            Sign out
          </Button>
        </div>

        <section className="mt-10">
          <h2 className="mb-4 text-xl font-semibold tracking-tight">Your orders</h2>
          {loading ? (
            <Card tone="soft" padding="lg" className="text-sm text-fg-muted">
              Loading…
            </Card>
          ) : orders.length === 0 ? (
            <Card tone="soft" padding="lg" className="text-center">
              <p className="text-fg-soft">
                You haven&rsquo;t placed any orders yet.
              </p>
              <LinkButton href="/shop" className="mt-4">
                Start shopping
              </LinkButton>
            </Card>
          ) : (
            <Card tone="soft" padding="none" className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-white text-left text-xs text-fg-soft">
                  <tr>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Items</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Placed</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o._id} className="border-t border-line bg-white">
                      <td className="px-4 py-3 font-mono text-xs">
                        {o.orderNumber}
                      </td>
                      <td className="px-4 py-3">{o.items.length}</td>
                      <td className="px-4 py-3 font-medium">
                        {formatBDT(o.total)}
                      </td>
                      <td className="px-4 py-3 capitalize">{o.status}</td>
                      <td className="px-4 py-3 text-xs text-fg-muted">
                        {formatDateTime(o.createdAt)}
                      </td>
                      <td className="px-4 py-3">
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
            </Card>
          )}
        </section>
      </Section>
    </motion.div>
  );
}
