import { createRequire } from "module";
import express, { type Express, type RequestHandler } from "express";
import compression from "compression";
import morgan from "morgan";
import cors from "cors";

import { errorHandler, notFoundHandler } from "./lib/errors.js";

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

export interface CreateAppOptions {
  beforeRoutes?: RequestHandler;
}

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();
  
  // Important for Vercel and other proxies
  app.set("trust proxy", 1);

  // 1) CORS — Simplified for Vercel compatibility
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://gamerskit-frontend.vercel.app",
    "https://gamerskitbd.com",
    "https://www.gamerskitbd.com",
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin) || origin.endsWith(".vercel.app")) {
          callback(null, true);
        } else {
          console.warn(`[cors] Rejected origin: ${origin}`);
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
  app.use(morgan("tiny"));

  // 5) Rate limiting on /api/*. Health check stays unmetered.
  app.use(
    "/api/",
    rateLimit({
      windowMs: 60_000,
      max: 1000, 
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // Health probe.
  app.get("/health", (_req, res) => {
    res.json({ ok: true, ts: new Date().toISOString(), env: process.env.NODE_ENV });
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
  app.use("/api/orders", ordersRouter);
  app.use("/api/coupons", couponsRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/admin/users", adminUsersRouter);
  app.use("/api/fb", fbRouter);

  // 7) 404 + centralized JSON error handler.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
