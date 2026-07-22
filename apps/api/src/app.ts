import { createRequire } from "node:module";
import express, { type Express, type Request, type RequestHandler } from "express";
import compression from "compression";
import morgan from "morgan";
import cors from "cors";
import { env } from "./env.js";
import { connectDb } from "./db.js";

import { errorHandler, notFoundHandler } from "./lib/errors.js";
import { ensureAdmin } from "./lib/auth.js";

import productsRouter from "./routes/products.js";
import ordersRouter from "./routes/orders.js";
import authRouter from "./routes/auth.js";
import adminRouter from "./routes/admin.js";
import adminUsersRouter from "./routes/admin-users.js";
import couponsRouter from "./routes/coupons.js";
import categoriesRouter from "./routes/categories.js";
import heroImagesRouter from "./routes/hero-images.js";
import settingsRouter from "./routes/settings.js";
import fbRouter from "./routes/fb.js";
import steadfastRouter from "./routes/steadfast.js";
import feedRouter from "./routes/feed.js";
import goobliqueRouter from "./routes/gooblique/index.js";

const require = createRequire(import.meta.url);

type MiddlewareFactory<TOptions = Record<string, unknown>> = (
  options?: TOptions,
) => RequestHandler;

type HelmetOptions = {
  crossOriginResourcePolicy?: boolean;
  crossOriginOpenerPolicy?: boolean;
};

type RateLimitOptions = {
  windowMs: number;
  max?: number;
  limit?: number;
  skip?: (req: Request) => boolean;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
};

const helmetModule = require("helmet") as {
  default?: MiddlewareFactory<HelmetOptions>;
} & MiddlewareFactory<HelmetOptions>;
const helmet = helmetModule.default ?? helmetModule;

const rateLimitModule = require("express-rate-limit") as {
  default?: MiddlewareFactory<RateLimitOptions>;
  rateLimit?: MiddlewareFactory<RateLimitOptions>;
} & MiddlewareFactory<RateLimitOptions>;
const rateLimit =
  rateLimitModule.default ?? rateLimitModule.rateLimit ?? rateLimitModule;

function parseAllowedOrigins(): Array<string | RegExp> {
  const configured = env.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const defaults = [
    "http://localhost:3000",
    "http://localhost:3010",
    "http://localhost:5173",
    "https://gamerskit-frontend.vercel.app",
    "https://gamerskitbd.com",
    "https://www.gamerskitbd.com",
  ];
  const values = configured.length > 0 && env.CORS_ORIGIN !== "*" ? configured : defaults;
  return values.map((origin) => {
    if (origin.startsWith("/") && origin.endsWith("/")) {
      return new RegExp(origin.slice(1, -1));
    }
    return origin.replace(/\/+$/, "");
  });
}

export interface CreateAppOptions {
  beforeRoutes?: RequestHandler;
}

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();
  const isProduction = process.env.NODE_ENV === "production";
  
  // Important for Vercel and other proxies
  app.set("trust proxy", 1);

  // 1) CORS — Simplified for Vercel compatibility
  const allowedOrigins = parseAllowedOrigins();

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        
        const cleanOrigin = origin.replace(/\/+$/, "");
        const allowed = allowedOrigins.some((allowedOrigin) =>
          typeof allowedOrigin === "string"
            ? allowedOrigin === cleanOrigin
            : allowedOrigin.test(cleanOrigin),
        );

        if (allowed || (!isProduction && cleanOrigin.endsWith(".vercel.app"))) {
          callback(null, true);
        } else if (!isProduction) {
          console.warn(`[cors] Rejected origin: ${origin}`);
          callback(null, false);
        } else {
          callback(null, false);
        }
      },
      credentials: true,
      methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type", "X-Requested-With", "Accept"],
      optionsSuccessStatus: 204,
      preflightContinue: false,
    }),
  );

  // 2) Security headers.
  app.use(helmet({ 
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
  }));

  // 3) Body parsing.
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // 4) Response compression + request logging.
  app.use(compression());
  if (!isProduction) {
    app.use(morgan("tiny"));
  }

  // 5) Rate limiting on /api/*. Health check stays unmetered.
  app.use(
    "/api/",
    rateLimit({
      windowMs: 60_000,
      max: 1000,
      skip: (req: Request) => req.method === "OPTIONS",
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.use(
    "/api/auth/",
    rateLimit({
      windowMs: 15 * 60_000,
      max: 60,
      skip: (req: Request) => req.method === "OPTIONS",
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // Health probe.
  app.get("/", (_req, res) => {
    res.json({ ok: true, service: "gamerskit-api" });
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, ts: new Date().toISOString(), env: process.env.NODE_ENV });
  });

  app.get("/favicon.ico", (_req, res) => {
    res.status(204).end();
  });

  // 6) Optional pre-route hook.
  if (options.beforeRoutes) {
    app.use(options.beforeRoutes);
  }

  // 7) Routes.
  app.use("/api/auth", authRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/hero-images", heroImagesRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/coupons", couponsRouter);
  app.use("/api/admin/steadfast", steadfastRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/admin/users", adminUsersRouter);
  app.use("/api/fb", fbRouter);
  app.use("/api/feed", feedRouter);
  app.use("/api/v1/gooblique", goobliqueRouter);

  // 7) 404 + centralized JSON error handler.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

let serverlessInitPromise: Promise<void> | null = null;

async function initializeServerlessApp() {
  if (!serverlessInitPromise) {
    serverlessInitPromise = (async () => {
      await connectDb();
      await ensureAdmin();
    })().catch((err) => {
      serverlessInitPromise = null;
      throw err;
    });
  }

  await serverlessInitPromise;
}

const serverlessApp = createApp({
  beforeRoutes: async (req, _res, next) => {
    if (req.method === "OPTIONS") {
      next();
      return;
    }

    try {
      await initializeServerlessApp();
      next();
    } catch (err) {
      next(err);
    }
  },
});

export default serverlessApp;
