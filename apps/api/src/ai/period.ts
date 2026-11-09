import { z } from "zod";
import {
  addDhakaCalendarDays,
  buildDhakaDateRangeFilter,
  dhakaDateKeysBetween,
  dhakaOrderDateKey,
  type DateRangeFilter,
} from "../lib/timezone.js";
import { AiToolError } from "./errors.js";

export const PERIODS = [
  "today",
  "yesterday",
  "last_7_days",
  "last_30_days",
  "this_month",
  "last_month",
  "this_year",
  "custom",
] as const;

export type Period = (typeof PERIODS)[number];

/** Longest custom range accepted, matching the dashboard's 370-day cap. */
const MAX_CUSTOM_DAYS = 370;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export type ResolvedPeriod = {
  period: Period;
  /** First Dhaka calendar day, inclusive (YYYY-MM-DD). */
  from: string;
  /** Last Dhaka calendar day, inclusive (YYYY-MM-DD). */
  to: string;
  /** createdAt filter: Dhaka midnight of `from` up to Dhaka midnight after `to`. */
  range: Required<DateRangeFilter>;
};

/** Zod fields shared by every tool that takes a period. */
export const periodFields = {
  period: z.enum(PERIODS),
  from: z.string().regex(DATE_KEY, "use YYYY-MM-DD").optional(),
  to: z.string().regex(DATE_KEY, "use YYYY-MM-DD").optional(),
};

/** The same fields as JSON Schema, for the tool definitions Claude sees. */
export const periodJsonSchema = {
  period: {
    type: "string",
    enum: [...PERIODS],
    description:
      'Time window in Asia/Dhaka. "this_month" and "this_year" run to today. Use "custom" with from/to for any other range.',
  },
  from: {
    type: "string",
    description: 'Only with period "custom": first day, inclusive, YYYY-MM-DD.',
  },
  to: {
    type: "string",
    description: 'Only with period "custom": last day, inclusive, YYYY-MM-DD.',
  },
} as const;

function monthStart(dayKey: string): string {
  return `${dayKey.slice(0, 7)}-01`;
}

function isRealDate(key: string): boolean {
  const date = new Date(`${key}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === key;
}

/**
 * Turn a named period into Dhaka calendar days and a UTC createdAt range.
 * "Today" is today in Dhaka, not on the server clock — at 01:00 Dhaka time
 * (19:00 UTC the previous day) "today" is still the Dhaka date.
 */
export function resolvePeriod(
  input: { period: Period; from?: string; to?: string },
  now = new Date(),
): ResolvedPeriod {
  const today = dhakaOrderDateKey(now);
  let from: string;
  let to = today;

  switch (input.period) {
    case "today":
      from = today;
      break;
    case "yesterday":
      from = to = addDhakaCalendarDays(today, -1);
      break;
    case "last_7_days":
      from = addDhakaCalendarDays(today, -6);
      break;
    case "last_30_days":
      from = addDhakaCalendarDays(today, -29);
      break;
    case "this_month":
      from = monthStart(today);
      break;
    case "last_month": {
      const lastOfPrevious = addDhakaCalendarDays(monthStart(today), -1);
      from = monthStart(lastOfPrevious);
      to = lastOfPrevious;
      break;
    }
    case "this_year":
      from = `${today.slice(0, 4)}-01-01`;
      break;
    case "custom": {
      if (!input.from || !input.to) {
        throw new AiToolError('period "custom" needs both from and to (YYYY-MM-DD).');
      }
      if (!isRealDate(input.from) || !isRealDate(input.to)) {
        throw new AiToolError("from/to must be real calendar dates (YYYY-MM-DD).");
      }
      if (input.from > input.to) throw new AiToolError("from must not be after to.");
      if (dhakaDateKeysBetween(input.from, input.to, MAX_CUSTOM_DAYS + 1).length > MAX_CUSTOM_DAYS) {
        throw new AiToolError(`custom ranges are limited to ${MAX_CUSTOM_DAYS} days.`);
      }
      from = input.from;
      to = input.to;
      break;
    }
  }

  const range = buildDhakaDateRangeFilter(from, to) as Required<DateRangeFilter>;
  return { period: input.period, from, to, range };
}

