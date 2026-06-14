import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "success" | "warning" | "info" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-bg-soft text-fg-soft border-line",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  info: "bg-sky-50 text-sky-700 border-sky-200",
  danger: "bg-red-50 text-red-700 border-red-200",
};

export interface PillProps {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}

/**
 * Inline status badge. Used for order statuses, KPI flags, role labels.
 */
export function Pill({ tone = "neutral", className, children }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
