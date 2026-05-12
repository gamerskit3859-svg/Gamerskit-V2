/**
 * Vercel Serverless Entrypoint
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
        initPromise = null; 
        throw err;
      }
    })();
  }
  
  return initPromise;
}

const app = createApp({
  beforeRoutes: async (req, res, next) => {
    // Skip DB init for OPTIONS preflight to speed up responses
    if (req.method === 'OPTIONS') {
      return next();
    }
    
    try {
      await initialize();
      next();
    } catch (err) {
      console.error("[api] Middleware init error:", err);
      next(err);
    }
  }
});

export default app;
