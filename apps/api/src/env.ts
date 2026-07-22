import "dotenv/config";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) {
    console.warn(`[env] ${name} is not set`);
    return "";
  }
  return v;
}

function productionSecret(name: string, fallback: string): string {
  const value = required(name, fallback);
  if (process.env.NODE_ENV === "production" && value === fallback) {
    throw new Error(`[env] ${name} must be set to a strong production value`);
  }
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 4000),
  MONGODB_URI: required("MONGODB_URI", "mongodb://127.0.0.1:27017/gamerskit"),
  JWT_SECRET: productionSecret("JWT_SECRET", "dev-secret-change-me"),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "*",
  FB_PIXEL_ID: process.env.FB_PIXEL_ID ?? "649455848240895",
  FB_CAPI_TOKEN: process.env.FB_CAPI_TOKEN ?? "",
  FB_TEST_EVENT_CODE: process.env.FB_TEST_EVENT_CODE ?? "",
  ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? "admin@gamerskit.local",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "admin123",
  GAMERSKIT_LEGACY_API:
    process.env.GAMERSKIT_LEGACY_API ?? "https://gamerskit-server.vercel.app",
  // OAuth
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",
  FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID ?? "",
  FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET ?? "",
  STEADFAST_API_KEY: process.env.STEADFAST_API_KEY ?? "",
  STEADFAST_SECRET_KEY: process.env.STEADFAST_SECRET_KEY ?? "",
  STEADFAST_BASE_URL:
    process.env.STEADFAST_BASE_URL ?? "https://portal.packzy.com/api/v1",
  // Cloudflare R2 (S3-compatible object storage).
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID ?? "",
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID ?? "",
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY ?? "",
  R2_BUCKET: process.env.R2_BUCKET ?? "",
  // Optional S3 endpoint override (jurisdiction-specific R2 endpoints, or an
  // S3-compatible server in development). Defaults to the account endpoint.
  R2_ENDPOINT: process.env.R2_ENDPOINT ?? "",
  // Public base URL of the bucket (custom domain or r2.dev), no trailing slash.
  R2_PUBLIC_URL: (process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, ""),
};
