"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { getAdminToken } from "@/lib/admin-token";
import { formatBDT, formatDate } from "@/lib/format";
import { Button, Card, Select } from "@/components/ui";
import { cn } from "@/lib/cn";

type PeriodView = "monthly" | "yearly";
interface Period {
  view: PeriodView;
  month: number; // 0-11
  year: number;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function defaultPeriod(): Period {
  const now = new Date();
  return { view: "monthly", month: now.getMonth(), year: now.getFullYear() };
}

function periodRange(p: Period): { from: string; to: string; label: string } {
  if (p.view === "yearly") {
    return {
      from: `${p.year}-01-01`,
      to: `${p.year}-12-31`,
      label: String(p.year),
    };
  }
  const mm = String(p.month + 1).padStart(2, "0");
  const last = new Date(p.year, p.month + 1, 0).getDate();
  const dd = String(last).padStart(2, "0");
  return {
    from: `${p.year}-${mm}-01`,
    to: `${p.year}-${mm}-${dd}`,
    label: `${MONTHS[p.month]} ${p.year}`,
  };
}

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

interface CustomExpense {
  id: string;
  label: string;
  value: number;
}

interface Overrides {
  shippingCharged: number;
  refunds: number;
  shippingExpense: number;
  ads: number;
  salaries: number;
  other: number;
  customExpenses: CustomExpense[];
}

const ZERO_OVERRIDES: Overrides = {
  shippingCharged: 0,
  refunds: 0,
  shippingExpense: 0,
  ads: 0,
  salaries: 0,
  other: 0,
  customExpenses: [],
};

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ce_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Stable color cycle for custom expense bars (matches Tailwind violet/teal/rose tones).
const CUSTOM_COLORS = ["#8b5cf6", "#14b8a6", "#f43f5e", "#22c55e", "#eab308"];

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
    <div className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="text-sm text-foreground">{label}</div>
        {hint && (
          <div className="mt-0.5 text-[11px] text-fg-muted">{hint}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {auto ? (
          <span className="text-[10px] uppercase tracking-widest text-fg-muted">
            auto
          </span>
        ) : null}
        {onChange ? (
          <div className="flex h-9 items-center gap-1 rounded-lg border border-line bg-white px-2.5 transition-colors focus-within:border-foreground">
            <span className="text-sm text-fg-muted">৳</span>
            <input
              type="text"
              inputMode="decimal"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="w-24 bg-transparent text-right text-sm font-medium tabular-nums outline-none"
            />
          </div>
        ) : (
          <span
            className={cn(
              "text-sm font-semibold tabular-nums",
              sign < 0 && "text-rose-600",
            )}
          >
            {sign < 0 ? "−" : ""}
            {formatBDT(value)}
          </span>
        )}
      </div>
    </div>
  );
}

interface CustomMoneyRowProps {
  initialLabel: string;
  initialValue: number;
  onLabelChange: (next: string) => void;
  onValueChange: (next: number) => void;
  onRemove: () => void;
}

function CustomMoneyRow({
  initialLabel,
  initialValue,
  onLabelChange,
  onValueChange,
  onRemove,
}: CustomMoneyRowProps) {
  const [label, setLabel] = useState<string>(initialLabel);
  const [valueDraft, setValueDraft] = useState<string>(() => String(Math.round(initialValue)));

  function commitLabel() {
    const trimmed = label.replace(/\s+/g, " ").trim();
    if (trimmed !== initialLabel) onLabelChange(trimmed);
    setLabel(trimmed);
  }

  function commitValue() {
    const n = Number(valueDraft.replace(/[^0-9.-]/g, ""));
    const safe = Number.isFinite(n) && n >= 0 ? n : 0;
    if (safe !== initialValue) onValueChange(safe);
    setValueDraft(String(Math.round(safe)));
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <input
          type="text"
          value={label}
          placeholder="Expense name"
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="w-full border-b border-transparent bg-transparent text-sm font-medium text-foreground outline-none transition-colors placeholder:text-fg-muted focus:border-foreground"
          maxLength={120}
        />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex h-9 items-center gap-1 rounded-lg border border-line bg-white px-2.5 transition-colors focus-within:border-foreground">
          <span className="text-sm text-fg-muted">৳</span>
          <input
            type="text"
            inputMode="decimal"
            value={valueDraft}
            onChange={(e) => setValueDraft(e.target.value)}
            onBlur={commitValue}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="w-24 bg-transparent text-right text-sm font-medium tabular-nums outline-none"
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove expense"
          className="no-print inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-fg-muted transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default function AccountingPage() {
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const { from, to, label: periodLabel } = useMemo(() => periodRange(period), [period]);
  const [reports, setReports] = useState<Reports | null>(null);
  const [overrides, setOverrides] = useState<Overrides>(ZERO_OVERRIDES);
  // Track pending edits so an explicit Save can flush them. Keyed only by
  // dirty fields so we never overwrite a field the user didn't touch.
  const pendingPatchRef = useRef<Partial<Overrides>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveFlash, setSaveFlash] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  // Bumped each time overrides are fetched fresh from the DB. Used as part of
  // the MoneyRow `key` so each input row remounts with the loaded value
  // (otherwise the row's internal draft stays stuck at its initial 0).
  const [loadVersion, setLoadVersion] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Years offered in the picker — current year + 4 prior.
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => current - i);
  }, []);

  // Load both reports + accounting overrides whenever the period changes
  useEffect(() => {
    let cancelled = false;
    const token = getAdminToken();
    if (!token) return;
    void (async () => {
      setLoading(true);
      try {
        const [r, a] = await Promise.all([
          api.reports({ from, to }, token),
          api.getAccounting({ from, to }, token),
        ]);
        if (cancelled) return;
        setReports(r);
        setOverrides({
          shippingCharged: a.item.shippingCharged,
          refunds: a.item.refunds,
          shippingExpense: a.item.shippingExpense,
          ads: a.item.ads,
          salaries: a.item.salaries,
          other: a.item.other,
          customExpenses: a.item.customExpenses ?? [],
        });
        setSavedAt(a.item.updatedAt);
        setLoadVersion((v) => v + 1);
        pendingPatchRef.current = {};
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  // Debounced upsert. Accepts a flat patch or a producer function that derives
  // the patch from the previous overrides — the producer form is race-safe for
  // helpers that depend on the current customExpenses array.
  function patchOverride(
    patchOrProducer:
      | Partial<Overrides>
      | ((prev: Overrides) => Partial<Overrides>),
  ) {
    setOverrides((prev) => {
      const patch =
        typeof patchOrProducer === "function" ? patchOrProducer(prev) : patchOrProducer;
      const next = { ...prev, ...patch };
      pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const token = getAdminToken();
        if (!token) return;
        const flush = pendingPatchRef.current;
        pendingPatchRef.current = {};
        void api
          .saveAccounting({ from, to }, flush, token)
          .then(() => setSavedAt(new Date().toISOString()))
          .catch(() => {
            /* surface errors silently — value still set in UI */
          });
      }, 350);
      return next;
    });
  }

  function addCustomExpense() {
    patchOverride((prev) => ({
      customExpenses: [...prev.customExpenses, { id: newId(), label: "", value: 0 }],
    }));
  }

  function updateCustomExpense(
    id: string,
    patch: Partial<Pick<CustomExpense, "label" | "value">>,
  ) {
    patchOverride((prev) => ({
      customExpenses: prev.customExpenses.map((e) =>
        e.id === id ? { ...e, ...patch } : e,
      ),
    }));
  }

  function removeCustomExpense(id: string) {
    patchOverride((prev) => ({
      customExpenses: prev.customExpenses.filter((e) => e.id !== id),
    }));
  }

  async function saveNow() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const token = getAdminToken();
    if (!token) return;
    const flush = { ...overrides, ...pendingPatchRef.current };
    pendingPatchRef.current = {};
    setSaving(true);
    try {
      await api.saveAccounting({ from, to }, flush, token);
      setSavedAt(new Date().toISOString());
      setSaveFlash(`Saved ${periodLabel}`);
      setTimeout(() => setSaveFlash(null), 1800);
    } catch {
      setSaveFlash("Save failed");
      setTimeout(() => setSaveFlash(null), 2400);
    } finally {
      setSaving(false);
    }
  }

  function downloadPdf() {
    if (typeof window !== "undefined") window.print();
  }

  const grossProfit = reports?.grossProfit ?? 0;
  const grossCost = reports?.grossCost ?? 0;
  const grossRevenue = reports?.grossRevenue ?? 0;

  // Money In = top-line gross sales + shipping charged − refunds.
  // (Standard income-statement view: COGS is deducted on the Money Out side.)
  const moneyInTotal =
    grossRevenue + overrides.shippingCharged - overrides.refunds;

  // Money Out = COGS + shipping out + ads + salaries + other + (custom expenses)
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
        key: "salaries",
        label: "Salaries",
        value: overrides.salaries,
        color: "#f59e0b",
      },
      { key: "other", label: "Other", value: overrides.other, color: "#a3a3a3" },
      ...overrides.customExpenses.map((e, i) => ({
        key: `custom:${e.id}`,
        label: e.label.trim() || "Untitled",
        value: e.value,
        color: CUSTOM_COLORS[i % CUSTOM_COLORS.length],
      })),
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
      className="print-area"
    >
      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="block text-xs font-medium uppercase tracking-[0.18em] text-fg-soft">
              Admin
            </span>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Accounting</h1>
            <p className="mt-1 text-sm text-fg-soft">
              {periodLabel} · live revenue + cost from orders, manual entries persist per period.
            </p>
          </div>
          <div className="no-print flex items-center gap-2">
            <Button onClick={saveNow} disabled={saving} size="sm">
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button variant="secondary" onClick={downloadPdf} size="sm">
              Download PDF
            </Button>
          </div>
        </div>

        <div className="no-print mt-5 flex flex-wrap items-center gap-3">
          <div
            className="inline-flex rounded-full border border-line bg-bg-soft p-1"
            role="tablist"
            aria-label="View by"
          >
            {(["monthly", "yearly"] as const).map((v) => {
              const active = period.view === v;
              return (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setPeriod((p) => ({ ...p, view: v }))}
                  className={cn(
                    "h-7 rounded-full px-3 text-xs font-medium transition-colors",
                    active
                      ? "bg-foreground text-white"
                      : "text-fg-soft hover:text-foreground",
                  )}
                >
                  {v === "monthly" ? "Monthly" : "Yearly"}
                </button>
              );
            })}
          </div>

          {period.view === "monthly" && (
            <label className="inline-flex items-center gap-2 text-xs text-fg-soft">
              Month
              <Select
                className="h-9 py-0 text-sm"
                value={period.month}
                onChange={(e) =>
                  setPeriod((p) => ({ ...p, month: Number(e.target.value) }))
                }
              >
                {MONTHS.map((name, i) => (
                  <option key={name} value={i}>
                    {name}
                  </option>
                ))}
              </Select>
            </label>
          )}

          <label className="inline-flex items-center gap-2 text-xs text-fg-soft">
            Year
            <Select
              className="h-9 py-0 text-sm"
              value={period.year}
              onChange={(e) =>
                setPeriod((p) => ({ ...p, year: Number(e.target.value) }))
              }
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </label>

          {savedAt && (
            <span className="text-[11px] text-fg-muted">
              Saved · {new Date(savedAt).toLocaleString()}
            </span>
          )}
          {saveFlash && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
              {saveFlash}
            </span>
          )}
        </div>
      </header>

      {/* Top row — 4 metric cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Section title="Money In" subtitle="Gross sales and other inflows">
          <MoneyRow
            key={`mi-gs-${from}-${to}-${grossRevenue}`}
            label="Gross sales"
            value={grossRevenue}
            auto
            hint="Top-line revenue from orders (auto)"
          />
          <MoneyRow
            key={`mi-sc-${from}-${to}-${loadVersion}`}
            label="Shipping charged"
            value={overrides.shippingCharged}
            onChange={(v) => patchOverride({ shippingCharged: v })}
          />
          <MoneyRow
            key={`mi-rf-${from}-${to}-${loadVersion}`}
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
            key={`mo-cogs-${from}-${to}-${grossCost}`}
            label="Cost of goods sold"
            value={grossCost}
            auto
            hint="Sum of buyingPrice × qty across paid line items"
          />
          <MoneyRow
            key={`mo-ship-${from}-${to}-${loadVersion}`}
            label="Shipping"
            value={overrides.shippingExpense}
            onChange={(v) => patchOverride({ shippingExpense: v })}
          />
          <MoneyRow
            key={`mo-ads-${from}-${to}-${loadVersion}`}
            label="Ads"
            value={overrides.ads}
            onChange={(v) => patchOverride({ ads: v })}
            hint="Meta + Google + others"
          />
          <MoneyRow
            key={`mo-sal-${from}-${to}-${loadVersion}`}
            label="Salaries"
            value={overrides.salaries}
            onChange={(v) => patchOverride({ salaries: v })}
          />
          <MoneyRow
            key={`mo-ot-${from}-${to}-${loadVersion}`}
            label="Other"
            value={overrides.other}
            onChange={(v) => patchOverride({ other: v })}
          />
          {overrides.customExpenses.map((e) => (
            <CustomMoneyRow
              key={`mo-custom-${e.id}-${loadVersion}`}
              initialLabel={e.label}
              initialValue={e.value}
              onLabelChange={(label) => updateCustomExpense(e.id, { label })}
              onValueChange={(value) => updateCustomExpense(e.id, { value })}
              onRemove={() => removeCustomExpense(e.id)}
            />
          ))}
          <button
            type="button"
            onClick={addCustomExpense}
            className="no-print mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-line px-3 text-xs font-medium text-fg-soft transition-colors hover:border-foreground hover:text-foreground"
          >
            <span aria-hidden="true">+</span> Add expense
          </button>
          <TotalRow label="Total money out" value={moneyOutTotal} />
        </Section>
      </div>

      <Card tone="soft" padding="md" className="mb-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Profit summary</h3>
          <span className="text-xs text-fg-muted">Revenue − Expenses = Net profit</span>
        </div>
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
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
      </Card>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Section title="Expense breakdown" subtitle="Share of total money out">
          {moneyOutTotal === 0 ? (
            <div className="py-6 text-xs text-fg-muted">
              No expenses recorded for this range yet.
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {expenseBreakdown.map((row) => {
                const share = pct(row.value, moneyOutTotal);
                return (
                  <div key={row.key}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: row.color }}
                        />
                        {row.label}
                      </span>
                      <span className="tabular-nums text-fg-soft">
                        {formatBDT(row.value)}{" "}
                        <span className="text-xs text-fg-muted">
                          ({(share * 100).toFixed(1)}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-bg-soft">
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
            <div className="py-6 text-xs text-fg-muted">Loading…</div>
          ) : !reports?.transactions?.length ? (
            <div className="py-6 text-xs text-fg-muted">
              No transactions in this period.
            </div>
          ) : (
            <ul className="divide-y divide-[color:var(--line)]">
              {reports.transactions.map((t) => (
                <li key={t._id}>
                  <Link
                    href={`/admin/orders`}
                    className="-mx-3 flex items-center justify-between gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-bg-soft"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {t.orderNumber}
                        {t.customer?.name ? (
                          <span className="font-normal text-fg-soft">
                            {" "}· {t.customer.name}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-[11px] capitalize text-fg-muted">
                        {formatDate(t.createdAt)} · {t.status} · {t.paymentMethod}
                      </div>
                    </div>
                    <div className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatBDT(t.total)}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
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
  return (
    <Card tone="soft" padding="md">
      <div className="text-xs uppercase tracking-wider text-fg-muted">{label}</div>
      <div
        className={cn(
          "mt-2 text-3xl font-semibold tracking-tight tabular-nums",
          tone === "positive" && "text-emerald-600",
          tone === "negative" && "text-rose-600",
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-2 text-xs text-fg-muted">{hint}</div>}
    </Card>
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
    <Card tone="soft" padding="md">
      <header className="mb-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-[11px] text-fg-muted">{subtitle}</p>
        )}
      </header>
      {children}
    </Card>
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
    <div className="mt-3 flex items-center justify-between border-t border-line-strong pt-3">
      <span className="text-sm font-semibold">{label}</span>
      <span
        className={cn(
          "text-base font-semibold tabular-nums",
          positive ? "text-emerald-600" : "text-foreground",
        )}
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
      className={cn(
        "rounded-xl p-4",
        highlight ? "bg-black text-white" : "border border-line bg-white",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: dotColor }}
        />
        <span
          className={cn(
            "text-xs uppercase tracking-wider",
            highlight ? "text-white/70" : "text-fg-muted",
          )}
        >
          {label}
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
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
      <div className="mb-1 flex items-center justify-between text-xs text-fg-soft">
        <span>{label}</span>
        <span className="font-medium tabular-nums text-foreground">
          {negative && negativeValue !== undefined
            ? formatBDT(negativeValue)
            : formatBDT(value)}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-bg-soft">
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
    <Card tone="soft" padding="md" className="flex items-center justify-between gap-4">
      <div>
        <div className="text-xs uppercase tracking-wider text-fg-muted">
          {label}
        </div>
        <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </div>
        {hint && <div className="mt-1 text-[11px] text-fg-muted">{hint}</div>}
      </div>
      {status && (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider",
            TONE_CLASSES[status.tone],
          )}
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
    </Card>
  );
}
