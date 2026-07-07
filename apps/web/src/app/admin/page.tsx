"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";
import { useAuth } from "@/lib/auth";
import { getBalanceAmount } from "@/lib/courier";
import { formatBDT, formatDateTime } from "@/lib/format";
import {
  DateRangePicker,
  defaultRange,
  type DateRange,
} from "@/components/admin/DateRangePicker";
import type { Order } from "@/types/shared";
import { LinkButton, Card as UICard, Pill, StatCard } from "@/components/ui";
import { cn } from "@/lib/cn";

type Stats = Awaited<ReturnType<typeof api.stats>>;

interface Category {
  _id: string;
  slug: string;
  name: string;
  productCount: number;
}

export default function AdminDashboard() {
  const user = useAuth((s) => s.user);
  const [range, setRange] = useState<DateRange>(defaultRange());
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Order[]>([]);
  const [top, setTop] = useState<
    Array<{ _id: string; qty: number; revenue: number }>
  >([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [steadfastBalance, setSteadfastBalance] = useState<number | null>(null);
  const [steadfastError, setSteadfastError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const token = getAdminToken();
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        if (user?.role === "staff") {
          const pending = await api.listOrdersAdmin(
            { status: "pending", page: 1, limit: 12 },
            token,
          );
          if (cancelled) return;
          setRecent(pending.items);
          return;
        }

        const [statsResult, topResult, recentResult, categoriesResult] =
          await Promise.allSettled([
            api.stats({ from: range.from, to: range.to }, token),
            api.topProducts({ from: range.from, to: range.to }, token),
            api.listOrdersAdmin(
              { from: range.from, to: range.to, limit: 8 },
              token,
            ),
            api.listCategoriesAdmin(token),
          ]);
        const balanceResult = await api.getSteadfastBalance(token).catch((err) => err);
        if (cancelled) return;
        if (statsResult.status === "fulfilled") setStats(statsResult.value);
        if (topResult.status === "fulfilled") setTop(topResult.value.items);
        if (recentResult.status === "fulfilled") {
          setRecent(recentResult.value.items);
        }
        if (categoriesResult.status === "fulfilled") {
          setCategories(categoriesResult.value.items || []);
        }
        if (balanceResult instanceof Error) {
          setSteadfastBalance(null);
          setSteadfastError("Could not load balance");
        } else {
          setSteadfastBalance(getBalanceAmount(balanceResult.item));
          setSteadfastError(null);
        }
        if (
          statsResult.status === "rejected" ||
          topResult.status === "rejected" ||
          recentResult.status === "rejected"
        ) {
          setError("Some dashboard data could not be loaded. Please refresh.");
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, user?.role]);

  if (user?.role === "staff") {
    return (
      <div>
        <header className="mb-8">
          <span className="block text-xs font-medium uppercase tracking-[0.18em] text-fg-soft">
            Staff
          </span>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Pending orders
              </h1>
              <p className="mt-1 text-sm text-fg-soft">
                Orders waiting for confirmation or processing.
              </p>
            </div>
            <LinkButton href="/admin/orders/new">+ Custom order</LinkButton>
          </div>
        </header>

        {error && (
          <UICard tone="soft" padding="sm" className="mb-6 text-sm text-red-600">
            {error}
          </UICard>
        )}

        <PanelCard title="Pending orders">
          {loading ? (
            <div className="text-sm text-fg-muted">Loading pending orders...</div>
          ) : recent.length === 0 ? (
            <div className="text-sm text-fg-muted">No pending orders right now.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[720px] w-full text-sm">
                <thead className="text-left text-xs text-fg-soft">
                  <tr>
                    <th className="py-2 pr-3">Order</th>
                    <th className="py-2 pr-3">Customer</th>
                    <th className="py-2 pr-3">Total</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Placed</th>
                    <th className="py-2 pr-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((o) => (
                    <tr key={o._id} className="border-t border-line">
                      <td className="py-2 pr-3 font-mono text-xs">
                        {o.orderNumber}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="font-medium">{o.customer?.name ?? "Customer"}</div>
                        <div className="text-xs text-fg-muted">
                          {o.customer?.phone ?? "No phone"}
                        </div>
                      </td>
                      <td className="py-2 pr-3">{formatBDT(o.total)}</td>
                      <td className="py-2 pr-3 capitalize">{o.status}</td>
                      <td className="py-2 pr-3 text-fg-soft">
                        {formatDateTime(o.createdAt)}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <Link
                          href={`/admin/orders/${o._id}`}
                          className="font-medium text-blue-600 hover:text-blue-800"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PanelCard>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-8">
        <span className="block text-xs font-medium uppercase tracking-[0.18em] text-fg-soft">
          Admin
        </span>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-fg-soft">
              {range.label} · {range.from} → {range.to}
            </p>
          </div>
          <LinkButton href="/admin/orders/new">+ Custom order</LinkButton>
        </div>
        <div className="mt-5">
          <DateRangePicker value={range} onChange={setRange} />
        </div>
      </header>

      {error && (
        <UICard tone="soft" padding="sm" className="mb-6 text-sm text-red-600">
          {error}
        </UICard>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Revenue"
          value={formatBDT(stats?.revenue ?? 0)}
          loading={loading}
        />
        <StatCard
          label="Gross profit"
          value={formatBDT(stats?.grossProfit ?? 0)}
          loading={loading}
        />
        <StatCard
          label="Orders"
          value={(stats?.totalOrders ?? 0).toString()}
          loading={loading}
        />
        <StatCard
          label="Items sold"
          value={(stats?.productsSold ?? 0).toString()}
          loading={loading}
        />
        <StatCard
          label="Steadfast Balance"
          value={
            steadfastBalance === null ? "Unavailable" : formatBDT(steadfastBalance)
          }
          hint={steadfastError ?? "Courier account"}
          loading={loading}
        />
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <PanelCard title="Revenue per day">
          <RevenueChart data={stats?.revenueByDay ?? []} />
        </PanelCard>
        <PanelCard title="Top products">
          {top.length === 0 ? (
            <Empty />
          ) : (
            <ul className="divide-y divide-line">
              {top.slice(0, 6).map((t) => (
                <li
                  key={t._id}
                  className="flex justify-between gap-4 py-2 text-sm"
                >
                  <span className="truncate">{t._id}</span>
                  <span className="whitespace-nowrap text-fg-soft">
                    {t.qty} · {formatBDT(t.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>
      </div>

      <PanelCard title="Categories" className="mt-5">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {categories.length === 0 ? (
            <Empty />
          ) : (
            categories.slice(0, 8).map((cat) => (
              <Link
                key={cat._id}
                href="/admin/categories"
                className="rounded-lg border border-line-strong p-4 transition-colors hover:border-black"
              >
                <div className="text-sm font-semibold">{cat.name}</div>
                <div className="mt-1 text-xs text-fg-soft">
                  {cat.productCount} products
                </div>
              </Link>
            ))
          )}
          {categories.length > 8 && (
            <Link
              href="/admin/categories"
              className="flex items-center justify-center rounded-lg border border-dashed border-line-strong p-4 transition-colors hover:border-black"
            >
              <span className="text-sm font-semibold">View all →</span>
            </Link>
          )}
        </div>
      </PanelCard>

      <PanelCard title="Recent orders" className="mt-5">
        {recent.length === 0 ? (
          <Empty />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-sm">
              <thead className="text-left text-xs text-fg-soft">
                <tr>
                  <th className="py-2 pr-3">Order</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Placed</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={o._id} className="border-t border-line">
                    <td className="py-2 pr-3 font-mono text-xs">
                      <Link
                        href="/admin/orders"
                        className="hover:underline"
                      >
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{o.customer.name}</td>
                    <td className="py-2 pr-3">
                      <Pill tone={o.source === "manual" ? "info" : "neutral"}>
                        {o.source}
                      </Pill>
                    </td>
                    <td className="py-2 pr-3">{formatBDT(o.total)}</td>
                    <td className="py-2 pr-3 capitalize">{o.status}</td>
                    <td className="py-2 pr-3 text-fg-soft">
                      {formatDateTime(o.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PanelCard>
    </div>
  );
}

function PanelCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <UICard tone="soft" className={cn(className)}>
      <h3 className="mb-4 text-sm font-semibold">{title}</h3>
      {children}
    </UICard>
  );
}

function Empty() {
  return (
    <div className="text-sm text-fg-muted">No data for this range.</div>
  );
}

function RevenueChart({
  data,
}: {
  data: Array<{ _id: string; total: number; orders: number }>;
}) {
  if (data.length === 0) return <Empty />;
  const max = Math.max(...data.map((d) => d.total), 1);
  const total = data.reduce((sum, day) => sum + day.total, 0);
  const orders = data.reduce((sum, day) => sum + day.orders, 0);
  const maxLabel = formatBDT(max);
  // Scale to the number of bars instead of a fixed width, so short ranges
  // (e.g. "This week") fit on a phone screen without forcing a scrollbar,
  // while long ranges (e.g. "All time") still scroll horizontally.
  const chartMinWidth = Math.max(280, data.length * 34 + 60);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold tracking-tight">
            {formatBDT(total)}
          </div>
          <div className="text-xs text-fg-muted">
            {orders} order{orders === 1 ? "" : "s"} in this range
          </div>
        </div>
        <div className="text-right text-xs text-fg-muted">
          Peak day
          <div className="font-medium text-foreground">{maxLabel}</div>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div
          className="grid grid-cols-[44px_1fr] gap-3"
          style={{ minWidth: chartMinWidth }}
        >
          <div className="flex h-[190px] flex-col justify-between py-1 text-right text-[10px] text-fg-muted">
            <span>{maxLabel}</span>
            <span>{formatBDT(max / 2)}</span>
            <span>৳0</span>
          </div>

          <div className="relative h-[190px]">
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
              {Array.from({ length: 3 }).map((_, index) => (
                <span key={index} className="border-t border-line" />
              ))}
            </div>
            <div
              className="relative z-10 grid h-full items-end gap-1"
              style={{
                gridTemplateColumns: `repeat(${data.length}, minmax(18px, 1fr))`,
              }}>
              {data.map((d) => {
                const height = d.total > 0 ? Math.max(6, (d.total / max) * 100) : 0;
                return (
                  <div
                    key={d._id}
                    className="group flex h-full flex-col items-center justify-end"
                  >
                    <div className="relative flex w-full flex-1 items-end justify-center">
                      <div className="pointer-events-none absolute bottom-full mb-2 hidden w-max rounded-md bg-black px-2 py-1 text-[11px] text-white shadow-lg group-hover:block">
                        {d._id}: {formatBDT(d.total)} · {d.orders} order
                        {d.orders === 1 ? "" : "s"}
                      </div>
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        transition={{ duration: 0.35 }}
                        className={
                          d.total > 0
                            ? "w-full rounded-t bg-black transition-colors group-hover:bg-neutral-600"
                            : "w-full rounded-t border border-dashed border-line bg-transparent"
                        }
                        title={`${d._id}: ${formatBDT(d.total)} (${d.orders} orders)`}
                      />
                    </div>
                    <div className="mt-2 w-full truncate text-center text-[10px] text-fg-muted">
                      {d._id.slice(5)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
