import type { ErrorRequestHandler, RequestHandler } from "express";

/**
 * Centralized 404 handler. Registered after every route so that unmatched
 * paths get a consistent JSON shape and the correct CORS headers (which the
 * `cors` middleware attaches before this handler runs).
 */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: "not found", path: req.path });
};

/**
 * Centralized error handler. Every thrown error in a route or middleware
 * funnels through here so that:
 *
 *   1. The client always gets a JSON body (never a default HTML 500).
 *   2. The CORS headers attached by the cors middleware survive — Express
 *      keeps them on the response object because we never re-create it,
 *      we just call `res.status().json()`.
 *   3. The server never crashes in front of a missing CORS header. Crashes
 *      here send 500 + json, with CORS, instead of an empty socket close.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const status = typeof err?.status === "number" ? err.status : 500;
  const code = typeof err?.code === "string" ? err.code : undefined;

  console.error(
    `[api] ${req.method} ${req.originalUrl} -> ${status}`,
    err instanceof Error ? err.message : err,
  );

  // Only include the stack trace in non-production environments.
  const isProd = process.env.NODE_ENV === "production";
  const stack =
    !isProd && err instanceof Error && err.stack ? err.stack.split("\n") : undefined;

  res.status(status).json({
    error: err?.message || "Internal Server Error",
    code,
    stack,
  });
};
