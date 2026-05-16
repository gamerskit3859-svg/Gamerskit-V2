"use client";

import Link from "next/link";
import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "glass-dark";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg md:rounded-full font-semibold tracking-tight whitespace-nowrap " +
  "transition-all duration-200 ease-out select-none " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 " +
  "active:scale-[0.98] " +
  "disabled:opacity-40 disabled:pointer-events-none disabled:transform-none";

const variants: Record<Variant, string> = {
  primary: "bg-neutral-950 text-white border border-transparent hover:bg-neutral-800",
  secondary: "bg-white text-neutral-950 border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300",
  ghost: "bg-transparent text-neutral-800 hover:bg-neutral-100 hover:text-neutral-950",
  "glass-dark":
    "text-white border border-neutral-800/30 bg-neutral-950/80 backdrop-blur-md " +
    "hover:bg-neutral-950",

};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-xs tracking-wide",
  md: "h-11 px-6 text-sm",
  lg: "h-13 px-8 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Render as an icon-only round button (square aspect, no horizontal padding). */
  iconOnly?: boolean;
}

/**
 * Premium minimalist pill button. Use `as Link` via the `LinkButton` companion to
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
        iconOnly && "aspect-square p-0",
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
          iconOnly && "aspect-square p-0",
          className,
        )}
        {...rest}
      />
    );
  },
);

export default Button;