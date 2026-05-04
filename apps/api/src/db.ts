import mongoose from "mongoose";
import { env } from "./env.js";

let connected = false;

export async function connectDb(): Promise<typeof mongoose> {
  if (connected) return mongoose;
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI, {
    autoIndex: env.NODE_ENV !== "production",
  });
  connected = true;
  console.log(`[db] connected to ${mongoose.connection.host}/${mongoose.connection.name}`);
  await runMigrations();
  return mongoose;
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
    if (result.modifiedCount > 0) {
      console.log(
        `[db][migration] renamed platformFees -> salaries on ${result.modifiedCount} accountingoverrides`,
      );
    }
  } catch (err) {
    console.warn("[db][migration] non-fatal:", err);
  }
}
