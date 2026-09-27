import { describe, expect, it } from "vitest";
import { resolvePeriod } from "../../src/ai/period.js";
import { AiToolError } from "../../src/ai/errors.js";

// 01:30 on 28 Sep in Dhaka (UTC+6) — still 27 Sep on a UTC server clock.
const EARLY_MORNING_DHAKA = new Date("2026-09-27T19:30:00Z");

describe("resolvePeriod", () => {
  it("uses the Dhaka date for today, not the UTC date", () => {
    const p = resolvePeriod({ period: "today" }, EARLY_MORNING_DHAKA);
    expect(p.from).toBe("2026-09-28");
    expect(p.to).toBe("2026-09-28");
    // Dhaka midnight is 18:00 UTC the previous day.
    expect(p.range.$gte.toISOString()).toBe("2026-09-27T18:00:00.000Z");
    expect(p.range.$lt.toISOString()).toBe("2026-09-28T18:00:00.000Z");
  });

  it("resolves yesterday and rolling windows inclusively", () => {
    expect(resolvePeriod({ period: "yesterday" }, EARLY_MORNING_DHAKA)).toMatchObject({
      from: "2026-09-27",
      to: "2026-09-27",
    });
    expect(resolvePeriod({ period: "last_7_days" }, EARLY_MORNING_DHAKA)).toMatchObject({
      from: "2026-09-22",
      to: "2026-09-28",
    });
    expect(resolvePeriod({ period: "last_30_days" }, EARLY_MORNING_DHAKA)).toMatchObject({
      from: "2026-08-30",
      to: "2026-09-28",
    });
  });

  it("runs this_month and this_year up to today", () => {
    expect(resolvePeriod({ period: "this_month" }, EARLY_MORNING_DHAKA)).toMatchObject({
      from: "2026-09-01",
      to: "2026-09-28",
    });
    expect(resolvePeriod({ period: "this_year" }, EARLY_MORNING_DHAKA)).toMatchObject({
      from: "2026-01-01",
      to: "2026-09-28",
    });
  });

  it("handles last_month across a year boundary", () => {
    const p = resolvePeriod({ period: "last_month" }, new Date("2026-01-15T06:00:00Z"));
    expect(p).toMatchObject({ from: "2025-12-01", to: "2025-12-31" });
  });

  it("puts the month boundary at Dhaka midnight", () => {
    // 23:30 on 30 Sep UTC is already 1 Oct in Dhaka.
    const p = resolvePeriod({ period: "this_month" }, new Date("2026-09-30T23:30:00Z"));
    expect(p).toMatchObject({ from: "2026-10-01", to: "2026-10-01" });
  });

  it("accepts a valid custom range", () => {
    const p = resolvePeriod({ period: "custom", from: "2026-02-01", to: "2026-02-28" });
    expect(p).toMatchObject({ from: "2026-02-01", to: "2026-02-28" });
    expect(p.range.$gte.toISOString()).toBe("2026-01-31T18:00:00.000Z");
  });

  it.each([
    [{ period: "custom" as const }, /needs both/],
    [{ period: "custom" as const, from: "2026-02-30", to: "2026-03-01" }, /real calendar dates/],
    [{ period: "custom" as const, from: "2026-03-02", to: "2026-03-01" }, /not be after/],
    [{ period: "custom" as const, from: "2024-01-01", to: "2026-01-01" }, /limited to 370 days/],
  ])("rejects bad custom input %j", (input, message) => {
    expect(() => resolvePeriod(input)).toThrow(AiToolError);
    expect(() => resolvePeriod(input)).toThrow(message);
  });
});
