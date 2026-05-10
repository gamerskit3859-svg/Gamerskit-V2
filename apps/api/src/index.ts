import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import rateLimit from "express-rate-limit";

import { env } from "./env.js";
import { connectDb } from "./db.js";
import { ensureAdmin } from "./lib/auth.js";

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
  app.use(
    cors({
      origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(","),
      credentials: true,
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
