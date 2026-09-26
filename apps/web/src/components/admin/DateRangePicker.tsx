"use client";
import { useState, useEffect } from "react";
import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/cn";

export type DateRange = {
  from: string;
  to: string;
  label: string;
  /** Preset this range came from, or "custom". Identifies the active chip. */
  key: string;
};
const TIMEZONE = "Asia/Dhaka";

const PRESETS: Array<{
  key: string;
  label: string;
  days?: number;
  preset?: string;
}> = [
  { key: "today", label: "Today", days: 0 },
  { key: "yesterday", label: "Yesterday", preset: "yesterday" },
  { key: "dayBefore", label: "Day before yesterday", preset: "dayBefore" },
  { key: "week", label: "This week", preset: "week" },
  { key: "lastWeek", label: "Last week", preset: "lastWeek" },
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
  { key: "month", label: "This month", preset: "month" },
  { key: "lastMonth", label: "Last month", preset: "lastMonth" },
  { key: "all", label: "All time" },
];

function dhakaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(day: string, days: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, date + days));
  return next.toISOString().slice(0, 10);
}

function monthStart(day: string): string {
  return `${day.slice(0, 8)}01`;
}

function lastMonthRange(day: string): { from: string; to: string } {
  const [year, month] = day.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 2, 1));
  const last = new Date(Date.UTC(year, month - 1, 0));
  return {
    from: first.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
  };
}

// Monday-to-Sunday week immediately before the one containing `day`.
function lastWeekRange(day: string): { from: string; to: string } {
  const currentWeekStart = weekStart(day);
  return {
    from: addDays(currentWeekStart, -7),
    to: addDays(currentWeekStart, -1),
  };
}

function weekStart(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const current = new Date(Date.UTC(year, month - 1, date));
  const daysSinceMonday = (current.getUTCDay() + 6) % 7;
  current.setUTCDate(current.getUTCDate() - daysSinceMonday);
  return current.toISOString().slice(0, 10);
}

function spanFromPreset(
  preset: (typeof PRESETS)[number],
  today: string,
): { from: string; to: string } {
  if (preset.key === "today") return { from: today, to: today };
  if (preset.preset === "yesterday") {
    const yesterday = addDays(today, -1);
    return { from: yesterday, to: yesterday };
  }
  if (preset.preset === "dayBefore") {
    const dayBefore = addDays(today, -2);
    return { from: dayBefore, to: dayBefore };
  }
  if (preset.preset === "week") return { from: weekStart(today), to: today };
  if (preset.preset === "lastWeek") return lastWeekRange(today);
  if (preset.preset === "month") return { from: monthStart(today), to: today };
  if (preset.preset === "lastMonth") return lastMonthRange(today);
  if (preset.key === "all") return { from: "1970-01-01", to: today };
  return { from: addDays(today, -(preset.days ?? 1) + 1), to: today };
}

function rangeFromPreset(preset: (typeof PRESETS)[number]): DateRange {
  return {
    ...spanFromPreset(preset, dhakaToday()),
    label: preset.label,
    key: preset.key,
  };
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
    <div className="w-full max-w-full">
      <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
      {PRESETS.map((p) => {
        const r = rangeFromPreset(p);
        const active = value.key === p.key;
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => {
              setShowCustom(false);
              onChange(r);
            }}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors",
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
        className={cn(
          "shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors",
          value.key === "custom"
            ? "border-black bg-black text-white"
            : "border-line-strong text-fg-soft hover:text-foreground",
        )}
      >
        Custom range
      </button>
      </div>
      {showCustom && (
        <div className="mt-2 flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="!w-full !py-1 !text-xs sm:!w-[140px]"
          />
          <span className="hidden text-xs sm:inline">to</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="!w-full !py-1 !text-xs sm:!w-[140px]"
          />
          <Button
            size="sm"
            onClick={() => onChange({ from, to, label: "Custom", key: "custom" })}
            className="!py-1 !px-3 !text-xs"
          >
            Apply
          </Button>
        </div>
      )}
    </div>
  );
}

/** Build the range for a named preset, e.g. presetRange("all"). */
export function presetRange(key: string): DateRange {
  return rangeFromPreset(PRESETS.find((p) => p.key === key) ?? PRESETS[0]);
}

/**
 * Whether `key` names a preset this picker still offers. Callers that restore a
 * saved range use it to tell a real preset from a stale or hand-edited one,
 * which presetRange would otherwise silently resolve to the first preset.
 */
export function isPresetKey(key: string): boolean {
  return PRESETS.some((p) => p.key === key);
}

export function defaultRange(): DateRange {
  // Keyed rather than indexed: inserting a preset above must not silently
  // change which range the admin dashboard opens on.
  return presetRange("week");
}
