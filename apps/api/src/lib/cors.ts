import type { RequestHandler } from "express";
import cors from "cors";

import { env } from "../env.js";

/**
 * Each CORS allowlist entry is either an exact origin string
 * (e.g. `https://gamerskit-frontend.vercel.app`) or a regex (used to match
 * Vercel preview deployments like
 * `https://gamerskit-frontend-abc123.vercel.app`).
 */
type AllowEntry = string | RegExp;

/**
 * The exact callback signature that the `cors` package expects. Typing this
 * explicitly (rather than letting `(err: any, allow: any) => void` flow
 * through) keeps the origin function strictly typed end to end.
 */
type CorsOriginCallback = (err: Error | null, allow?: boolean) => void;
type CorsOriginFn = (
  requestOrigin: string | undefined,
  callback: CorsOriginCallback,
) => void;

/**
 * Parse a comma-separated CORS_ORIGIN string into an allowlist.
 *
 *   - Plain origins:  "https://gamerskit-frontend.vercel.app"
 *   - JS regex:       "/^https:\\/\\/gamerskit-frontend-[\\w-]+\\.vercel\\.app$/"
 *   - Wildcard:       "*"  (allow any origin — convenience for dev)
 *
 * Empty entries are dropped. Whitespace around each entry is trimmed.
 */
export function parseAllowlist(raw: string): {
  entries: AllowEntry[];
  allowAny: boolean;
} {
  const entries: AllowEntry[] = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      if (entry.startsWith("/") && entry.endsWith("/")) {
        return new RegExp(entry.slice(1, -1));
      }
      return entry;
    });
  return { entries, allowAny: entries.includes("*") };
}

/**
 * Build the CORS middleware. Splitting this out of `app.ts` keeps the
 * production allowlist policy in one well-tested place.
 *
 * Behavior:
 *   - Requests with no `Origin` header (curl, server-to-server, health
 *     probes) are always allowed.
 *   - The wildcard "*" entry in CORS_ORIGIN allows any browser origin.
 *   - Otherwise the request origin must match either a string entry exactly
 *     or one of the configured regex patterns.
 *   - Rejected origins are logged once per request (no log spam from the
 *     happy path) and the response simply omits the
 *     `Access-Control-Allow-Origin` header. The browser blocks the response
 *     client-side, but we don't trip Express's default error handler — so
 *     handlers downstream can never run, can never crash, and can never
 *     send a 5xx response missing CORS headers.
 *
 * The middleware also auto-handles preflight `OPTIONS` requests against the
 * same allowlist (provided by the underlying `cors` package).
 *
 * `credentials` is intentionally `false`: the frontend authenticates with
 * `Authorization: Bearer <JWT>` headers, not cookies. Flip back to `true`
 * if cookie-based auth is ever added.
 */
export function buildCorsMiddleware(): RequestHandler {
  const { entries, allowAny } = parseAllowlist(env.CORS_ORIGIN);

  if (entries.length === 0) {
    console.warn(
      "[cors] CORS_ORIGIN is empty — no browser origins will be allowed. " +
        "Set CORS_ORIGIN in your environment (see apps/api/.env.example).",
    );
  } else {
    console.log(
      `[cors] allowlist: ${entries
        .map((e) => (typeof e === "string" ? e : `regex(${e.source})`))
        .join(", ")}`,
    );
  }

  const originFn: CorsOriginFn = (requestOrigin, callback) => {
    if (!requestOrigin) return callback(null, true);
    if (allowAny) return callback(null, true);

    const ok = entries.some((entry) =>
      typeof entry === "string"
        ? entry === requestOrigin
        : entry.test(requestOrigin),
    );

    if (!ok) {
      console.warn(`[cors] rejected origin: ${requestOrigin}`);
    }
    return callback(null, ok);
  };

  return cors({
    origin: originFn,
    credentials: false,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Requested-With"],
    optionsSuccessStatus: 204,
    maxAge: 600,
  });
}
