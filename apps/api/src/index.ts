import express from "express";
import cors from "cors";
import morgan from "morgan";
import compression from "compression";
import { createRequire } from "module";

import { env } from "./env.js";
import { connectDb } from "./db.js";
import { ensureAdmin } from "./lib/auth.js";

// Use require for CommonJS modules to ensure proper type resolution
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

async function main() {
  await connectDb();
  await ensureAdmin();

  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: false }));

  // Build a CORS allowlist from CORS_ORIGIN (comma-separated). We support:
  //   - exact origins:   https://gamerskit-frontend.vercel.app
  //   - regex literals:  /^https:\/\/gamerskit-frontend-[\w-]+\.vercel\.app$/
  //   - wildcard "*":    allow any origin (development convenience)
  // The Express `cors` middleware automatically handles preflight OPTIONS
  // requests against this allowlist. We keep `credentials: false` because the
  // frontend authenticates with `Authorization: Bearer <JWT>` headers, not
  // cookies — flip this back to true if cookie-based auth is ever added.
  type OriginEntry = string | RegExp;
  const allowlist: OriginEntry[] = env.CORS_ORIGIN.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      if (entry.startsWith("/") && entry.endsWith("/")) {
        return new RegExp(entry.slice(1, -1));
      }
      return entry;
    });
  const allowAny = allowlist.includes("*");

  app.use(
    cors({
      origin: (origin, callback) => {
        // Same-origin / curl / server-to-server requests have no Origin header.
        if (!origin) return callback(null, true);
        if (allowAny) return callback(null, true);
        const ok = allowlist.some((entry) =>
          typeof entry === "string" ? entry === origin : entry.test(origin),
        );
        // For disallowed origins we return `false` (no error) so the cors
        // middleware simply omits the `Access-Control-Allow-Origin` header.
        // The browser will reject the request cleanly, but we don't trip
        // Express's default error handler and avoid log spam from probes.
        return callback(null, ok);
      },
      credentials: false,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(compression());
  app.use(morgan("tiny"));

  const limiter = rateLimit({ windowMs: 60_000, max: 200 });
  app.use("/api/", limiter);

  app.get("/health", (_req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/hero-images", heroImagesRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/coupons", couponsRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/admin/users", adminUsersRouter);
  app.use("/api/fb", fbRouter);

  app.use((req, res) => {
    res.status(404).json({ error: "not found", path: req.path });
  });

  app.listen(env.PORT, () => {
    console.log(`[api] http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  console.error("[api] fatal", err);
  process.exit(1);
});
