import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "default" | "soft" | "outline";
type Padding = "none" | "sm" | "md" | "lg";

const tones: Record<Tone, string> = {
  default: "bg-white border border-line",
  soft: "bg-bg-soft border border-line",
  outline: "bg-transparent border border-line",
};

const paddings: Record<Padding, string> = {
  none: "p-0",
  sm: "p-4",
  md: "p-6",
  lg: "p-8 md:p-10",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  padding?: Padding;
  /** Rounded corner size — defaults to `lg` (Apple-style 22px). */
  rounded?: "sm" | "md" | "lg" | "xl";
}

const rounded: Record<NonNullable<CardProps["rounded"]>, string> = {
  sm: "rounded-[var(--radius-sm)]",
  md: "rounded-[var(--radius-md)]",
  lg: "rounded-[var(--radius-lg)]",
  xl: "rounded-[var(--radius-xl)]",
};

/**
 * Surface card. Replaces ad-hoc `bg-white border border-line rounded-...`
 * combinations and the legacy `.card-soft` class.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    tone = "default",
    padding = "md",
    rounded: r = "lg",
    className,
    ...rest
  },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(tones[tone], paddings[padding], rounded[r], className)}
      {...rest}
    />
  );
});
