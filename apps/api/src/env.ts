import "dotenv/config";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) {
    console.warn(`[env] ${name} is not set`);
    return "";
  }
  return v;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 4000),
  MONGODB_URI: required("MONGODB_URI", "mongodb://127.0.0.1:27017/gamerskit"),
  JWT_SECRET: required("JWT_SECRET", "dev-secret-change-me"),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "*",
  FB_PIXEL_ID: process.env.FB_PIXEL_ID ?? "",
  FB_CAPI_TOKEN: process.env.FB_CAPI_TOKEN ?? "",
  FB_TEST_EVENT_CODE: process.env.FB_TEST_EVENT_CODE ?? "",
  ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? "admin@gamerskit.local",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "admin123",
  GAMERSKIT_LEGACY_API:
    process.env.GAMERSKIT_LEGACY_API ?? "https://gamerskit-server.vercel.app",
};
