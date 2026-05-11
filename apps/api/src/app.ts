import { createRequire } from "module";

import express, { type Express, type RequestHandler } from "express";
import compression from "compression";
import morgan from "morgan";

import { buildCorsMiddleware } from "./lib/cors.js";
import { errorHandler, notFoundHandler } from "./lib/errors.js";

// `helmet` and `express-rate-limit` ship CommonJS bundles that don't expose a
// clean ESM default export for TypeScript. We pull them through createRequire
// so the types line up under "type": "module".
const require = createRequire(import.meta.url);
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

import productsRouter from "./routes/products.js";
import ordersRouter from "./routes/orders.js";
import authRouter from "./routes/auth.js";
import adminRouter from "./routes/admin.js";
import adminUsersRouter from "./routes/admin-users.js";
import couponsRouter from "./routes/coupons.js";
import categoriesRouter from "./routes/categories.js";
import heroImagesRouter from "./routes/hero-images.js";
import fbRouter from "./routes/fb.js";

/**
 * Build the Express application.
 *
 * Pulled into its own factory so the app can be:
 *   - exported as the default for Vercel's serverless runtime (no .listen)
 *   - imported by tests
 *   - started with .listen() locally from `index.ts`
 *
 * Middleware order matters here. We register in this sequence:
 *
 *   trust-proxy  ->  cors  ->  helmet  ->  json/url-encoded
 *                ->  compression  ->  morgan  ->  rate-limit  ->  routes
 *                ->  404  ->  error
 *
 * CORS goes FIRST (after `trust proxy`) so that even if a later middleware
 * throws (e.g. JSON parse error on a malformed body, helmet bailout, rate
 * limit kicking in), the response still carries the
 * `Access-Control-Allow-Origin` header that the browser needs to display
 * the error. Without that, the user only sees the cryptic "No
 * 'Access-Control-Allow-Origin' header is present" CORS error in DevTools
 * with no hint about the real failure.
 */
export interface CreateAppOptions {
  /**
   * Optional middleware that runs immediately before the route handlers
   * (e.g. ensuring a database connection on serverless cold starts).
   * Errors thrown here funnel into the centralized error handler with full
   * CORS headers preserved.
   */
  beforeRoutes?: RequestHandler;
}

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();
  app.set("trust proxy", 1);

  // 1) CORS — before anything else that might short-circuit the response.
  app.use(buildCorsMiddleware());

  // 2) Security headers.
  app.use(helmet({ crossOriginResourcePolicy: false }));

  // 3) Body parsing.
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // 4) Response compression + request logging.
  app.use(compression());
  app.use(morgan("tiny"));

  // 5) Rate limiting on /api/*. Health check stays unmetered.
  app.use(
    "/api/",
    rateLimit({
      windowMs: 60_000,
      max: 200,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // Health probe. Returns 200 + JSON even if the database is down.
  app.get("/health", (_req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() });
  });

  // 6) Optional pre-route hook (e.g. lazy DB connect for Vercel cold starts).
  if (options.beforeRoutes) {
    app.use(options.beforeRoutes);
  }

  // 7) Routes.
  app.use("/api/auth", authRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/hero-images", heroImagesRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/coupons", couponsRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/admin/users", adminUsersRouter);
  app.use("/api/fb", fbRouter);

  // 7) 404 + centralized JSON error handler. These two must be last so they
  //    catch anything the routes above didn't handle.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
