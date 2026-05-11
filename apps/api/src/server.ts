import { createApp } from "./app.js";
import { connectDb } from "./db.js";
import { env } from "./env.js";
import { ensureAdmin } from "./lib/auth.js";

async function startServer() {
  try {
    // Connect to DB and run bootstrap logic
    await connectDb();
    await ensureAdmin();

    const app = createApp();

    app.listen(env.PORT, () => {
      console.log(`[api] Local server running at http://localhost:${env.PORT}`);
    });
  } catch (err) {
    console.error("[api] Fatal error during startup:", err);
    process.exit(1);
  }
}

startServer();
