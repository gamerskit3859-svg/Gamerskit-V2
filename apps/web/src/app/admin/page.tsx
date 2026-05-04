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
import type { Order } from "@gamerskit/shared";

type Stats = Awaited<ReturnType<typeof api.stats>>;

export default function AdminDashboard() {
  const [range, setRange] = useState<DateRange>(defaultRange());
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Order[]>([]);
  const [top, setTop] = useState<Array<{ _id: string; qty: number; revenue: number }>>([]);
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
        const [s, t, recentRes] = await Promise.all([
          api.stats({ from: range.from, to: range.to }, token),
          api.topProducts({ from: range.from, to: range.to }, token),
          api.listOrdersAdmin({ from: range.from, to: range.to, limit: 8 }, token),
        ]);
        if (cancelled) return;
        setStats(s);
        setTop(t.items);
        setRecent(recentRes.items);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to]);

  return (
    <div>
      <header className="mb-8">
        <span className="eyebrow">Admin</span>
        <div className="flex flex-wrap items-end justify-between gap-4 mt-2">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-[var(--fg-soft)] mt-1">
              {range.label} · {range.from} → {range.to}
            </p>
          </div>
          <Link href="/admin/orders/new" className="btn btn-primary">
            + Custom order
          </Link>
        </div>
        <div className="mt-5">
          <DateRangePicker value={range} onChange={setRange} />
        </div>
      </header>

      {error && (
        <div className="card-soft p-4 text-sm text-red-600 mb-6">{error}</div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Revenue" value={formatBDT(stats?.revenue ?? 0)} loading={loading} />
        <Stat
          label="Gross profit"
          value={formatBDT(stats?.grossProfit ?? 0)}
          loading={loading}
        />
        <Stat label="Orders" value={(stats?.totalOrders ?? 0).toString()} loading={loading} />
        <Stat
          label="Items sold"
          value={(stats?.productsSold ?? 0).toString()}
          loading={loading}
        />
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5 mt-8">
        <Card title="Revenue per day">
          <RevenueChart data={stats?.revenueByDay ?? []} />
        </Card>
        <Card title="Top products">
          {top.length === 0 ? (
            <Empty />
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {top.slice(0, 6).map((t) => (
                <li
                  key={t._id}
                  className="py-2 flex justify-between text-sm gap-4"
                >
                  <span className="truncate">{t._id}</span>
                  <span className="text-[var(--fg-soft)] whitespace-nowrap">
                    {t.qty} · {formatBDT(t.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Recent orders" className="mt-5">
        {recent.length === 0 ? (
          <Empty />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-[var(--fg-soft)] text-left">
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
                  <tr key={o._id} className="hairline-t">
                    <td className="py-2 pr-3 font-mono text-xs">
                      <Link
                        href={`/admin/orders`}
                        className="hover:underline"
                      >
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{o.customer.name}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full ${
                          o.source === "manual"
                            ? "bg-black text-white"
                            : "bg-[var(--bg-soft)] text-[var(--fg-soft)]"
                        }`}
                      >
                        {o.source}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{formatBDT(o.total)}</td>
                    <td className="py-2 pr-3 capitalize">{o.status}</td>
                    <td className="py-2 pr-3 text-[var(--fg-soft)]">
                      {formatDateTime(o.createdAt)}
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

function Stat({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading?: boolean;
}) {
  return (
    <motion.div
      layout
      className="card-soft p-5"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="text-xs text-[var(--fg-soft)]">{label}</div>
      <div className="text-2xl font-semibold mt-1 tabular-nums">
        {loading ? "…" : value}
      </div>
    </motion.div>
  );
}

function Card({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`card-soft p-5 ${className ?? ""}`}>
      <h3 className="font-semibold text-sm mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Empty() {
  return <div className="text-sm text-[var(--fg-muted)]">No data for this range.</div>;
}

function RevenueChart({ data }: { data: Array<{ _id: string; total: number; orders: number }> }) {
  if (data.length === 0) return <Empty />;
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div className="flex items-end gap-1 h-[160px]">
      {data.map((d) => (
        <div
          key={d._id}
          className="flex-1 flex flex-col items-center justify-end group"
        >
          <div
            style={{ height: `${Math.max(2, (d.total / max) * 100)}%` }}
            className="w-full bg-black rounded-t-md transition-colors group-hover:bg-[var(--fg-soft)]"
            title={`${d._id}: ${formatBDT(d.total)} (${d.orders} orders)`}
          />
          <div className="text-[10px] text-[var(--fg-muted)] mt-1 truncate w-full text-center">
            {d._id.slice(5)}
          </div>
        </div>
      ))}
    </div>
  );
}
