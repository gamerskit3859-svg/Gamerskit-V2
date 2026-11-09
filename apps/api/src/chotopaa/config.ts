/**
 * Settings for the ChotoPaa read API (src/chotopaa). Read from process.env on
 * each call rather than at import, so tests can point it at their own
 * database. Nothing here is shared with GamersKit's own settings in env.ts.
 *
 *   CHOTOPAA_MONGODB_URI        ChotoPaa's Atlas cluster, as a READ-ONLY user
 *                               (built-in role `read` on the chotopaa db).
 *                               Unset = every /api/chotopaa route answers 503.
 *   CHOTOPAA_DB_NAME            database name (default "chotopaa")
 *   CHOTOPAA_CORS_ORIGINS       storefront origins, comma-separated
 *                               (default https://chotopaa.com,https://www.chotopaa.com)
 *   CHOTOPAA_STOCK_ENFORCEMENT  must equal ChotoPaa's STOCK_ENFORCEMENT
 *   CHOTOPAA_BKASH_NUMBER       must equal ChotoPaa's BKASH_NUMBER
 *   CHOTOPAA_CACHE_TTL_SECONDS  how long a response is served from memory (default 60)
 *   CHOTOPAA_PURGE_SECRET       shared with ChotoPaa's backend, which calls
 *                               POST /api/chotopaa/v1/cache/purge after every write
 */

const DEFAULT_ORIGINS = ["https://chotopaa.com", "https://www.chotopaa.com"];
const DEV_ORIGINS = ["http://localhost:3000", "http://localhost:3010"];

export const chotopaaConfig = {
  mongoUri: () => (process.env.CHOTOPAA_MONGODB_URI ?? "").trim(),
  dbName: () => (process.env.CHOTOPAA_DB_NAME ?? "").trim() || "chotopaa",

  corsOrigins: (): string[] => {
    const configured = (process.env.CHOTOPAA_CORS_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim().replace(/\/+$/, ""))
      .filter(Boolean);
    const origins = configured.length ? configured : DEFAULT_ORIGINS;
    return process.env.NODE_ENV === "production" ? origins : [...origins, ...DEV_ORIGINS];
  },

  // On unless exactly "false" — the same rule as ChotoPaa's config.js.
  stockEnforcement: () => process.env.CHOTOPAA_STOCK_ENFORCEMENT !== "false",
  bkashNumber: () => (process.env.CHOTOPAA_BKASH_NUMBER ?? "").trim(),

  cacheTtlMs: () => {
    const seconds = Number(process.env.CHOTOPAA_CACHE_TTL_SECONDS ?? 60);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 60_000;
  },
  purgeSecret: () => (process.env.CHOTOPAA_PURGE_SECRET ?? "").trim(),
};
