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
import { useAuth } from "@/lib/auth";

declare global {
  interface Window {
    fbq?: FbqFunction;
    _fbq?: FbqFunction;
    dataLayer?: Record<string, unknown>[];
  }
}

const PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID || "649455848240895";

type FbqFunction = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  loaded?: boolean;
  version?: string;
  push?: FbqFunction;
};

function ensureMetaPixel() {
  if (typeof window === "undefined" || !PIXEL_ID) return;

  if (!window.fbq) {
    const fbq = ((...args: unknown[]) => {
      if (fbq.callMethod) {
        fbq.callMethod(...args);
        return;
      }
      fbq.queue = fbq.queue ?? [];
      fbq.queue.push(args);
    }) as FbqFunction;

    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    window.fbq = fbq;
    window._fbq = fbq;
    window.fbq("init", PIXEL_ID);
  }

  const hasPixelScript =
    document.getElementById("meta-pixel-script") ||
    document.querySelector('script[src*="connect.facebook.net/en_US/fbevents.js"]');

  if (!hasPixelScript) {
    const script = document.createElement("script");
    script.id = "meta-pixel-script";
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }
}

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

function getTrackedUser(): TrackPayload["user"] | undefined {
  const user = useAuth.getState().user;
  if (!user) return undefined;
  return {
    email: user.email,
    phone: user.phone,
    firstName: user.name?.split(" ")[0],
    lastName: user.name?.split(" ").slice(1).join(" "),
  };
}

export type TrackPayload = {
  event: FbEventName;
  eventId?: string;
  sendCapi?: boolean;
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

type CartLikeLine = {
  productId: string;
  variantSku?: string;
  title: string;
  category?: string;
  unitPrice: number;
  quantity: number;
};

export function track(p: TrackPayload): string {
  const eventId = p.eventId ?? rid();
  const userData = p.user ?? getTrackedUser();
  const ecommerceItems = p.items?.map((item) => ({
    item_id: item.id,
    item_name: item.name,
    item_category: item.category,
    price: item.price,
    quantity: item.quantity,
    brand: item.brand ?? "GK Shop",
  }));
  const ecommerce =
    p.items || p.value !== undefined
      ? {
          currency: p.currency ?? "BDT",
          value: p.value ?? 0,
          transaction_id: p.orderId,
          order_id: p.orderId,
          items: ecommerceItems ?? [],
        }
      : undefined;
  const payload = {
    event: gtmEvent(p.event),
    fb_event: p.event,
    event_id: eventId,
    transaction_id: p.orderId,
    order_id: p.orderId,
    value: p.value,
    currency: p.currency ?? "BDT",
    ecommerce,
  };
  if (typeof window !== "undefined") {
    ensureMetaPixel();
    window.dataLayer = window.dataLayer ?? [];
    if (ecommerce) {
      window.dataLayer.push({ ecommerce: null });
    }
    window.dataLayer.push(payload);

    if (process.env.NODE_ENV !== "production") {
      console.debug("[analytics] event", payload);
    }

    // Wrap fbq() in try/catch — privacy extensions sometimes stub `fbq`
    // with a function that throws on call, and we never want analytics to
    // break the rest of the page.
    if (window.fbq && PIXEL_ID) {
      try {
        window.fbq("track", p.event, buildFbqParams(p), { eventID: eventId });
      } catch {
        // Swallow — ad-blockers / privacy extensions. Already logged at
        // the browser's network layer as ERR_BLOCKED_BY_CLIENT.
      }
    }

    // Server CAPI proxy. We deliberately swallow the rejected promise —
    // requests to /api/fb/* are commonly blocked by AdBlock and uBlock,
    // which surface as ERR_BLOCKED_BY_CLIENT in DevTools. The block is
    // expected (privacy extensions doing their job) and never affects the
    // checkout / page-view flow because the call is fire-and-forget.
    if (p.sendCapi !== false) {
      void fetch("/api/fb/event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event_name: p.event,
          event_id: eventId,
          event_source_url: window.location.href,
          user_data: {
            ...(userData ?? {}),
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
  }
  return eventId;
}

export function createEventId(): string {
  return rid();
}

export function getBrowserMeta() {
  if (typeof window === "undefined") {
    return {};
  }

  return {
    fbp: readCookie("_fbp"),
    fbc: readCookie("_fbc") ?? fbcFromUrl(),
    clientUserAgent: window.navigator.userAgent,
  };
}

export function trackPageView(url?: string) {
  const pageUrl =
    url ??
    (typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : undefined);

  if (typeof window !== "undefined") {
    ensureMetaPixel();
    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push({
      event: "page_view",
      page_path: pageUrl,
      page_location: window.location.href,
    });

    if (window.fbq && PIXEL_ID) {
      try {
        window.fbq("track", "PageView");
      } catch {
        // Ignore blocked Pixel calls.
      }
    }
  }

  return pageUrl ?? "";
}

export function trackViewContent(product: {
  _id: string;
  sku?: string;
  title: string;
  category?: string;
  price: number;
}) {
  const itemId = product.sku || product._id;
  return track({
    event: "ViewContent",
    contentIds: [itemId],
    contentName: product.title,
    contentCategory: product.category,
    value: product.price,
    currency: "BDT",
    items: [
      {
        id: itemId,
        name: product.title,
        category: product.category,
        price: product.price,
        quantity: 1,
      },
    ],
  });
}

export function trackAddToCart(
  product: {
    _id: string;
    sku?: string;
    title: string;
    category?: string;
    price: number;
  },
  quantity = 1,
) {
  const itemId = product.sku || product._id;
  return track({
    event: "AddToCart",
    contentIds: [itemId],
    contentName: product.title,
    contentCategory: product.category,
    value: product.price * quantity,
    currency: "BDT",
    items: [
      {
        id: itemId,
        name: product.title,
        category: product.category,
        price: product.price,
        quantity,
      },
    ],
  });
}

export function trackInitiateCheckout(
  lines: CartLikeLine[],
  user?: TrackPayload["user"],
) {
  return track({
    event: "InitiateCheckout",
    currency: "BDT",
    value: lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    contentIds: lines.map((line) => line.variantSku || line.productId),
    items: lines.map((line) => ({
      id: line.variantSku || line.productId,
      name: line.title,
      category: line.category,
      price: line.unitPrice,
      quantity: line.quantity,
    })),
    user,
  });
}

export function trackPurchase(args: {
  eventId: string;
  orderId: string;
  value: number;
  items: Array<{
    id: string;
    name: string;
    category?: string;
    price: number;
    quantity: number;
  }>;
  user?: TrackPayload["user"];
}) {
  return track({
    event: "Purchase",
    eventId: args.eventId,
    sendCapi: false,
    currency: "BDT",
    value: args.value,
    orderId: args.orderId,
    contentIds: args.items.map((item) => item.id),
    items: args.items,
    user: args.user,
  });
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
