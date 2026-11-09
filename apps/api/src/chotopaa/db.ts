import mongoose, { type Connection } from "mongoose";
import { chotopaaConfig } from "./config.js";
import { registerChotopaaModels } from "./models.js";

/**
 * A second, separate MongoDB connection to ChotoPaa's database. GamersKit's
 * own models live on mongoose's default connection (src/db.ts) and are never
 * touched from here, and nothing in src/chotopaa uses that one.
 *
 * Opened lazily on the first ChotoPaa request, so GamersKit starts (and keeps
 * running) whether or not ChotoPaa's database is configured or reachable.
 * Read-only by design: no writes in this module, autoIndex/autoCreate off,
 * and the URI should be a user with only the `read` role.
 */

export class ChotopaaUnavailableError extends Error {
  status = 503;
  code = "CHOTOPAA_UNAVAILABLE";
}

let connection: Connection | null = null;
let connecting: Promise<Connection> | null = null;

/** Database names this connection must never read. */
const FOREIGN = /gamerskit|glowly/i;

/** "mongodb+srv://u:p@cluster0.x.net/gamerskit?…" → host part and database. */
function hostOf(uri: string): string {
  return uri
    .replace(/^mongodb(\+srv)?:\/\//, "")
    .replace(/^[^@/]*@/, "")
    .split(/[/?]/)[0]
    .toLowerCase();
}

function databaseOf(uri: string): string {
  const afterHost = uri.replace(/^mongodb(\+srv)?:\/\/[^/]*/, "");
  return afterHost.replace(/^\//, "").split("?")[0];
}

/**
 * Refuse to read GamersKit's (or Glowly's) data as if it were ChotoPaa's:
 * a database name that says so, or exactly GamersKit's own database
 * (same cluster and name as MONGODB_URI).
 */
export function assertChotopaaDatabase(uri: string, dbName: string): void {
  if (FOREIGN.test(dbName) || FOREIGN.test(databaseOf(uri))) {
    throw new ChotopaaUnavailableError("ChotoPaa's database setting names another app's database");
  }
  const own = process.env.MONGODB_URI ?? "";
  if (own && hostOf(own) === hostOf(uri) && (databaseOf(own) || "test") === dbName) {
    throw new ChotopaaUnavailableError("CHOTOPAA_MONGODB_URI points at GamersKit's own database");
  }
}

export async function getChotopaaDb(): Promise<Connection> {
  if (connection && connection.readyState === 1) return connection;

  if (!connecting) {
    const uri = chotopaaConfig.mongoUri();
    const dbName = chotopaaConfig.dbName();
    if (!uri) {
      throw new ChotopaaUnavailableError("CHOTOPAA_MONGODB_URI is not set");
    }
    assertChotopaaDatabase(uri, dbName);

    connecting = mongoose
      .createConnection(uri, {
        dbName,
        autoIndex: false,
        autoCreate: false,
        maxPoolSize: 5,
        minPoolSize: 0,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 15000,
        maxIdleTimeMS: 30000,
      })
      .asPromise()
      .then((conn) => {
        registerChotopaaModels(conn);
        connection = conn;
        return conn;
      })
      .catch((err) => {
        connecting = null;
        throw err;
      });
  }

  return connecting;
}

/** Tests only: drop the cached connection so the next call reconnects. */
export async function closeChotopaaDb(): Promise<void> {
  const conn = connection;
  connection = null;
  connecting = null;
  await conn?.close();
}
