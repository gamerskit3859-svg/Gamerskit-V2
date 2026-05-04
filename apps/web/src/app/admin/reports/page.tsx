"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";
import { formatBDT } from "@/lib/format";
import { DateRangePicker, defaultRange, type DateRange } from "@/components/admin/DateRangePicker";

interface Reports {
  byCategory: Array<{ _id: string; qty: number; revenue: number }>;
  byPayment: Array<{ _id: string; count: number; revenue: number }>;
  bySource: Array<{ _id: string; count: number; revenue: number }>;
  aov: number;
  orderCount: number;
  repeatBuyers: number;
  grossRevenue: number;
  grossCost: number;
  grossProfit: number;
  grossMargin: number;
}

function HBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-2 rounded-full bg-[var(--bg-soft)] overflow-hidden">
      <div className="h-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function ReportsPage() {
  const [range, setRange] = useState<DateRange>(defaultRange());
  const [reports, setReports] = useState<Reports | null>(null);
  const [topProducts, setTopProducts] = useState<Array<{ _id: string; qty: number; revenue: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const token = getAdminToken();
    if (!token) return;
    void (async () => {
      setLoading(true);
      try {
        const [r, t] = await Promise.all([
          api.reports({ from: range.from, to: range.to }, token),
          api.topProducts({ from: range.from, to: range.to }, token),
        ]);
        if (cancelled) return;
        setReports(r);
        setTopProducts(t.items);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to]);

  const maxCategoryRevenue = reports
    ? Math.max(1, ...reports.byCategory.map((c) => c.revenue))
    : 1;
  const maxTopProductRevenue = topProducts.length
    ? Math.max(1, ...topProducts.map((p) => p.revenue))
    : 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <header className="mb-6">
        <span className="eyebrow">Admin</span>
        <h1 className="text-3xl font-semibold tracking-tight mt-2">Reports</h1>
        <p className="text-sm text-[var(--fg-soft)] mt-1">
          {range.label.toLowerCase()} · breakdowns by category, payment, source, and bestsellers.
        </p>
        <div className="mt-5">
          <DateRangePicker value={range} onChange={setRange} />
        </div>
      </header>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="card-soft p-5">
          <div className="text-xs uppercase tracking-wider text-[var(--fg-muted)]">Gross profit</div>
          <div className="text-3xl font-semibold tracking-tight mt-2">
            {reports ? formatBDT(reports.grossProfit) : "—"}
          </div>
          <div className="text-xs text-[var(--fg-muted)] mt-2">
            {reports
              ? `${(reports.grossMargin * 100).toFixed(1)}% margin · cost ${formatBDT(reports.grossCost)}`
              : "Set buying price on products to compute."}
          </div>
        </div>
        <div className="card-soft p-5">
          <div className="text-xs uppercase tracking-wider text-[var(--fg-muted)]">Orders</div>
          <div className="text-3xl font-semibold tracking-tight mt-2">
            {reports?.orderCount ?? 0}
          </div>
          <div className="text-xs text-[var(--fg-muted)] mt-2">
            AOV {reports ? formatBDT(reports.aov) : "—"}
          </div>
        </div>
        <div className="card-soft p-5">
          <div className="text-xs uppercase tracking-wider text-[var(--fg-muted)]">Repeat buyers</div>
          <div className="text-3xl font-semibold tracking-tight mt-2">
            {reports?.repeatBuyers ?? 0}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <section className="card-soft p-5">
          <h2 className="text-sm font-semibold mb-4">Revenue by category</h2>
          {loading ? (
            <div className="text-xs text-[var(--fg-muted)]">Loading…</div>
          ) : !reports?.byCategory.length ? (
            <div className="text-xs text-[var(--fg-muted)]">No data.</div>
          ) : (
            <div className="space-y-3">
              {reports.byCategory.map((c) => (
                <div key={c._id} className="text-sm">
                  <div className="flex justify-between mb-1.5">
                    <span className="capitalize">{c._id.replace(/-/g, " ")}</span>
                    <span className="font-medium">{formatBDT(c.revenue)}</span>
                  </div>
                  <HBar value={c.revenue} max={maxCategoryRevenue} color="#1d1d1f" />
                  <div className="text-xs text-[var(--fg-muted)] mt-0.5">{c.qty} units</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card-soft p-5">
          <h2 className="text-sm font-semibold mb-4">Top products</h2>
          {loading ? (
            <div className="text-xs text-[var(--fg-muted)]">Loading…</div>
          ) : !topProducts.length ? (
            <div className="text-xs text-[var(--fg-muted)]">No sales yet.</div>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p) => (
                <div key={p._id} className="text-sm">
                  <div className="flex justify-between mb-1.5">
                    <span className="truncate pr-2">{p._id}</span>
                    <span className="font-medium">{formatBDT(p.revenue)}</span>
                  </div>
                  <HBar value={p.revenue} max={maxTopProductRevenue} color="#6e6e73" />
                  <div className="text-xs text-[var(--fg-muted)] mt-0.5">{p.qty} units</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="card-soft p-5">
          <h2 className="text-sm font-semibold mb-4">By payment method</h2>
          {!reports?.byPayment.length ? (
            <div className="text-xs text-[var(--fg-muted)]">No data.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-[var(--fg-muted)] text-left">
                <tr>
                  <th className="py-2">Method</th>
                  <th className="py-2">Orders</th>
                  <th className="py-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {reports.byPayment.map((p) => (
                  <tr key={p._id} className="hairline-t">
                    <td className="py-2 capitalize">{p._id || "—"}</td>
                    <td className="py-2">{p.count}</td>
                    <td className="py-2 font-medium">{formatBDT(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card-soft p-5">
          <h2 className="text-sm font-semibold mb-4">By source</h2>
          {!reports?.bySource.length ? (
            <div className="text-xs text-[var(--fg-muted)]">No data.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-[var(--fg-muted)] text-left">
                <tr>
                  <th className="py-2">Source</th>
                  <th className="py-2">Orders</th>
                  <th className="py-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {reports.bySource.map((p) => (
                  <tr key={p._id} className="hairline-t">
                    <td className="py-2 capitalize">{p._id}</td>
                    <td className="py-2">{p.count}</td>
                    <td className="py-2 font-medium">{formatBDT(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </motion.div>
  );
}
