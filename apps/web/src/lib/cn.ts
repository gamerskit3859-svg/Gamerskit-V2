import clsx, { type ClassValue } from "clsx";

/**
 * Merge class lists. Thin wrapper around `clsx` so the entire
 * UI layer has a single, predictable className builder.
 */
export function cn(...values: ClassValue[]) {
  return clsx(values);
}
