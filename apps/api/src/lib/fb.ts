import { createHash, randomUUID } from "node:crypto";
import { env } from "../env.js";

export type FbServerEvent = {
  event_name: string;
  event_id?: string;
  event_time?: number;
  event_source_url?: string;
  action_source?: "website" | "system_generated" | "physical_store" | "other";
  user_data?: {
    em?: string[]; // already hashed or raw email (we hash if raw)
    ph?: string[];
    fn?: string[];
    ln?: string[];
    ct?: string[];
    country?: string[];
    external_id?: string[];
    client_ip_address?: string;
    client_user_agent?: string;
    fbp?: string;
    fbc?: string;
  };
  custom_data?: {
    currency?: string;
    value?: number;
    content_ids?: string[];
    content_type?: "product" | "product_group";
    content_name?: string;
    content_category?: string;
    contents?: Array<{ id: string; quantity: number; item_price?: number }>;
    num_items?: number;
    order_id?: string;
  };
};

const sha256 = (s: string) =>
  createHash("sha256").update(s.trim().toLowerCase()).digest("hex");

export function hashUserData(input: {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  externalId?: string;
}) {
  const out: NonNullable<FbServerEvent["user_data"]> = {};
  if (input.email) out.em = [sha256(input.email)];
  if (input.phone) out.ph = [sha256(input.phone.replace(/\D/g, ""))];
  if (input.firstName) out.fn = [sha256(input.firstName)];
  if (input.lastName) out.ln = [sha256(input.lastName)];
  if (input.city) out.ct = [sha256(input.city)];
  if (input.externalId) out.external_id = [sha256(input.externalId)];
  return out;
}

export function newEventId(): string {
  return randomUUID();
}

/**
 * Send a server event to Meta's Conversions API.
 * The same event_id should be used by the browser Pixel firing so Meta dedupes.
 */
export async function sendCapiEvent(
  event: FbServerEvent,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  if (!env.FB_PIXEL_ID || !env.FB_CAPI_TOKEN) {
    if (env.NODE_ENV !== "production") {
      console.info(
        "[fb] CAPI skipped (missing FB_PIXEL_ID/FB_CAPI_TOKEN):",
        event.event_name,
        event.event_id,
      );
    }
    return { ok: false, status: 0, body: { skipped: true } };
  }
  const payload = {
    data: [
      {
        event_time: event.event_time ?? Math.floor(Date.now() / 1000),
        action_source: event.action_source ?? "website",
        ...event,
      },
    ],
    test_event_code: env.FB_TEST_EVENT_CODE || undefined,
  };
  const url = `https://graph.facebook.com/v21.0/${env.FB_PIXEL_ID}/events?access_token=${encodeURIComponent(env.FB_CAPI_TOKEN)}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[fb] CAPI error", res.status, body);
    } else if (env.NODE_ENV !== "production") {
      console.info("[fb] CAPI ok", event.event_name, event.event_id);
    }
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    console.error("[fb] CAPI fetch failed", err);
    return { ok: false, status: 0, body: { error: String(err) } };
  }
}
