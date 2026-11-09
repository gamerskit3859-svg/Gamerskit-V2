import { OrderModel } from "../models/Order.js";
import {
  steadfastService,
  type SteadfastJson,
} from "../services/steadfast.service.js";

/**
 * Courier status plumbing shared by the admin sync endpoints and the public
 * order-tracking endpoints. Both need to read the same fields out of
 * Steadfast's loosely shaped responses and write them back the same way, so
 * the logic lives here rather than in either route file.
 */

export function getRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

export function nestedRecord(
  value: unknown,
  key: string,
): Record<string, unknown> | null {
  const nested = getRecord(value)[key];
  if (typeof nested !== "object" || nested === null) return null;
  const record = nested as Record<string, unknown>;
  return Object.keys(record).length > 0 ? record : null;
}

export function pickString(
  record: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

/**
 * Pull the real delivery state out of a status response.
 *
 * Order matters: Steadfast's status endpoints return an HTTP-style numeric
 * `status` (200) right next to the actual `delivery_status`, so `delivery_status`
 * is preferred and any all-digits value is rejected outright — otherwise every
 * sync would persist "200" as the courier status.
 */
export function extractDeliveryStatus(
  response: SteadfastJson,
): string | undefined {
  const root = getRecord(response);
  const nested =
    nestedRecord(response, "data") ??
    nestedRecord(response, "consignment") ??
    nestedRecord(response, "result");

  for (const candidate of [nested, root]) {
    if (!candidate) continue;
    const value = pickString(candidate, [
      "delivery_status",
      "current_status",
      "status",
    ]);
    if (value && !/^\d+$/.test(value.trim())) return value.trim();
  }
  return undefined;
}

export type CourierIdentifiers = {
  orderNumber?: string;
  courier?: {
    consignmentId?: string;
    trackingCode?: string;
    invoice?: string;
  } | null;
};

/** Whether the parcel is far enough along for the courier to know about it. */
export function hasCourierIdentifier(order: CourierIdentifiers): boolean {
  const courier = order.courier;
  return Boolean(courier?.consignmentId || courier?.trackingCode || courier?.invoice);
}

/** Fetch the live status for one order, using whichever identifier it carries. */
export async function fetchCourierStatus(
  order: CourierIdentifiers,
): Promise<SteadfastJson> {
  const courier = order.courier;
  if (courier?.consignmentId) {
    return steadfastService.getStatusByConsignmentId(String(courier.consignmentId));
  }
  if (courier?.trackingCode) {
    return steadfastService.getStatusByTrackingCode(String(courier.trackingCode));
  }
  const invoice = courier?.invoice || order.orderNumber;
  if (invoice) return steadfastService.getStatusByInvoice(String(invoice));
  throw new Error("Courier tracking identifiers are missing for this order.");
}

/**
 * Persist a freshly fetched courier status onto the order.
 *
 * Writes through dotted paths so the rest of the courier subdocument
 * (consignment id, tracking code, invoice, createdAt) survives untouched.
 * Only an exact "delivered" closes the order — "partial_delivered" and every
 * other Steadfast state are deliberately left for a human to judge.
 */
export async function persistCourierStatus(
  order: { _id: unknown; status?: string; courier?: { status?: string } | null },
  response: SteadfastJson,
) {
  const deliveryStatus = extractDeliveryStatus(response);
  const changedAt = new Date();
  const update: Record<string, unknown> = {
    "courier.response": response,
    "courier.updatedAt": changedAt,
  };
  const movedToDelivered =
    deliveryStatus?.toLowerCase() === "delivered" && order.status !== "delivered";
  if (deliveryStatus) update["courier.status"] = deliveryStatus;
  if (movedToDelivered) {
    update.status = "delivered";
    // Stamped the same way an admin change is, so "changed 10m ago" reads the
    // same whether a human or the courier moved it.
    update.statusChangedAt = changedAt;
  }

  const updated = await OrderModel.findByIdAndUpdate(
    order._id,
    {
      $set: update,
      ...(movedToDelivered
        ? {
            $push: {
              statusHistory: {
                at: changedAt,
                from: order.status,
                to: "delivered",
                via: "courier",
              },
            },
          }
        : {}),
    },
    { new: true },
  ).lean();

  return { order: updated, deliveryStatus };
}
