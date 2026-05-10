import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Width = "narrow" | "default" | "wide" | "full";
type Spacing = "none" | "sm" | "md" | "lg";

const widths: Record<Width, string> = {
  narrow: "max-w-[860px]",
  default: "max-w-[1280px]",
  wide: "max-w-[1440px]",
  full: "max-w-none",
};

const spacings: Record<Spacing, string> = {
  none: "py-0",
  sm: "py-6 md:py-10",
  md: "py-10 md:py-16",
  lg: "py-16 md:py-24",
};

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  width?: Width;
  spacing?: Spacing;
  /** Drop the horizontal padding — use when section is full-bleed. */
  flush?: boolean;
}

/**
 * Page section with consistent max-width + horizontal padding + vertical
 * rhythm. Replaces the recurring `px-5 lg:px-8 max-w-[1280px] mx-auto py-10
 * md:py-16` pattern.
 */
export const Section = forwardRef<HTMLElement, SectionProps>(function Section(
  { width = "default", spacing = "md", flush, className, ...rest },
  ref,
) {
  return (
    <section
      ref={ref}
      className={cn(
        "mx-auto w-full",
        widths[width],
        spacings[spacing],
        !flush && "px-5 lg:px-8",
        className,
      )}
      {...rest}
    />
  );
});
