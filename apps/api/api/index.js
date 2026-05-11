/**
 * Vercel Serverless Entrypoint
 *
 * This file is located at apps/api/api/index.js.
 * Vercel will pick this up as the handler for the backend.
 */

import { createApp } from "../dist/app.js";
import { connectDb } from "../dist/db.js";
import { ensureAdmin } from "../dist/lib/auth.js";

// Cached DB connection and bootstrap state
let isInitialized = false;
let initPromise = null;

async function initialize() {
  if (isInitialized) return;
  
  if (!initPromise) {
    initPromise = (async () => {
      try {
        console.log("[api] Initializing serverless handler...");
        await connectDb();
        await ensureAdmin();
        isInitialized = true;
        console.log("[api] Initialization complete.");
      } catch (err) {
        console.error("[api] Initialization failed:", err);
        initPromise = null; // Allow retry on next request
        throw err;
      }
    })();
  }
  
  return initPromise;
}

// Initialize the app with a middleware that ensures DB connection
const app = createApp({
  beforeRoutes: async (req, res, next) => {
    try {
      await initialize();
      next();
    } catch (err) {
      next(err);
    }
  }
});

// Export the express app as the handler
export default app;
