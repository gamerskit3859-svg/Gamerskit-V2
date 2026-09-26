"use client";

import { cn } from "@/lib/cn";

export interface FilterTabOption<T extends string = string> {
  value: T;
  label: string;
  /** Rendered in brackets after the label. Omit to show the label alone. */
  count?: number;
}

/**
 * A horizontal strip of filter chips, one selected at a time.
 *
 * This started as the phone-only treatment of the order list's status filter
 * and is now what every breakpoint uses: the chips show the counts a <select>
 * could only reveal once opened, and switching between two statuses is one tap
 * instead of open-scan-pick. The strip scrolls sideways rather than wrapping,
 * so a long status list never pushes the table down the page.
 */
export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  label,
  className,
}: {
  options: ReadonlyArray<FilterTabOption<T>>;
  value: T;
  onChange: (next: T) => void;
  disabled?: boolean;
  /** Names the group for screen readers, e.g. "Filter by status". */
  label: string;
  className?: string;
}) {
  return (
    // A group of pressed/unpressed buttons rather than role="tablist": nothing
    // here is a tab panel, and aria-pressed is what actually describes a filter
    // that is currently on.
    <div
      role="group"
      aria-label={label}
      // `-mx-1 px-1` keeps a selected chip's ring from being clipped by the
      // scroll container it sits in.
      className={cn(
        "-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1",
        className,
      )}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-50",
              selected
                ? "border-black bg-black font-medium text-white"
                : "border-line-strong text-fg-soft hover:bg-bg-soft",
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn(
                  "ml-1.5 tabular-nums",
                  selected ? "text-white/70" : "text-fg-muted",
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
