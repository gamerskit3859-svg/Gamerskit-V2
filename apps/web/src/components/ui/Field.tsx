import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

const base =
  "w-full bg-white border border-line rounded-[10px] px-3 py-2.5 text-sm text-foreground " +
  "placeholder:text-fg-muted transition-[border-color,box-shadow] duration-150 " +
  "focus:outline-none focus:border-foreground focus:ring-4 focus:ring-black/5 " +
  "disabled:bg-bg-soft disabled:text-fg-muted disabled:cursor-not-allowed";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

/**
 * Standard text input. Use inside a label/legend to provide accessible naming.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = "text", ...rest },
  ref,
) {
  return <input ref={ref} type={type} className={cn(base, className)} {...rest} />;
});

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, rows = 4, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(base, "resize-y", className)}
        {...rest}
      />
    );
  },
);

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, ...rest },
  ref,
) {
  return <select ref={ref} className={cn(base, "pr-8", className)} {...rest} />;
});

interface FieldLabelProps {
  htmlFor?: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
  className?: string;
}

/**
 * Pairs with `Input`/`Textarea`/`Select` to give consistent label styling.
 * Compose like:
 *
 *   <FieldLabel htmlFor="email">Email</FieldLabel>
 *   <Input id="email" type="email" />
 */
export function FieldLabel({ htmlFor, children, hint, required, className }: FieldLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "block text-xs font-medium tracking-wide text-fg-soft uppercase mb-1.5",
        className,
      )}
    >
      {children}
      {required && <span className="text-red-600 ml-0.5">*</span>}
      {hint && <span className="ml-2 normal-case tracking-normal text-fg-muted">({hint})</span>}
    </label>
  );
}
