import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Card } from "./Card";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  /** Sub-line under the value (e.g. percentage, comparison). */
  hint?: ReactNode;
  /** Optional badge to the right of the label (e.g. KPI status pill). */
  badge?: ReactNode;
  className?: string;
  /** Tone for the value text. `negative` flips it to red for losses. */
  tone?: "default" | "negative" | "positive";
  /** Show a placeholder while the value is loading. */
  loading?: boolean;
}

/**
 * Compact metric card. Used across the admin dashboard, reports, accounting,
 * and the storefront's account page summary cards.
 */
export function StatCard({
  label,
  value,
  hint,
  badge,
  className,
  tone = "default",
  loading,
}: StatCardProps) {
  return (
    <Card padding="sm" className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-fg-soft">
          {label}
        </p>
        {badge}
      </div>
      <p
        className={cn(
          // Capped at 2xl: these cards sit in a 3-to-6 column grid, and a
          // six-figure taka amount at 3xl needs ~180px of text room, which
          // that grid never gives once the 260px admin sidebar is on screen.
          "break-words text-xl font-semibold tracking-tight tabular-nums sm:text-2xl",
          tone === "negative" && "text-red-600",
          tone === "positive" && "text-emerald-600",
        )}
      >
        {loading ? "…" : value}
      </p>
      {hint && <p className="text-xs text-fg-muted">{hint}</p>}
    </Card>
  );
}
