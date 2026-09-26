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
  presetRange,
  type DateRange,
} from "@/components/admin/DateRangePicker";
import type { Order } from "@/types/shared";
import { Input, LinkButton, Card as UICard, Pill, StatCard } from "@/components/ui";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { cn } from "@/lib/cn";

type Stats = Awaited<ReturnType<typeof api.stats>>;
type DeliveredProduct = Awaited<
  ReturnType<typeof api.deliveredProducts>
>["items"][number];

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
  const [delivered, setDelivered] = useState<DeliveredProduct[]>([]);
  // Fixed one-month window, deliberately independent of the range picker above:
  // this panel answers "what went out over the last month", whatever range the
  // rest of the dashboard is showing. Built once so it stays a stable dep.
  const [deliveredRange] = useState<DateRange>(() => presetRange("30d"));
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
      // Wait until the session role is resolved. AdminShell populates `user`
      // asynchronously via api.me(); firing admin-only requests while the role
      // is still unknown (or for a non-admin session that is about to be
      // redirected away) produces spurious 403 "admin only" responses.
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        if (user.role === "staff") {
          const pending = await api.listOrdersAdmin(
            { status: "confirmed", page: 1, limit: 12 },
            token,
          );
          if (cancelled) return;
          setRecent(pending.items);
          return;
        }

        // Dashboard KPIs and the courier balance are admin-only. Non-admin
        // sessions never render this view (AdminShell redirects them), so skip
        // the requests rather than let them 403.
        if (user.role !== "admin") return;

        const [
          statsResult,
          topResult,
          deliveredResult,
          recentResult,
          categoriesResult,
        ] =
          await Promise.allSettled([
            api.stats({ from: range.from, to: range.to }, token),
            api.topProducts({ from: range.from, to: range.to }, token),
            api.deliveredProducts(
              { from: deliveredRange.from, to: deliveredRange.to },
              token,
            ),
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
        if (deliveredResult.status === "fulfilled") {
          setDelivered(deliveredResult.value.items);
        }
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
          deliveredResult.status === "rejected" ||
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
  }, [range.from, range.to, deliveredRange.from, deliveredRange.to, user?.role]);

  if (user?.role === "staff") {
    return (
      <div>
        <AdminPageHeader
          title="Open orders"
          description="Orders waiting for confirmation or processing."
          actions={
            <LinkButton href="/admin/orders/new">+ Custom order</LinkButton>
          }
        />

        {error && (
          <UICard tone="soft" padding="sm" className="mb-6 text-sm text-red-600">
            {error}
          </UICard>
        )}

        <PanelCard title="Open orders">
          {loading ? (
            <div className="text-sm text-fg-muted">Loading pending orders...</div>
          ) : recent.length === 0 ? (
            <div className="text-sm text-fg-muted">No pending orders right now.</div>
          ) : (
            <>
            {/* Below md the six columns stack into a card per order. */}
            <ul className="divide-y divide-line md:hidden">
              {recent.map((o) => (
                <li key={o._id} className="py-3 first:pt-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {o.customer?.name ?? "Customer"}
                      </p>
                      <p className="truncate text-xs text-fg-muted">
                        {o.customer?.phone ?? "No phone"} · {o.orderNumber}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold">
                      {formatBDT(o.total)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] capitalize text-fg-soft">
                      {o.status.replace(/_/g, " ")} ·{" "}
                      {formatDateTime(o.createdAt)}
                    </span>
                    <Link
                      href={`/admin/orders/${o._id}`}
                      className="shrink-0 text-xs font-semibold text-blue-600"
                    >
                      View
                    </Link>
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto md:block">
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
            </>
          )}
        </PanelCard>
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Dashboard"
        description={
          <span className="block break-words">
            {range.label} · {range.from} → {range.to}
          </span>
        }
        actions={
          <LinkButton href="/admin/orders/new">+ Custom order</LinkButton>
        }
      >
        <div className="mt-4 sm:mt-5">
          <DateRangePicker value={range} onChange={setRange} />
        </div>
      </AdminPageHeader>

      {error && (
        <UICard tone="soft" padding="sm" className="mb-6 text-sm text-red-600">
          {error}
        </UICard>
      )}

      {/* Six across only from 2xl. `lg` is where the 260px sidebar appears, so
          the content column is narrower there (684px) than at md (720px) —
          splitting into six at lg gave each card ~104px for a ৳1,234,567. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-6">
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
          label="Damaged loss"
          value={formatBDT(stats?.damagedCost ?? 0)}
          hint={`${stats?.damagedQuantity ?? 0} unit${(stats?.damagedQuantity ?? 0) === 1 ? "" : "s"} written off`}
          tone={(stats?.damagedCost ?? 0) > 0 ? "negative" : "default"}
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

      <PanelCard title="Delivered per product" className="mt-5">
        <DeliveredProducts
          items={delivered}
          loading={loading}
          range={deliveredRange}
        />
      </PanelCard>

      <PanelCard title="Damaged goods" className="mt-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <DamagedStat
            label="Units written off"
            value={(stats?.damagedQuantity ?? 0).toLocaleString()}
            loading={loading}
          />
          <DamagedStat
            label="Buying loss"
            value={formatBDT(stats?.damagedCost ?? 0)}
            tone={(stats?.damagedCost ?? 0) > 0 ? "negative" : "default"}
            loading={loading}
          />
          <DamagedStat
            label="Write-offs"
            value={(stats?.damagedEntries ?? 0).toLocaleString()}
            loading={loading}
          />
        </div>
        <p className="mt-3 text-xs text-fg-muted">
          Buying cost of damaged units is deducted from profit in{" "}
          <Link href="/admin/reports" className="underline underline-offset-2">
            Accounting
          </Link>
          . Mark damaged stock from{" "}
          <Link href="/admin/inventory" className="underline underline-offset-2">
            Inventory
          </Link>
          .
        </p>
      </PanelCard>

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
          <>
          {/* Below md the six columns stack into a card per order. */}
          <ul className="divide-y divide-line md:hidden">
            {recent.map((o) => (
              <li key={o._id} className="py-3 first:pt-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href="/admin/orders"
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {o.customer.name}
                    </Link>
                    <p className="truncate font-mono text-[11px] text-fg-muted">
                      {o.orderNumber}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold">
                    {formatBDT(o.total)}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Pill tone={o.source === "manual" ? "info" : "neutral"}>
                    {o.source}
                  </Pill>
                  <span className="text-[11px] capitalize text-fg-soft">
                    {o.status.replace(/_/g, " ")}
                  </span>
                  <span className="ml-auto text-[11px] text-fg-muted">
                    {formatDateTime(o.createdAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto md:block">
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
          </>
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
    <UICard tone="soft" className={cn("min-w-0", className)}>
      <h3 className="mb-4 text-sm font-semibold">{title}</h3>
      {children}
    </UICard>
  );
}

function DeliveredProducts({
  items,
  loading,
  range,
}: {
  items: DeliveredProduct[];
  loading: boolean;
  range: DateRange;
}) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const rows = term
    ? items.filter((item) => item.title.toLowerCase().includes(term))
    : items;
  const totalQty = rows.reduce((sum, row) => sum + row.qty, 0);
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <p className="text-xs text-fg-muted">
          Units that reached customers · {range.label.toLowerCase()} ({range.from}{" "}
          → {range.to})
        </p>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter products"
          aria-label="Filter delivered products"
          className="w-full py-1.5 text-sm sm:max-w-[240px]"
        />
      </div>

      {loading ? (
        <div className="text-sm text-fg-muted">Loading delivered products...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-fg-muted">
          No orders were delivered in this window.
        </div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-fg-muted">
          No delivered product matches &ldquo;{q.trim()}&rdquo;.
        </div>
      ) : (
        <>
          <div className="max-h-[420px] overflow-auto rounded-lg border border-line">
            {/* Four short numeric columns do fit a phone once the padding and
                type come down, so this one stays a table all the way. */}
            <table className="w-full text-xs sm:min-w-[520px] sm:text-sm">
              <thead className="sticky top-0 z-10 bg-white text-left text-[11px] text-fg-soft shadow-[0_1px_0_var(--color-line)] sm:text-xs">
                <tr>
                  <th className="px-2 py-2 font-medium sm:px-3">Product</th>
                  <th className="px-2 py-2 text-right font-medium sm:px-3">
                    Delivered
                  </th>
                  <th className="hidden px-2 py-2 text-right font-medium sm:table-cell sm:px-3">
                    Orders
                  </th>
                  <th className="px-2 py-2 text-right font-medium sm:px-3">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id} className="border-t border-line">
                    <td className="px-2 py-2 sm:px-3">
                      <span className="line-clamp-2">{row.title}</span>
                      {/* The orders column is dropped on a phone; its number
                          rides along here so nothing is actually lost. */}
                      <span className="block text-[10px] text-fg-muted sm:hidden">
                        {row.orders.toLocaleString()}{" "}
                        {row.orders === 1 ? "order" : "orders"}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums sm:px-3">
                      {row.qty.toLocaleString()}
                    </td>
                    <td className="hidden px-2 py-2 text-right tabular-nums text-fg-soft sm:table-cell sm:px-3">
                      {row.orders.toLocaleString()}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-fg-soft sm:px-3">
                      {formatBDT(row.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-fg-muted">
            {rows.length} product{rows.length === 1 ? "" : "s"} ·{" "}
            {totalQty.toLocaleString()} unit{totalQty === 1 ? "" : "s"} ·{" "}
            {formatBDT(totalRevenue)}
            {term ? " (filtered)" : ""}
          </p>
        </>
      )}
    </div>
  );
}

function Empty() {
  return (
    <div className="text-sm text-fg-muted">No data for this range.</div>
  );
}

function DamagedStat({
  label,
  value,
  tone = "default",
  loading,
}: {
  label: string;
  value: string;
  tone?: "default" | "negative";
  loading?: boolean;
}) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-fg-soft">
        {label}
      </div>
      <div
        className={cn(
          "mt-1.5 text-xl font-semibold tabular-nums sm:text-2xl",
          tone === "negative" && "text-red-600",
        )}
      >
        {loading ? "…" : value}
      </div>
    </div>
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
  // while long ranges (e.g. "All time") still scroll horizontally. Kept small
  // enough that a ~1-week range fits inside a narrow mobile card.
  const chartMinWidth = Math.max(220, data.length * 26 + 52);

  return (
    <div className="min-w-0">
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
          className="grid grid-cols-[36px_1fr] gap-2 sm:grid-cols-[44px_1fr] sm:gap-3"
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
