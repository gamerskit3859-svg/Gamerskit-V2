import type { Order } from "@/types/shared";

export function getCourierStatusText(courier: Order["courier"]): string {
  if (!courier) return "Not sent";
  const responseStatus = getStatusFromResponse(courier.response);
  return (
    courier.deliveryStatus ||
    courier.courierStatus ||
    courier.status ||
    responseStatus ||
    "Sent"
  );
}

/**
 * Steadfast delivery states in the customer's words. Anything unmapped (they
 * add states over time) is prettified rather than dropped, so a new code shows
 * as "In review" instead of "in_review".
 */
const COURIER_STATUS_LABELS: Record<string, string> = {
  pending: "Received by courier",
  in_review: "Being reviewed by the courier",
  hold: "On hold at the courier",
  delivered: "Delivered",
  partial_delivered: "Partially delivered",
  cancelled: "Cancelled at the courier",
  unknown: "Awaiting the next courier update",
  delivered_approval_pending: "Delivered, awaiting confirmation",
  partial_delivered_approval_pending: "Partially delivered, awaiting confirmation",
  cancelled_approval_pending: "Cancellation pending confirmation",
  unknown_approval_pending: "Awaiting the next courier update",
};

/** Turn a raw courier state into something a customer can read. */
export function formatCourierStatus(value: string): string {
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const mapped = COURIER_STATUS_LABELS[key];
  if (mapped) return mapped;
  const words = key.replace(/_/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : value;
}

export function getStatusFromResponse(value: unknown): string | null {
  const record = asRecord(value);
  if (!record) return null;
  const data = asRecord(record.data) || asRecord(record.consignment) || asRecord(record.result);
  const candidate = data || record;
  const status =
    pickString(candidate, ["delivery_status", "status", "current_status"]) ||
    pickString(record, ["delivery_status", "status", "current_status"]);
  return status;
}

export function getBalanceAmount(value: unknown): number | null {
  const record = asRecord(value);
  if (!record) return null;
  const data = asRecord(record.data) || record;
  const raw =
    data.balance ??
    data.current_balance ??
    data.currentBalance ??
    data.amount ??
    record.balance;
  const amount = Number(raw);
  return Number.isFinite(amount) ? amount : null;
}

export function getCourierTrackUrl(trackingCode?: string): string | null {
  if (!trackingCode) return null;
  return `https://steadfast.com.bd/t/${encodeURIComponent(trackingCode)}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function pickString(
  record: Record<string, unknown> | null,
  keys: string[],
): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return null;
}
