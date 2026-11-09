import { timingSafeEqual } from "node:crypto";
import {
  Router,
  type ErrorRequestHandler,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import cors from "cors";
import { chotopaaConfig } from "./config.js";
import { cacheGet, cachePurge, cacheSet, cacheSize } from "./cache.js";
import { ChotopaaUnavailableError, getChotopaaDb } from "./db.js";
import * as services from "./services.js";
import { ChotopaaHttpError } from "./services.js";

/**
 * ChotoPaa's public catalogue API, served from GamersKit's VPS so the
 * storefront (chotopaa.com, on Vercel) browses without waiting on a
 * serverless cold start. Mounted at /api/chotopaa/v1 (app.ts).
 *
 * Read-only: every write — the admin dashboard, sign-in, checkout, orders —
 * stays on ChotoPaa's own backend. Paths, payloads and the response envelope
 * match ChotoPaa's /api/v1 exactly, so the storefront only swaps base URLs.
 *
 * Isolated from GamersKit: its own CORS list, its own database connection,
 * its own error format, and a failure here never reaches GamersKit's routes.
 */

export const CHOTOPAA_MOUNT = "/api/chotopaa/v1";

/** ChotoPaa's envelope: { success, message, meta?, data } (utils/sendResponse.js). */
function send(res: Response, message: string, data: unknown, meta?: unknown) {
  res.status(200).json({ success: true, message, ...(meta !== undefined ? { meta } : {}), data });
}

/** ChotoPaa's error envelope (errors/errorHandler.js). */
function sendError(
  res: Response,
  status: number,
  message: string,
  description: string,
  extra: { reason?: unknown; details?: Record<string, string> } = {},
) {
  res.status(status).json({
    success: false,
    message,
    error: { code: status, reason: extra.reason || undefined, description, details: extra.details },
  });
}

/**
 * ChotoPaa runs `hpp`, which keeps only the last of a repeated parameter;
 * Express 5 hands over arrays. Do the same so both servers read one value.
 */
function lastValues(query: Request["query"]): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(query).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[value.length - 1] : value,
    ]),
  );
}

type Handler = (req: Request) => Promise<{ message: string; data: unknown; meta?: unknown }>;

/**
 * Answer from the cache, or run the handler and cache a 200. The key is the
 * full URL, so every filter, page and seed is its own entry.
 */
function cached(handler: Handler): RequestHandler {
  return async (req, res, next) => {
    const key = req.originalUrl;
    const hit = cacheGet(key);
    if (hit) {
      res.status(hit.status).set("X-Cache", "HIT").type("application/json").send(hit.body);
      return;
    }
    try {
      const { message, data, meta } = await handler(req);
      const body = JSON.stringify({
        success: true,
        message,
        ...(meta !== undefined ? { meta } : {}),
        data,
      });
      cacheSet(key, 200, body, chotopaaConfig.cacheTtlMs());
      res.status(200).set("X-Cache", "MISS").type("application/json").send(body);
    } catch (err) {
      next(err);
    }
  };
}

const param = (req: Request, name: string) => String(req.params[name] ?? "");

function secretMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createChotopaaRouter(): Router {
  const router = Router();

  router.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        callback(null, chotopaaConfig.corsOrigins().includes(origin.replace(/\/+$/, "")));
      },
      methods: ["GET", "HEAD", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Accept"],
      optionsSuccessStatus: 204,
    }),
  );

  /* ------------------------------ Products ----------------------------- */
  router.get(
    "/products/featured",
    cached(async () => ({
      message: "Featured products fetched successfully",
      data: await services.getFeaturedProducts(),
    })),
  );
  router.get(
    "/products/new-arrivals",
    cached(async () => ({
      message: "New arrival products fetched successfully",
      data: await services.getNewArrivalProducts(),
    })),
  );
  router.get(
    "/products/top-sales",
    cached(async () => ({
      message: "Top sale products fetched successfully",
      data: await services.getTopSaleProducts(),
    })),
  );
  router.get(
    "/products",
    cached(async (req) => {
      const result = await services.getAllProducts(lastValues(req.query));
      return { message: "Products fetched successfully", data: result.data, meta: result.meta };
    }),
  );
  router.get(
    "/products/:id",
    cached(async (req) => ({
      message: "Product fetched successfully",
      data: await services.getSingleProduct(param(req, "id")),
    })),
  );

  /* ----------------------------- Categories ---------------------------- */
  router.get(
    "/categories",
    cached(async () => ({
      message: "Categories retrieved successfully",
      data: await services.getAllCategories(),
    })),
  );
  router.get(
    "/categories/:id",
    cached(async (req) => ({
      message: "Category retrieved successfully",
      data: await services.getSingleCategory(param(req, "id")),
    })),
  );

  /* ------------------------------- Brands ------------------------------ */
  router.get(
    "/brands",
    cached(async () => ({
      message: "Brands retrieved successfully",
      data: await services.getAllBrands(),
    })),
  );
  router.get(
    "/brands/:id",
    cached(async (req) => ({
      message: "Brand retrieved successfully",
      data: await services.getSingleBrand(param(req, "id")),
    })),
  );

  /* -------------------------------- Blogs ------------------------------ */
  router.get(
    "/blogs",
    cached(async (req) => {
      const result = await services.getAllBlogs(lastValues(req.query));
      return { message: "Blog posts retrieved successfully", data: result.data, meta: result.meta };
    }),
  );
  router.get(
    "/blogs/:id",
    cached(async (req) => ({
      message: "Blog post retrieved successfully",
      data: await services.getSingleBlog(param(req, "id")),
    })),
  );

  /* -------------------------- Home page pieces ------------------------- */
  router.get(
    "/hero",
    cached(async () => ({
      message: "Hero banner retrieved successfully",
      data: await services.getPublicBanner(),
    })),
  );
  router.get(
    "/settings",
    cached(async () => ({
      message: "Settings retrieved successfully",
      data: await services.getSettings(),
    })),
  );
  router.get(
    "/age-groups",
    cached(async () => ({
      message: "Age group tiles retrieved successfully",
      data: await services.getAgeGroups(),
    })),
  );
  router.get(
    "/videos",
    cached(async () => ({
      message: "Videos retrieved successfully",
      data: await services.getPublicVideos(),
    })),
  );

  /* ---------------------------- Operations ----------------------------- */

  // Not cached: says whether ChotoPaa's database is reachable right now.
  router.get("/health", async (_req, res) => {
    let database = false;
    try {
      database = (await getChotopaaDb()).readyState === 1;
    } catch {
      database = false;
    }
    res.status(database ? 200 : 503).json({
      success: database,
      service: "chotopaa-read-api",
      database,
      cacheEntries: cacheSize(),
    });
  });

  // ChotoPaa's backend calls this after every successful write. Disabled
  // (404) until CHOTOPAA_PURGE_SECRET is set.
  router.post("/cache/purge", (req, res) => {
    const secret = chotopaaConfig.purgeSecret();
    if (!secret) {
      sendError(res, 404, "Not found", "Cache purge is not enabled.");
      return;
    }
    const given = (req.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!secretMatches(given, secret)) {
      sendError(res, 401, "Unauthorized", "Wrong or missing purge token.");
      return;
    }
    send(res, "Cache purged", { purged: cachePurge() });
  });

  // Unknown paths under the mount: ChotoPaa's 404, not GamersKit's.
  router.use((req, res) => {
    sendError(
      res,
      404,
      `Route '${req.originalUrl}' not found for ${req.method} request`,
      `The requested route '${req.originalUrl}' with method '${req.method}' does not exist on this server.`,
    );
  });

  router.use(chotopaaErrorHandler);
  return router;
}

const DB_UNAVAILABLE = new Set([
  "MongoNetworkError",
  "MongooseServerSelectionError",
  "MongoServerSelectionError",
  "MongoNotConnectedError",
]);

/** The parts of ChotoPaa's errorHandler.js these read routes can hit. */
export const chotopaaErrorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ChotopaaHttpError) {
    sendError(res, err.status, err.message, err.description);
    return;
  }
  if (err?.name === "CastError") {
    sendError(
      res,
      400,
      `Invalid ${err.path}: ${err.value}`,
      `The provided ${err.path} value is not valid.`,
      {
        // ChotoPaa passes the CastError's own `reason` through (it serialises as {}).
        reason: err.reason,
        details: { [err.path]: `Invalid ${err.path}: ${err.value}` },
      },
    );
    return;
  }

  const unavailable = err instanceof ChotopaaUnavailableError || DB_UNAVAILABLE.has(err?.name);
  console.error(
    `[chotopaa] ${req.method} ${req.originalUrl} -> ${unavailable ? 503 : 500}`,
    err instanceof Error ? err.message : err,
  );
  if (unavailable) {
    sendError(
      res,
      503,
      "Database Connection Error",
      "Unable to connect to database. Check server/network.",
    );
    return;
  }
  sendError(res, 500, "Something went wrong", "An unexpected error occurred. Please try again later.");
};
