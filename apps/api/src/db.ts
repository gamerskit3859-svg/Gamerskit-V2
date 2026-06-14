import mongoose from "mongoose";
import { env } from "./env.js";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & {
  __gamerskitMongoose?: MongooseCache;
};

const cached =
  globalForMongoose.__gamerskitMongoose ??
  (globalForMongoose.__gamerskitMongoose = { conn: null, promise: null });

export async function connectDb(): Promise<typeof mongoose> {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  mongoose.set("strictQuery", true);
  mongoose.set("bufferCommands", false);

  if (!cached.promise) {
    cached.promise = mongoose.connect(env.MONGODB_URI, {
      autoIndex: env.NODE_ENV !== "production",
      maxPoolSize: env.NODE_ENV === "production" ? 5 : 10,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 15000,
      maxIdleTimeMS: 30000,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }

  if (process.env.RUN_DB_MIGRATIONS === "true") {
    await runMigrations();
  }

  return cached.conn;
}

/**
 * One-shot, idempotent schema migrations that run once on every API boot.
 * Safe to keep around — each step is a no-op if it has already been applied.
 */
async function runMigrations(): Promise<void> {
  const conn = mongoose.connection;
  if (!conn.db) return;
  try {
    // accountingoverrides.platformFees -> salaries (rename only on docs that
    // still carry the old field).
    const result = await conn.db
      .collection("accountingoverrides")
      .updateMany(
        { platformFees: { $exists: true } },
        { $rename: { platformFees: "salaries" } },
      );
    if (result.modifiedCount > 0 && env.NODE_ENV !== "production") {
      console.info(
        `[db][migration] renamed platformFees -> salaries on ${result.modifiedCount} accountingoverrides`,
      );
    }
  } catch (err) {
    console.warn("[db][migration] non-fatal:", err);
  }
}
