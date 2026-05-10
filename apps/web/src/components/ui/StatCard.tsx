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
}: StatCardProps) {
  return (
    <Card padding="md" className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-fg-soft uppercase">
          {label}
        </p>
        {badge}
      </div>
      <p
        className={cn(
          "text-2xl md:text-3xl font-semibold tracking-tight",
          tone === "negative" && "text-red-600",
          tone === "positive" && "text-emerald-600",
        )}
      >
        {value}
      </p>
      {hint && <p className="text-xs text-fg-muted">{hint}</p>}
    </Card>
  );
}
