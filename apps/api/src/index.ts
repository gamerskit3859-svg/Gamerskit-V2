import type { RequestHandler } from "express";

import { createApp } from "./app.js";
import { connectDb } from "./db.js";
import { env } from "./env.js";
import { ensureAdmin } from "./lib/auth.js";

/**
 * Cached DB connection promise. Shared across warm invocations of the same
 * Vercel serverless instance; re-runs on cold start. `connectDb()` is itself
 * idempotent so it's safe either way.
 */
let dbReady: Promise<void> | null = null;
function ensureDb(): Promise<void> {
  if (!dbReady) {
    dbReady = (async () => {
      await connectDb();
      await ensureAdmin();
    })();
    dbReady.catch((err) => {
      // Reset on failure so the next request can retry instead of being
      // stuck behind a permanently-rejected promise.
      console.error("[api] DB bootstrap failed:", err);
      dbReady = null;
    });
  }
  return dbReady;
}

/**
 * Lazy DB middleware. Runs before every route so the first request after a
 * cold start pays the connect cost (~100-500ms) and subsequent requests
 * no-op through the cached promise. Wired into `createApp` via the
 * `beforeRoutes` option so it sits between the platform middleware (CORS,
 * helmet, body parsers, rate limit, health) and the route handlers.
 */
const ensureDbMiddleware: RequestHandler = async (_req, _res, next) => {
  try {
    await ensureDb();
    next();
  } catch (err) {
    next(err);
  }
};

const app = createApp({ beforeRoutes: ensureDbMiddleware });

// Local development: start the long-running HTTP server.
// On Vercel we skip `.listen()` — the platform invokes the exported default
// app as a serverless handler per request.
if (!process.env.VERCEL) {
  ensureDb()
    .then(() => {
      app.listen(env.PORT, () => {
        console.log(`[api] http://localhost:${env.PORT}`);
      });
    })
    .catch((err) => {
      console.error("[api] fatal", err);
      process.exit(1);
    });
}

export default app;
