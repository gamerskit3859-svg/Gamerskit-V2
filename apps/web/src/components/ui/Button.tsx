import Link from "next/link";
import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "glass-dark";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-tight whitespace-nowrap " +
  "border border-transparent transition-[transform,background,color,box-shadow] duration-200 " +
  "hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
  "focus-visible:ring-foreground focus-visible:ring-offset-background " +
  "disabled:opacity-50 disabled:pointer-events-none disabled:translate-y-0";

const variants: Record<Variant, string> = {
  primary: "bg-black text-white hover:bg-[#1d1d1f]",
  secondary: "bg-white text-black border-line-strong hover:bg-bg-soft",
  ghost: "bg-transparent text-foreground border-line-strong hover:bg-bg-soft",
  "glass-dark":
    "text-white border-white/30 bg-[rgba(20,20,22,0.55)] backdrop-blur-md backdrop-saturate-180 " +
    "hover:bg-[rgba(20,20,22,0.7)]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[13px]",
  md: "h-11 px-5 text-[15px]",
  lg: "h-12 px-7 text-[15px]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Render as an icon-only round button (square aspect, no horizontal padding). */
  iconOnly?: boolean;
}

/**
 * Apple-style pill button. Use `as Link` via the `LinkButton` companion to
 * render as a Next.js Link without losing the typed props.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", iconOnly, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        base,
        variants[variant],
        sizes[size],
        iconOnly && "aspect-square px-0",
        className,
      )}
      {...rest}
    />
  );
});

export interface LinkButtonProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "color"> {
  href: string;
  variant?: Variant;
  size?: Size;
  iconOnly?: boolean;
  children?: ReactNode;
}

/**
 * Same styling as `<Button>` but renders as a Next.js `<Link>`. Use for
 * navigation; use `<Button>` for actions.
 */
export const LinkButton = forwardRef<HTMLAnchorElement, LinkButtonProps>(
  function LinkButton(
    { variant = "primary", size = "md", iconOnly, className, href, ...rest },
    ref,
  ) {
    return (
      <Link
        ref={ref}
        href={href}
        className={cn(
          base,
          variants[variant],
          sizes[size],
          iconOnly && "aspect-square px-0",
          className,
        )}
        {...rest}
      />
    );
  },
);
