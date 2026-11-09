/**
 * ChotoPaa's footwear vocabularies and size-chart rules, as the read API
 * needs them.
 *
 * MIRROR of chotopaa-backend (the source of truth):
 *   src/modules/product/footwear.attributes.js
 *   src/modules/product/product.attributes.js
 *   src/modules/product/size-chart.js
 * Change them there first, then here, then run the parity check
 * (chotopaa: deploy/read-api/compare-read-api.mjs).
 */

export const AGE_GROUPS = ["0-6m", "6-12m", "1-2y", "2-3y", "3-5y", "5-8y", "8-12y"] as const;
export const GENDERS = ["boy", "girl", "unisex"] as const;
export const SHOE_TYPES = [
  "pre-walker",
  "first-walker",
  "sandal",
  "sneaker",
  "boot",
  "school",
  "party",
] as const;
export const CLOSURES = ["velcro", "lace", "slip-on", "buckle"] as const;

/** The EU sizes the store sells. */
export const EU_SIZE_MIN = 16;
export const EU_SIZE_MAX = 38;

export interface SizeChartRow {
  euSize: number;
  ukSize: string;
  footLengthCm: number;
  ageGroup: string;
}

/** Standard kids' EU 16–38 — the Settings default when no chart is stored. */
export const DEFAULT_SIZE_CHART: readonly SizeChartRow[] = Object.freeze(
  (
    [
      [16, "0.5", 9.7, "0-6m"],
      [17, "1", 10.4, "0-6m"],
      [18, "2", 11.0, "6-12m"],
      [19, "3", 11.7, "6-12m"],
      [20, "4", 12.4, "1-2y"],
      [21, "5", 13.0, "1-2y"],
      [22, "5.5", 13.7, "1-2y"],
      [23, "6.5", 14.4, "2-3y"],
      [24, "7", 15.0, "2-3y"],
      [25, "8", 15.7, "3-5y"],
      [26, "8.5", 16.4, "3-5y"],
      [27, "9.5", 17.0, "3-5y"],
      [28, "10", 17.7, "5-8y"],
      [29, "11", 18.4, "5-8y"],
      [30, "12", 19.0, "5-8y"],
      [31, "12.5", 19.7, "5-8y"],
      [32, "13", 20.4, "8-12y"],
      [33, "1", 21.0, "8-12y"],
      [34, "2", 21.7, "8-12y"],
      [35, "2.5", 22.4, "8-12y"],
      [36, "3.5", 23.0, "8-12y"],
      [37, "4", 23.7, "8-12y"],
      [38, "5", 24.4, "8-12y"],
    ] as const
  ).map(([euSize, ukSize, footLengthCm, ageGroup]) =>
    Object.freeze({ euSize, ukSize, footLengthCm, ageGroup }),
  ),
);

/** Parse `?ageGroup=1-2y,2-3y` (or an array of them) into known values. */
export function parseListParam(raw: unknown, allowed: readonly string[]): string[] {
  const values = Array.isArray(raw) ? raw : String(raw ?? "").split(",");
  return [
    ...new Set(
      values
        .map((value) => String(value).trim().toLowerCase())
        .filter((value) => allowed.includes(value)),
    ),
  ];
}

/** Parse `?size=24,25` into EU sizes within the store's range. */
export function parseSizeParam(raw: unknown): number[] {
  const values = Array.isArray(raw) ? raw : String(raw ?? "").split(",");
  return [
    ...new Set(
      values
        .map((value) => Number(String(value).trim()))
        .filter(
          (value) => Number.isFinite(value) && value >= EU_SIZE_MIN && value <= EU_SIZE_MAX,
        ),
    ),
  ];
}

/** The chart that applies to a product: its own override, else the global one. */
export function resolveSizeChart<T>(product: { sizeChart?: unknown } | null, globalChart: T[] = []): T[] {
  const own = product?.sizeChart;
  return Array.isArray(own) && own.length ? (own as T[]) : globalChart;
}
