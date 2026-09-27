import { TIMEZONE } from "../../lib/timezone.js";
import type { ResolvedPeriod } from "../period.js";

/** How a resolved period is echoed back to the model, so it can state the window. */
export function periodInfo(resolved: ResolvedPeriod) {
  return {
    name: resolved.period,
    from: resolved.from,
    to: resolved.to,
    timezone: TIMEZONE,
  };
}

/** Where admins edit products. The page has no per-product deep link. */
export const ADMIN_PRODUCTS_PATH = "/admin/products";
