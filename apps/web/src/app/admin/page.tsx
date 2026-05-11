"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";
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
  const [range, setRange] = useState<DateRange>(defaultRange());
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Order[]>([]);
  const [top, setTop] = useState<
    Array<{ _id: string; qty: number; revenue: number }>
  >([]);
  const [categories, setCategories] = useState<Category[]>([]);
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
        const [s, t, recentRes, catsRes] = await Promise.all([
          api.stats({ from: range.from, to: range.to }, token),
          api.topProducts({ from: range.from, to: range.to }, token),
          api.listOrdersAdmin(
            { from: range.from, to: range.to, limit: 8 },
            token,
          ),
          api.listCategories(),
        ]);
        if (cancelled) return;
        setStats(s);
        setTop(t.items);
        setRecent(recentRes.items);
        setCategories(catsRes.items || []);
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
  }, [range.from, range.to]);

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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
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
            <table className="w-full text-sm">
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
  return (
    <div className="flex h-[160px] items-end gap-1">
      {data.map((d) => (
        <div
          key={d._id}
          className="group flex flex-1 flex-col items-center justify-end"
        >
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${Math.max(2, (d.total / max) * 100)}%` }}
            transition={{ duration: 0.4 }}
            className="w-full rounded-t-md bg-black transition-colors group-hover:bg-fg-soft"
            title={`${d._id}: ${formatBDT(d.total)} (${d.orders} orders)`}
          />
          <div className="mt-1 w-full truncate text-center text-[10px] text-fg-muted">
            {d._id.slice(5)}
          </div>
        </div>
      ))}
    </div>
  );
}
