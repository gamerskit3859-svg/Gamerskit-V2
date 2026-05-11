"use client";
/**
 * Browser-side Facebook Pixel + data-layer helper.
 *
 * Every event we fire goes through `track()` which:
 *   1. Pushes a GA4-style payload to `window.dataLayer` (ready for GTM).
 *   2. Fires the corresponding `fbq()` Pixel event with an `eventID`.
 *   3. POSTs the same event_id + payload to `/api/fb` so the server can call
 *      Meta's Conversions API (server CAPI). Meta dedupes on event_id.
 */
import type { FbDataLayerItem, FbEventName } from "@/types/shared";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: (...args: unknown[]) => void;
    dataLayer?: Record<string, unknown>[];
  }
}

const PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID;

function rid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match?.[2];
}

export type TrackPayload = {
  event: FbEventName;
  value?: number;
  currency?: string;
  contentIds?: string[];
  contentName?: string;
  contentCategory?: string;
  items?: FbDataLayerItem[];
  orderId?: string;
  user?: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    city?: string;
  };
};

export function track(p: TrackPayload): string {
  const eventId = rid();
  const payload = {
    event: gtmEvent(p.event),
    fb_event: p.event,
    event_id: eventId,
    ecommerce:
      p.items || p.value !== undefined
        ? {
            currency: p.currency ?? "BDT",
            value: p.value ?? 0,
            transaction_id: p.orderId,
            items: p.items ?? [],
          }
        : undefined,
  };
  if (typeof window !== "undefined") {
    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push(payload);

    if (window.fbq && PIXEL_ID) {
      window.fbq("track", p.event, buildFbqParams(p), { eventID: eventId });
    }

    // Fire-and-forget server CAPI proxy
    void fetch("/api/fb/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event_name: p.event,
        event_id: eventId,
        event_source_url: window.location.href,
        user_data: {
          ...(p.user ?? {}),
          fbp: readCookie("_fbp"),
          fbc: readCookie("_fbc") ?? fbcFromUrl(),
        },
        custom_data: {
          currency: p.currency ?? "BDT",
          value: p.value,
          content_ids: p.contentIds,
          content_name: p.contentName,
          content_category: p.contentCategory,
          contents: p.items?.map((i) => ({
            id: i.id,
            quantity: i.quantity,
            item_price: i.price,
          })),
          num_items: p.items?.reduce((n, i) => n + i.quantity, 0),
          order_id: p.orderId,
        },
      }),
    }).catch(() => null);
  }
  return eventId;
}

function buildFbqParams(p: TrackPayload): Record<string, unknown> {
  return {
    value: p.value,
    currency: p.currency ?? "BDT",
    content_ids: p.contentIds,
    content_name: p.contentName,
    content_category: p.contentCategory,
    contents: p.items?.map((i) => ({
      id: i.id,
      quantity: i.quantity,
      item_price: i.price,
    })),
    num_items: p.items?.reduce((n, i) => n + i.quantity, 0),
    order_id: p.orderId,
    content_type: "product",
  };
}

function gtmEvent(fbEvent: FbEventName): string {
  switch (fbEvent) {
    case "PageView":
      return "page_view";
    case "ViewContent":
      return "view_item";
    case "AddToCart":
      return "add_to_cart";
    case "RemoveFromCart":
      return "remove_from_cart";
    case "InitiateCheckout":
      return "begin_checkout";
    case "Purchase":
      return "purchase";
    case "Search":
      return "search";
    case "Lead":
      return "generate_lead";
    case "AddPaymentInfo":
      return "add_payment_info";
    case "CompleteRegistration":
      return "sign_up";
    default: {
      const _exhaustive: never = fbEvent;
      return String(_exhaustive).toLowerCase();
    }
  }
}

function fbcFromUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const params = new URLSearchParams(window.location.search);
  const fbclid = params.get("fbclid");
  if (!fbclid) return undefined;
  return `fb.1.${Date.now()}.${fbclid}`;
}
