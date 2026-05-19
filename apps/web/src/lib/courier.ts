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
