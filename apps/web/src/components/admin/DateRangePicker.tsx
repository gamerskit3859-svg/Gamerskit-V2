"use client";
import { useState, useEffect } from "react";
import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/cn";

export type DateRange = { from: string; to: string; label: string };

const PRESETS: Array<{
  key: string;
  label: string;
  days?: number;
  preset?: string;
}> = [
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
            type="button"
            onClick={() => {
              setShowCustom(false);
              onChange(r);
            }}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs transition-colors",
              active
                ? "border-black bg-black text-white"
                : "border-line-strong text-fg-soft hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => setShowCustom((v) => !v)}
        className="rounded-full border border-line-strong px-3 py-1.5 text-xs text-fg-soft hover:text-foreground"
      >
        Custom range
      </button>
      {showCustom && (
        <div className="ml-2 flex items-center gap-2">
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="!w-auto !py-1 !text-xs"
          />
          <span className="text-xs">to</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="!w-auto !py-1 !text-xs"
          />
          <Button
            size="sm"
            onClick={() => onChange({ from, to, label: "Custom" })}
            className="!py-1 !px-3 !text-xs"
          >
            Apply
          </Button>
        </div>
      )}
    </div>
  );
}

export function defaultRange(): DateRange {
  return rangeFromPreset(PRESETS[2]); // last 7 days
}
