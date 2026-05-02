import { NextResponse } from "next/server";
import { API_BASE } from "@/lib/api";

/**
 * Edge-compatible passthrough to the backend's /api/fb/event endpoint.
 * The backend has the FB CAPI access token; the browser never does.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  // forward client headers we care about (UA + IP)
  const ua = req.headers.get("user-agent") ?? "";
  const xff = req.headers.get("x-forwarded-for") ?? "";
  try {
    const r = await fetch(`${API_BASE}/api/fb/event`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": ua,
        "x-forwarded-for": xff,
      },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 502 },
    );
  }
}
