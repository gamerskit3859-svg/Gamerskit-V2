import { API_BASE } from "@/lib/api";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const format = url.searchParams.get("format") || "meta";
  const response = await fetch(
    `${API_BASE}/api/feed?format=${encodeURIComponent(format)}`,
    {
      cache: "no-store",
    },
  );
  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: {
      "content-type":
        response.headers.get("content-type") ||
        (format === "google"
          ? "text/tab-separated-values; charset=utf-8"
          : "application/xml; charset=utf-8"),
      "cache-control":
        response.headers.get("cache-control") ||
        "public, s-maxage=3600, stale-while-revalidate=3600",
    },
  });
}
