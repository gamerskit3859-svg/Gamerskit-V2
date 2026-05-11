/**
 * This file serves as the main entry point for the API package.
 * It exports the Express application instance created in app.ts.
 * 
 * For local development, use server.ts which includes the .listen() call.
 * For Vercel deployment, the handler in api/index.js imports from the built version of this app.
 */

import { createApp } from "./app.js";
import { connectDb } from "./db.js";
import { ensureAdmin } from "./lib/auth.js";

// We export the app factory and a pre-configured app instance
export { createApp };

// This instance can be used by tests or other entry points
const app = createApp();

export default app;
