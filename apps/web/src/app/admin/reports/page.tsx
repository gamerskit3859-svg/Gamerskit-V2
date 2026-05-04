"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";
import { formatBDT, formatDate } from "@/lib/format";
import {
  DateRangePicker,
  defaultRange,
  type DateRange,
} from "@/components/admin/DateRangePicker";

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
  transactions: Array<{
    _id: string;
    orderNumber: string;
    total: number;
    status: string;
    paymentMethod: string;
    customer?: { name?: string };
    createdAt: string;
  }>;
}

interface Overrides {
  shippingCharged: number;
  refunds: number;
  shippingExpense: number;
  ads: number;
  platformFees: number;
  other: number;
}

const ZERO_OVERRIDES: Overrides = {
  shippingCharged: 0,
  refunds: 0,
  shippingExpense: 0,
  ads: 0,
  platformFees: 0,
  other: 0,
};

function pct(num: number, denom: number): number {
  return denom > 0 ? num / denom : 0;
}

function statusFor(metric: "margin" | "refund" | "roas", value: number, applicable: boolean):
  | { label: string; tone: string }
  | null {
  if (!applicable) return null;
  if (metric === "margin") {
    if (value >= 0.3) return { label: "Strong", tone: "emerald" };
    if (value >= 0.15) return { label: "Healthy", tone: "sky" };
    return { label: "Watch", tone: "amber" };
  }
  if (metric === "refund") {
    if (value <= 0.02) return { label: "Strong", tone: "emerald" };
    if (value <= 0.05) return { label: "Healthy", tone: "sky" };
    return { label: "Watch", tone: "amber" };
  }
  // roas
  if (value >= 4) return { label: "Strong", tone: "emerald" };
  if (value >= 2) return { label: "Healthy", tone: "sky" };
  return { label: "Watch", tone: "amber" };
}

const TONE_CLASSES: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  sky: "bg-sky-50 text-sky-700 border-sky-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
};

interface MoneyRowProps {
  label: string;
  value: number;
  sign?: 1 | -1;
  auto?: boolean;
  hint?: string;
  onChange?: (next: number) => void;
}

