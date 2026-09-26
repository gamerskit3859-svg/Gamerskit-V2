export function formatBDT(amount: number): string {
  return `৳${Math.round(amount).toLocaleString("en-BD")}`;
}

export function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString("en-US", {
    timeZone: "Asia/Dhaka",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 60 * 60_000],
  ["month", 30 * 24 * 60 * 60_000],
  ["day", 24 * 60 * 60_000],
  ["hour", 60 * 60_000],
  ["minute", 60_000],
];

/**
 * "2 hours ago" for a timestamp the admin scans rather than reads — how long
 * ago something happened is the question, and an exact clock time makes that a
 * subtraction. The full timestamp belongs in a title/tooltip alongside it.
 */
export function formatRelativeTime(d: string | Date): string {
  const then = new Date(d).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = then - Date.now();
  const abs = Math.abs(diff);
  if (abs < 60_000) return "just now";
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return "just now";
}

/**
 * A timestamp read at a glance rather than in full: the clock time alone for
 * something that happened today, the date as well for anything older. Used where
 * a row needs to show *when* without spending a table column on a full date.
 */
export function formatSmartDateTime(d: string | Date): string {
  const date = new Date(d);
  if (!Number.isFinite(date.getTime())) return "";
  // Compared as Dhaka calendar days, so "today" means today in the shop's
  // timezone and not in whichever one the browser happens to be in.
  const dhakaDay = (value: Date) =>
    value.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
  const sameDay = dhakaDay(date) === dhakaDay(new Date());
  return date.toLocaleString("en-US", {
    timeZone: "Asia/Dhaka",
    ...(sameDay ? {} : { month: "short", day: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateTime(d: string | Date): string {
  return new Date(d).toLocaleString("en-US", {
    timeZone: "Asia/Dhaka",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
