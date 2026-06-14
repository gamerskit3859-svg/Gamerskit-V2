export const TIMEZONE = "Asia/Dhaka";
export const DHAKA_UTC_OFFSET_MINUTES = 6 * 60;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type DateRangeFilter = {
  $gte?: Date;
  $lt?: Date;
};

function parseDateParts(value: string): { year: number; month: number; day: number } {
  const match = DATE_RE.exec(value);
  if (!match) throw new Error(`Invalid date: ${value}`);
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function dhakaDayStartUtc(value: string): Date {
  const { year, month, day } = parseDateParts(value);
  return new Date(
    Date.UTC(year, month - 1, day, 0, -DHAKA_UTC_OFFSET_MINUTES, 0, 0),
  );
}

export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function addDhakaCalendarDays(dayKey: string, days: number): string {
  const { year, month, day } = parseDateParts(dayKey);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function dhakaDateKeysBetween(
  from: string,
  to: string,
  maxDays = 370,
): string[] {
  const start = dhakaDateToKey(from);
  const end = dhakaDateToKey(to);
  const keys: string[] = [];
  for (let key = start; key <= end && keys.length < maxDays; key = addDhakaCalendarDays(key, 1)) {
    keys.push(key);
  }
  return keys;
}

export function buildDhakaDateRangeFilter(
  from?: string,
  to?: string,
): DateRangeFilter | undefined {
  if (!from && !to) return undefined;
  const range: DateRangeFilter = {};
  if (from) range.$gte = dhakaDayStartUtc(from);
  if (to) range.$lt = addUtcDays(dhakaDayStartUtc(to), 1);
  return range;
}

export function dhakaDateToKey(value: string): string {
  const { year, month, day } = parseDateParts(value);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function dhakaOrderDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