function MoneyRow({ label, value, sign = 1, auto, hint, onChange }: MoneyRowProps) {
  // The input is uncontrolled w.r.t. the prop value: we initialize the draft
  // once from the current value on mount, and rely on the parent passing a
  // changing `key` (e.g. on date-range change) to remount the row when the
  // external value changes. Within an editing session, the draft is the
  // source of truth until commit.
  const [draft, setDraft] = useState<string>(() => String(Math.round(value)));

  function commit() {
    if (!onChange) return;
    const n = Number(draft.replace(/[^0-9.-]/g, ""));
    const safe = Number.isFinite(n) && n >= 0 ? n : 0;
    if (safe !== value) onChange(safe);
    setDraft(String(Math.round(safe)));
  }

  return (
    <div className="flex items-center justify-between gap-4 py-3 hairline-b last:border-b-0">
      <div className="min-w-0">
        <div className="text-sm text-[var(--fg)]">{label}</div>
        {hint && (
          <div className="text-[11px] text-[var(--fg-muted)] mt-0.5">{hint}</div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {auto ? (
          <span className="text-[10px] uppercase tracking-widest text-[var(--fg-muted)]">
            auto
          </span>
        ) : null}
        {onChange ? (
          <div className="flex items-center gap-1 rounded-lg border border-[var(--line)] bg-white px-2.5 h-9 focus-within:border-[var(--fg)] transition-colors">
            <span className="text-[var(--fg-muted)] text-sm">৳</span>
            <input
              type="text"
              inputMode="decimal"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="w-24 bg-transparent outline-none text-sm font-medium text-right tabular-nums"
            />
          </div>
        ) : (
          <span
            className={`text-sm font-semibold tabular-nums ${
              sign < 0 ? "text-rose-600" : ""
            }`}
          >
            {sign < 0 ? "−" : ""}
            {formatBDT(value)}
          </span>
        )}
      </div>
    </div>
  );
}

export default function AccountingPage() {
  const [range, setRange] = useState<DateRange>(defaultRange());
  const [reports, setReports] = useState<Reports | null>(null);
  const [overrides, setOverrides] = useState<Overrides>(ZERO_OVERRIDES);
  const [loading, setLoading] = useState(true);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load both reports + accounting overrides whenever the range changes
  useEffect(() => {
    let cancelled = false;
    const token = getAdminToken();
    if (!token) return;
    void (async () => {
      setLoading(true);
      try {
        const [r, a] = await Promise.all([
          api.reports({ from: range.from, to: range.to }, token),
          api.getAccounting({ from: range.from, to: range.to }, token),
        ]);
        if (cancelled) return;
        setReports(r);
        setOverrides({
          shippingCharged: a.item.shippingCharged,
          refunds: a.item.refunds,
          shippingExpense: a.item.shippingExpense,
          ads: a.item.ads,
          platformFees: a.item.platformFees,
          other: a.item.other,
        });
        setSavedAt(a.item.updatedAt);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to]);

  // Debounced upsert whenever overrides change (after the initial load)
  function patchOverride(patch: Partial<Overrides>) {
    setOverrides((prev) => {
      const next = { ...prev, ...patch };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const token = getAdminToken();
        if (!token) return;
        void api
          .saveAccounting({ from: range.from, to: range.to }, patch, token)
          .then(() => setSavedAt(new Date().toISOString()))
          .catch(() => {
            /* surface errors silently — value still set in UI */
          });
      }, 350);
      return next;
    });
  }

  const grossProfit = reports?.grossProfit ?? 0;
  const grossCost = reports?.grossCost ?? 0;
  const grossRevenue = reports?.grossRevenue ?? 0;

  // Money In = gross profit + shipping charged − refunds
  const moneyInTotal =
    grossProfit + overrides.shippingCharged - overrides.refunds;

  // Money Out = COGS + shipping out + ads + platform fees + other
  const expenseBreakdown = useMemo(
    () => [
      { key: "cogs", label: "Cost of goods sold", value: grossCost, color: "#0f172a" },
      {
        key: "shipping",
        label: "Shipping",
        value: overrides.shippingExpense,
        color: "#475569",
      },
      { key: "ads", label: "Ads", value: overrides.ads, color: "#0ea5e9" },
      {
        key: "platformFees",
        label: "Platform fees",
        value: overrides.platformFees,
        color: "#f59e0b",
      },
      { key: "other", label: "Other", value: overrides.other, color: "#a3a3a3" },
    ],
    [grossCost, overrides],
  );
  const moneyOutTotal = expenseBreakdown.reduce((n, r) => n + r.value, 0);

  const revenue = moneyInTotal;
  const expenses = moneyOutTotal;
  const netProfit = revenue - expenses;
  const margin = pct(netProfit, revenue);

  // KPI metrics
  const grossMarginRate = pct(grossProfit, grossRevenue);
  const refundRate = pct(overrides.refunds, grossRevenue);
  const adRoas = overrides.ads > 0 ? grossRevenue / overrides.ads : 0;

  const grossMarginStatus = statusFor("margin", grossMarginRate, grossRevenue > 0);
  const refundStatus = statusFor("refund", refundRate, grossRevenue > 0);
  const roasStatus = statusFor("roas", adRoas, overrides.ads > 0);

  // Profit summary bar segments
  const summaryBarMax = Math.max(revenue, expenses, 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <header className="mb-6">
        <span className="eyebrow">Admin</span>
        <h1 className="text-3xl font-semibold tracking-tight mt-2">Accounting</h1>
        <p className="text-sm text-[var(--fg-soft)] mt-1">
          {range.label.toLowerCase()} · live revenue + cost from orders, manual entries persist per range.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <DateRangePicker value={range} onChange={setRange} />
          {savedAt && (
            <span className="text-[11px] text-[var(--fg-muted)]">
              Saved · {new Date(savedAt).toLocaleString()}
            </span>
          )}
        </div>
      </header>

      {/* Top row — 4 metric cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Revenue" value={formatBDT(revenue)} hint="Money in total" />
        <MetricCard
          label="Expenses"
          value={formatBDT(expenses)}
          hint="Money out total"
        />
        <MetricCard
          label="Net profit"
          value={formatBDT(netProfit)}
          tone={netProfit < 0 ? "negative" : "positive"}
        />
        <MetricCard
          label="Profit margin"
          value={revenue > 0 ? `${(margin * 100).toFixed(1)}%` : "—"}
          tone={margin < 0 ? "negative" : margin >= 0.15 ? "positive" : undefined}
        />
      </div>

      {/* Money In / Money Out */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Section title="Money In" subtitle="Gross profit and other inflows">
          <MoneyRow
            key={`mi-gp-${range.from}-${range.to}-${grossProfit}`}
            label="Gross profit"
            value={grossProfit}
            auto
            hint="Revenue − cost of goods sold (auto from orders)"
          />
          <MoneyRow
            key={`mi-sc-${range.from}-${range.to}`}
            label="Shipping charged"
            value={overrides.shippingCharged}
            onChange={(v) => patchOverride({ shippingCharged: v })}
          />
          <MoneyRow
            key={`mi-rf-${range.from}-${range.to}`}
            label="Refunds"
            value={overrides.refunds}
            sign={-1}
            onChange={(v) => patchOverride({ refunds: v })}
            hint="Subtracted from money in"
          />
          <TotalRow label="Total money in" value={moneyInTotal} positive />
        </Section>

        <Section title="Money Out" subtitle="COGS and operating expenses">
          <MoneyRow
            key={`mo-cogs-${range.from}-${range.to}-${grossCost}`}
            label="Cost of goods sold"
            value={grossCost}
            auto
            hint="Sum of buyingPrice × qty across paid line items"
          />
          <MoneyRow
            key={`mo-ship-${range.from}-${range.to}`}
            label="Shipping"
            value={overrides.shippingExpense}
            onChange={(v) => patchOverride({ shippingExpense: v })}
          />
          <MoneyRow
            key={`mo-ads-${range.from}-${range.to}`}
            label="Ads"
            value={overrides.ads}
            onChange={(v) => patchOverride({ ads: v })}
            hint="Meta + Google + others"
          />
          <MoneyRow
            key={`mo-pf-${range.from}-${range.to}`}
            label="Platform fees"
            value={overrides.platformFees}
            onChange={(v) => patchOverride({ platformFees: v })}
          />
          <MoneyRow
            key={`mo-ot-${range.from}-${range.to}`}
            label="Other"
            value={overrides.other}
            onChange={(v) => patchOverride({ other: v })}
          />
          <TotalRow label="Total money out" value={moneyOutTotal} />
        </Section>
      </div>

      {/* Profit summary bar */}
      <section className="card-soft p-5 mb-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-semibold">Profit summary</h3>
          <span className="text-xs text-[var(--fg-muted)]">Revenue − Expenses = Net profit</span>
        </div>
        <div className="grid sm:grid-cols-3 gap-4 mb-4">
          <SummaryStat label="Revenue" value={formatBDT(revenue)} dotColor="#0f172a" />
          <SummaryStat label="Expenses" value={formatBDT(expenses)} dotColor="#dc2626" />
          <SummaryStat
            label="Net profit"
            value={formatBDT(netProfit)}
            dotColor={netProfit < 0 ? "#dc2626" : "#10b981"}
            highlight
          />
        </div>
        <div className="space-y-2">
          <BarRow
            label="Revenue"
            value={revenue}
            max={summaryBarMax}
            color="#0f172a"
          />
          <BarRow
            label="Expenses"
            value={expenses}
            max={summaryBarMax}
            color="#dc2626"
          />
          <BarRow
            label="Net profit"
            value={Math.max(netProfit, 0)}
            max={summaryBarMax}
            color={netProfit < 0 ? "#dc2626" : "#10b981"}
            negative={netProfit < 0}
            negativeValue={netProfit}
          />
        </div>
      </section>

      {/* Expense breakdown + transactions */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Section title="Expense breakdown" subtitle="Share of total money out">
          {moneyOutTotal === 0 ? (
            <div className="text-xs text-[var(--fg-muted)] py-6">
              No expenses recorded for this range yet.
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {expenseBreakdown.map((row) => {
                const share = pct(row.value, moneyOutTotal);
                return (
                  <div key={row.key}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: row.color }}
                        />
                        {row.label}
                      </span>
                      <span className="tabular-nums text-[var(--fg-soft)]">
                        {formatBDT(row.value)}{" "}
                        <span className="text-[var(--fg-muted)] text-xs">
                          ({(share * 100).toFixed(1)}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--bg-soft)] overflow-hidden">
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${share * 100}%`,
                          background: row.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section
          title="Recent transactions"
          subtitle={`${reports?.transactions?.length ?? 0} most recent in range`}
        >
          {loading ? (
            <div className="text-xs text-[var(--fg-muted)] py-6">Loading…</div>
          ) : !reports?.transactions?.length ? (
            <div className="text-xs text-[var(--fg-muted)] py-6">
              No transactions in this range.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {reports.transactions.map((t) => (
                <li key={t._id}>
                  <Link
                    href={`/admin/orders`}
                    className="flex items-center justify-between gap-3 py-3 hover:bg-[var(--bg-soft)] -mx-3 px-3 rounded-lg transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {t.orderNumber}
                        {t.customer?.name ? (
                          <span className="text-[var(--fg-soft)] font-normal">
                            {" "}· {t.customer.name}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-[var(--fg-muted)] mt-0.5 capitalize">
                        {formatDate(t.createdAt)} · {t.status} · {t.paymentMethod}
                      </div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums shrink-0">
                      {formatBDT(t.total)}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* Bottom KPI pills */}
      <div className="grid sm:grid-cols-3 gap-4">
        <KpiPill
          label="Gross margin"
          value={grossRevenue > 0 ? `${(grossMarginRate * 100).toFixed(1)}%` : "—"}
          status={grossMarginStatus}
          hint="Gross profit ÷ gross revenue"
        />
        <KpiPill
          label="Refund rate"
          value={grossRevenue > 0 ? `${(refundRate * 100).toFixed(1)}%` : "—"}
          status={refundStatus}
          hint="Refunds ÷ gross revenue"
        />
        <KpiPill
          label="Ad ROAS"
          value={overrides.ads > 0 ? `${adRoas.toFixed(2)}×` : "—"}
          status={roasStatus}
          hint="Gross revenue ÷ ad spend"
        />
      </div>
    </motion.div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
      ? "text-rose-600"
      : "";
  return (
    <div className="card-soft p-5">
      <div className="text-xs uppercase tracking-wider text-[var(--fg-muted)]">
        {label}
      </div>
      <div className={`text-3xl font-semibold tracking-tight mt-2 tabular-nums ${toneClass}`}>
        {value}
      </div>
      {hint && (
        <div className="text-xs text-[var(--fg-muted)] mt-2">{hint}</div>
      )}
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-soft p-5">
      <header className="mb-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle && (
          <p className="text-[11px] text-[var(--fg-muted)] mt-0.5">{subtitle}</p>
        )}
      </header>
      {children}
    </section>
  );
}

function TotalRow({
  label,
  value,
  positive,
}: {
  label: string;
  value: number;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--line-strong)]">
      <span className="text-sm font-semibold">{label}</span>
      <span
        className={`text-base font-semibold tabular-nums ${
          positive ? "text-emerald-600" : "text-[var(--fg)]"
        }`}
      >
        {formatBDT(value)}
      </span>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  dotColor,
  highlight,
}: {
  label: string;
  value: string;
  dotColor: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-4 ${
        highlight
          ? "bg-black text-white"
          : "bg-white border border-[var(--line)]"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: dotColor }}
        />
        <span
          className={`text-xs uppercase tracking-wider ${
            highlight ? "text-white/70" : "text-[var(--fg-muted)]"
          }`}
        >
          {label}
        </span>
      </div>
      <div className="text-2xl font-semibold tracking-tight mt-2 tabular-nums">
        {value}
      </div>
    </div>
  );
}

function BarRow({
  label,
  value,
  max,
  color,
  negative,
  negativeValue,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  negative?: boolean;
  negativeValue?: number;
}) {
  const width = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-[var(--fg-soft)] mb-1">
        <span>{label}</span>
        <span className="tabular-nums font-medium text-[var(--fg)]">
          {negative && negativeValue !== undefined
            ? formatBDT(negativeValue)
            : formatBDT(value)}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-[var(--bg-soft)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${width}%`, background: color }}
        />
      </div>
    </div>
  );
}

function KpiPill({
  label,
  value,
  status,
  hint,
}: {
  label: string;
  value: string;
  status: { label: string; tone: string } | null;
  hint?: string;
}) {
  return (
    <div className="card-soft p-5 flex items-center justify-between gap-4">
      <div>
        <div className="text-xs uppercase tracking-wider text-[var(--fg-muted)]">
          {label}
        </div>
        <div className="text-2xl font-semibold tracking-tight mt-2 tabular-nums">
          {value}
        </div>
        {hint && (
          <div className="text-[11px] text-[var(--fg-muted)] mt-1">{hint}</div>
        )}
      </div>
      {status && (
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full border ${TONE_CLASSES[status.tone]}`}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{
              background:
                status.tone === "emerald"
                  ? "#10b981"
                  : status.tone === "sky"
                  ? "#0ea5e9"
                  : "#f59e0b",
            }}
          />
          {status.label}
        </span>
      )}
    </div>
  );
}
