import type { RequestHandler } from "express";

/**
 * Set a Cache-Control header on a GET route so the response can be cached
 * by the browser and any CDN (e.g. Vercel's edge network) while keeping
 * mutations un-cached.
 *
 * Defaults:
 *   maxAge:                 60s    — browser cache window
 *   sMaxAge (CDN):          300s   — shared cache window
 *   staleWhileRevalidate:   600s   — serve stale while a revalidation runs
 *
 * Only `GET` and `HEAD` requests get the header so that we never accidentally
 * cache POST/PATCH/DELETE responses.
 */
export function cacheControl(
  options: {
    maxAge?: number;
    sMaxAge?: number;
    staleWhileRevalidate?: number;
  } = {},
): RequestHandler {
  const maxAge = options.maxAge ?? 60;
  const sMaxAge = options.sMaxAge ?? 300;
  const swr = options.staleWhileRevalidate ?? 600;
  const value = `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`;
  return (req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD") {
      res.setHeader("Cache-Control", value);
    }
    next();
  };
}
