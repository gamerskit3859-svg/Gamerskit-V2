/**
 * Vercel Serverless Entrypoint
 */

import { createApp } from "../dist/app.js";
import { connectDb } from "../dist/db.js";

// Cached DB connection state
let isInitialized = false;
let initPromise = null;

async function initialize() {
  if (isInitialized) return;
  
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await connectDb();
        isInitialized = true;
      } catch (err) {
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
      next(err);
    }
  }
});

export default app;
