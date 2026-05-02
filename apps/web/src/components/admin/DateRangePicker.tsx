"use client";
import { useState, useEffect } from "react";

export type DateRange = { from: string; to: string; label: string };

const PRESETS: Array<{ key: string; label: string; days?: number; preset?: string }> = [
  { key: "today", label: "Today", days: 0 },
  { key: "yesterday", label: "Yesterday", preset: "yesterday" },
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "month", label: "This month", preset: "month" },
  { key: "lastMonth", label: "Last month", preset: "lastMonth" },
];

function isoDay(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
    .toISOString()
    .slice(0, 10);
}

function rangeFromPreset(preset: (typeof PRESETS)[number]): DateRange {
  const today = new Date();
  if (preset.key === "today") {
    return { from: isoDay(today), to: isoDay(today), label: preset.label };
  }
  if (preset.preset === "yesterday") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return { from: isoDay(y), to: isoDay(y), label: preset.label };
  }
  if (preset.preset === "month") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: isoDay(first), to: isoDay(today), label: preset.label };
  }
  if (preset.preset === "lastMonth") {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: isoDay(first), to: isoDay(last), label: preset.label };
  }
  // days-based
  const from = new Date(today);
  from.setDate(from.getDate() - (preset.days ?? 0));
  return { from: isoDay(from), to: isoDay(today), label: preset.label };
}

export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
}) {
  const [showCustom, setShowCustom] = useState(false);
  const [from, setFrom] = useState(value.from);
  const [to, setTo] = useState(value.to);

  useEffect(() => {
    void Promise.resolve().then(() => {
      setFrom(value.from);
      setTo(value.to);
    });
  }, [value.from, value.to]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => {
        const r = rangeFromPreset(p);
        const active = value.from === r.from && value.to === r.to;
        return (
          <button
            key={p.key}
            onClick={() => {
              setShowCustom(false);
              onChange(r);
            }}
            className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
              active
                ? "bg-black text-white border-black"
                : "border-[var(--line-strong)] text-[var(--fg-soft)] hover:text-[var(--fg)]"
            }`}
          >
            {p.label}
          </button>
        );
      })}
      <button
        onClick={() => setShowCustom((v) => !v)}
        className="px-3 py-1.5 rounded-full text-xs border border-[var(--line-strong)] hover:text-[var(--fg)] text-[var(--fg-soft)]"
      >
        Custom range
      </button>
      {showCustom && (
        <div className="flex items-center gap-2 ml-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="input !w-auto !py-1 !text-xs"
          />
          <span className="text-xs">to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="input !w-auto !py-1 !text-xs"
          />
          <button
            onClick={() => onChange({ from, to, label: "Custom" })}
            className="btn btn-primary !py-1 !px-3 !text-xs"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

export function defaultRange(): DateRange {
  return rangeFromPreset(PRESETS[2]); // last 7 days
}
