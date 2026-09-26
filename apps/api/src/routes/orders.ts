import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { ORDER_STATUSES, OrderModel } from "../models/Order.js";
import { ProductModel } from "../models/Product.js";
import { CouponModel } from "../models/Coupon.js";
import { getEffectivePrice } from "../lib/pricing.js";
import { getOrderDeliveryCharge } from "../lib/delivery.js";
import { adminRequired, authPayloadFromRequest } from "../lib/auth.js";
import { hashUserData, newEventId, sendCapiEvent } from "../lib/fb.js";
import { setPrivateNoStore } from "../lib/http.js";
import {
  fetchCourierStatus,
  hasCourierIdentifier,
  persistCourierStatus,
} from "../lib/courier-sync.js";
import {
  buildDhakaDateRangeFilter,
  dhakaOrderDateKey,
} from "../lib/timezone.js";

const router = Router();

/**
 * Sort options exposed by the admin order list. Each one ends with a createdAt
 * component so orders that tie on the primary key keep a stable order across
 * pages instead of shuffling between requests.
 */
const ORDER_SORTS: Record<string, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  total_desc: { total: -1, createdAt: -1 },
  total_asc: { total: 1, createdAt: -1 },
};
const TRACKING_ORDER_FIELDS =
  "orderNumber customer.name customer.phone customer.email customer.address customer.district customer.thana customer.city customer.area shippingAddress deliveryAddress location customerAddress items.title items.image items.unitPrice items.quantity items.selectedVariants items.variantSku items.variantPrice items.custom items.note subtotal shippingFee discount total advance remaining paymentType paidAmount dueAmount senderNumber paymentMethod paymentStatus status source notes courier createdAt updatedAt";

const lineSchema = z.object({
  productId: z.string().optional(),
  title: z.string(),
  image: z.string().optional(),
  unitPrice: z.number().min(0),
  quantity: z.number().int().min(1),
  selectedVariants: z.record(z.string(), z.string()).optional(),
  variantSku: z.string().optional(),
  variantPrice: z.number().min(0).optional(),
  custom: z.boolean().optional(),
  note: z.string().optional(),
});

type OrderVariantOption = {
  value?: unknown;
  stock?: unknown;
  sku?: unknown;
  price?: unknown;
};

type OrderVariantGroup = {
  name?: unknown;
  options?: OrderVariantOption[];
};

// Customer shape is intentionally lenient on location: the storefront ships
// district/thana, while admin custom-order builder ships city/area. Both
// combinations are accepted and persisted as-is.
const customerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(5),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().min(2),
  // Customer location is intentionally lenient: the storefront ships
  // district/thana, while the admin custom-order builder previously shipped
  // city/area. Both pairs are accepted and persisted so old admin orders
  // keep round-tripping correctly.
  district: z.string().optional(),
  thana: z.string().optional(),
  city: z.string().optional(),
  area: z.string().optional(),
});

const orderSchema = z.object({
  customer: customerSchema,
  items: z.array(lineSchema).min(1),
  shippingFee: z.number().min(0).default(0),
  discount: z.number().min(0).default(0),
  advance: z.number().min(0).default(0),
  paymentMethod: z.enum(["cod", "bkash", "nagad", "card", "manual"]).default("cod"),
  paymentType: z.enum(["full", "partial"]).nullable().optional(),
  paidAmount: z.number().min(0).optional(),
  dueAmount: z.number().min(0).optional(),
  senderNumber: z.string().nullable().optional(),
  source: z.enum(["storefront", "manual"]).default("storefront"),
  notes: z.string().optional(),
  couponCode: z.string().optional(),
  eventId: z.string().optional(),
  fbp: z.string().optional(),
  fbc: z.string().optional(),
  clientUserAgent: z.string().optional(),
  clientIp: z.string().optional(),
});

type StockCountableLine = {
  productId?: unknown;
  custom?: unknown;
  quantity?: unknown;
  selectedVariants?: unknown;
};

type StockTallyEntry = {
  productId: string;
  selectedVariants: Record<string, string>;
  delta: number;
};

// selectedVariants is a Mongoose Map on hydrated docs and a plain object on
// lean reads / request bodies. Normalize both to a plain object.
function toPlainVariants(value: unknown): Record<string, string> {
  if (!value) return {};
  if (value instanceof Map) {
    return Object.fromEntries(
      Array.from(value.entries()).map(([key, val]) => [String(key), String(val)]),
    );
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [
        key,
        String(val),
      ]),
    );
  }
  return {};
}

function variantSignature(variants: Record<string, string>): string {
  return JSON.stringify(
    Object.entries(variants).sort(([a], [b]) => a.localeCompare(b)),
  );
}

/**
 * Net stock movement between two versions of an order's items. The returned
 * `delta` is what should be ADDED BACK to stock: positive when the edit removed
 * units from the order, negative when it added more. Custom lines and lines
 * without a resolvable product are ignored — they never moved stock.
 */
function tallyStockDelta(
  previousItems: StockCountableLine[],
  nextItems: StockCountableLine[],
): StockTallyEntry[] {
  const tally = new Map<string, StockTallyEntry>();
  const accumulate = (items: StockCountableLine[], sign: 1 | -1) => {
    for (const line of items) {
      const productId = line.productId ? String(line.productId) : "";
      if (line.custom === true || !productId || !mongoose.isValidObjectId(productId)) {
        continue;
      }
      const selectedVariants = toPlainVariants(line.selectedVariants);
      const key = `${productId}|${variantSignature(selectedVariants)}`;
      const entry = tally.get(key) ?? { productId, selectedVariants, delta: 0 };
      entry.delta += sign * Number(line.quantity ?? 0);
      tally.set(key, entry);
    }
  };
  accumulate(previousItems, 1);
  accumulate(nextItems, -1);
  return [...tally.values()].filter((entry) => entry.delta !== 0);
}

/**
 * Apply a stock tally. This mirrors the decrement logic in POST / exactly —
 * including the `Math.max(1, matchedOptions)` multiplier on the product-level
 * counter — so an edit reverses the original movement instead of drifting.
 */
async function applyStockDelta(entries: StockTallyEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const products = await ProductModel.find({
    _id: { $in: [...new Set(entries.map((entry) => entry.productId))] },
  })
    .select("variants")
    .lean();
  const productById = new Map(products.map((p) => [String(p._id), p]));
  const incByProduct = new Map<string, Record<string, number>>();

  for (const entry of entries) {
    const product = productById.get(entry.productId);
    if (!product) continue; // product deleted since the order was placed
    const inc = incByProduct.get(entry.productId) ?? {};

    if (Array.isArray(product.variants) && product.variants.length > 0) {
      let matchedOptions = 0;
      (product.variants as OrderVariantGroup[]).forEach((group, groupIndex) => {
        const selectedValue = entry.selectedVariants[String(group.name ?? "")];
        const optionIndex = (group.options ?? []).findIndex(
          (option: OrderVariantOption) => String(option.value) === selectedValue,
        );
        if (optionIndex >= 0) {
          const path = `variants.${groupIndex}.options.${optionIndex}.stock`;
          inc[path] = (inc[path] ?? 0) + entry.delta;
          matchedOptions += 1;
        }
      });
      inc.stock = (inc.stock ?? 0) + entry.delta * Math.max(1, matchedOptions);
    } else {
      inc.stock = (inc.stock ?? 0) + entry.delta;
    }

    incByProduct.set(entry.productId, inc);
  }

  await Promise.all(
    [...incByProduct.entries()].map(([productId, inc]) =>
      ProductModel.updateOne({ _id: productId }, { $inc: inc }).catch(() => null),
    ),
  );
}

type DiffableOrder = {
  customer?: Record<string, unknown>;
  items?: StockCountableLine[];
  subtotal?: number;
  shippingFee?: number;
  discount?: number;
  total?: number;
  paidAmount?: number;
  paymentMethod?: string;
  notes?: string;
};

function lineIdentity(line: Record<string, unknown>): string {
  if (line.custom === true || !line.productId) {
    return `custom:${String(line.title ?? "")}`;
  }
  return `${String(line.productId)}|${variantSignature(toPlainVariants(line.selectedVariants))}`;
}

/**
 * Human-readable summary of an edit, stored on the order's editHistory so the
 * admin UI can show what actually changed rather than just "edited".
 */
function describeOrderChanges(before: DiffableOrder, after: DiffableOrder): string[] {
  const changes: string[] = [];

  const customerFields: Array<[string, string]> = [
    ["name", "Name"],
    ["phone", "Phone"],
    ["email", "Email"],
    ["address", "Address"],
    ["district", "District"],
    ["thana", "Thana"],
  ];
  for (const [field, label] of customerFields) {
    const from = String(before.customer?.[field] ?? "");
    const to = String(after.customer?.[field] ?? "");
    if (from !== to) changes.push(`${label}: ${from || "—"} → ${to || "—"}`);
  }

  const indexLines = (items: StockCountableLine[] = []) => {
    const map = new Map<string, { title: string; quantity: number; unitPrice: number }>();
    for (const raw of items) {
      const line = raw as Record<string, unknown>;
      const key = lineIdentity(line);
      const existing = map.get(key);
      const quantity = Number(line.quantity ?? 0);
      if (existing) {
        existing.quantity += quantity;
      } else {
        map.set(key, {
          title: String(line.title ?? "Item"),
          quantity,
          unitPrice: Number(line.unitPrice ?? 0),
        });
      }
    }
    return map;
  };
  const beforeLines = indexLines(before.items);
  const afterLines = indexLines(after.items);
  for (const [key, next] of afterLines) {
    const prev = beforeLines.get(key);
    if (!prev) {
      changes.push(`Added ${next.quantity} × ${next.title}`);
      continue;
    }
    if (prev.quantity !== next.quantity) {
      changes.push(`${next.title}: qty ${prev.quantity} → ${next.quantity}`);
    }
    if (prev.unitPrice !== next.unitPrice) {
      changes.push(`${next.title}: price ${prev.unitPrice} → ${next.unitPrice}`);
    }
  }
  for (const [key, prev] of beforeLines) {
    if (!afterLines.has(key)) changes.push(`Removed ${prev.quantity} × ${prev.title}`);
  }

  const numericFields: Array<[keyof DiffableOrder, string]> = [
    ["shippingFee", "Shipping"],
    ["discount", "Discount"],
    ["total", "Total"],
    ["paidAmount", "Paid"],
  ];
  for (const [field, label] of numericFields) {
    const from = Number(before[field] ?? 0);
    const to = Number(after[field] ?? 0);
    if (from !== to) changes.push(`${label}: ${from} → ${to}`);
  }

  if ((before.paymentMethod ?? "") !== (after.paymentMethod ?? "")) {
    changes.push(`Payment method: ${before.paymentMethod ?? "—"} → ${after.paymentMethod ?? "—"}`);
  }
  if ((before.notes ?? "") !== (after.notes ?? "")) changes.push("Notes updated");

  return changes;
}

function genOrderNumber(): string {
  const ymd = dhakaOrderDateKey().replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `GK-${ymd}-${rand}`;
}

async function validateCouponDiscount(code: string, subtotal: number) {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) return null;

  const coupon = await CouponModel.findOne({ code: normalizedCode, active: true }).lean();
  if (!coupon) throw new Error("Coupon not found or inactive.");

  const now = Date.now();
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now) {
    throw new Error("Coupon is not active yet.");
  }
  if (coupon.endsAt && new Date(coupon.endsAt).getTime() < now) {
    throw new Error("Coupon has expired.");
  }
  if (coupon.maxRedemptions && coupon.redeemed >= coupon.maxRedemptions) {
    throw new Error("Coupon redemption limit reached.");
  }
  if (coupon.minOrder && subtotal < coupon.minOrder) {
    throw new Error(`Minimum order amount for this coupon is ${coupon.minOrder}.`);
  }

  const discount =
    coupon.type === "percent"
      ? Math.round((subtotal * coupon.value) / 100)
      : Math.min(coupon.value, subtotal);

  return { code: coupon.code, discount };
}

router.post("/", async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const data = parsed.data;

  // Optional auth: if the request comes with a customer JWT we link the order
  // to the user so it shows up in /account reliably. Invalid/missing tokens
  // just produce a guest order.
  const jwtPayload = authPayloadFromRequest(req);
  const userId =
    jwtPayload?.sub && mongoose.isValidObjectId(jwtPayload.sub)
      ? new mongoose.Types.ObjectId(jwtPayload.sub)
      : undefined;

  if (
    data.source === "manual" &&
    jwtPayload?.role !== "admin" &&
    jwtPayload?.role !== "staff"
  ) {
    res.status(403).json({ error: "manual orders require admin access" });
    return;
  }

  // Server-side re-pricing: never trust the unitPrice that the client sent for
  // catalog items. We look each non-custom line up by productId and overwrite
  // unitPrice (and title/image) from the live DB. Custom admin lines keep
  // whatever the admin typed.
  const productIds = data.items
    .map((l) => l.productId)
    .filter(
      (id): id is string => !!id && mongoose.isValidObjectId(id),
    );
  const products = productIds.length
    ? await ProductModel.find({ _id: { $in: productIds } })
        .select("title images price compareAtPrice freeDelivery stock variants")
        .lean()
    : [];
  const productById = new Map(products.map((p) => [String(p._id), p]));

  let items: typeof data.items;
  try {
    items = data.items.map((line) => {
      if (line.custom || !line.productId) return line;
      const p = productById.get(line.productId);
      if (!p) return line; // product was deleted; honour whatever was on the client
      const selectedVariants = line.selectedVariants ?? {};
      let unitPrice =
        typeof p.price === "number" ? getEffectivePrice(p) : line.unitPrice;
      const variantSkus: string[] = [];

      if (Array.isArray(p.variants) && p.variants.length > 0) {
        for (const group of p.variants as OrderVariantGroup[]) {
          const groupName = String(group.name ?? "");
          const selectedValue = selectedVariants[groupName];
          if (!selectedValue) {
            throw new Error(`Please select ${groupName} for ${p.title}.`);
          }
          const option = (group.options ?? []).find(
            (candidate: OrderVariantOption) =>
              String(candidate.value) === selectedValue,
          );
          if (!option) {
            throw new Error(`Selected ${groupName} is not available for ${p.title}.`);
          }
          if (typeof option.price === "number") unitPrice = option.price;
          if (option.sku) variantSkus.push(String(option.sku));
        }
      }

      return {
        ...line,
        title: p.title ?? line.title,
        image: line.image ?? (Array.isArray(p.images) ? p.images[0] : undefined),
        unitPrice,
        variantPrice: unitPrice,
        variantSku: line.variantSku ?? (variantSkus.join(" / ") || undefined),
      };
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }

  const subtotal = items.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  let couponCode: string | undefined;
  let discount = data.source === "manual" ? data.discount : 0;
  if (data.couponCode) {
    try {
      const couponResult = await validateCouponDiscount(data.couponCode, subtotal);
      couponCode = couponResult?.code;
      discount = couponResult?.discount ?? 0;
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
      return;
    }
  }

  // Delivery charge is never trusted from the client: it's always derived
  // from the centralized delivery rules (free-delivery products / district).
  const deliveryDistrict = data.customer.district || data.customer.city;
  const deliveryItems = data.items.map((line) => {
    if (line.custom || !line.productId) return { freeDelivery: false };
    const p = productById.get(line.productId);
    return { freeDelivery: p?.freeDelivery === true };
  });
  const shippingFee = getOrderDeliveryCharge(deliveryItems, deliveryDistrict);

  const total = Math.max(0, subtotal + shippingFee - discount);
  const onlinePayment =
    data.paymentMethod === "bkash" || data.paymentMethod === "nagad";
  const paymentType = onlinePayment ? data.paymentType ?? "partial" : null;
  const paidAmount = onlinePayment
    ? paymentType === "full"
      ? total
      : Number(data.paidAmount ?? data.advance ?? 0)
    : Number(data.advance ?? 0);
  const dueAmount = Math.max(0, total - paidAmount);
  const remaining = dueAmount;
  const eventId = data.eventId ?? newEventId();
  const orderNumber = genOrderNumber();

  if (onlinePayment) {
    const senderDigits = (data.senderNumber ?? "").replace(/\D/g, "");
    if (!/^01[3-9]\d{8}$/.test(senderDigits)) {
      res.status(400).json({ error: "Valid sender number is required." });
      return;
    }
    if (paymentType === "partial" && (paidAmount <= 0 || paidAmount >= total)) {
      res.status(400).json({ error: "Partial paid amount must be greater than 0 and less than total." });
      return;
    }
  }

  // Payment status follows the money. Online prepayments collected up front
  // settle to "paid"; COD / advance flows start "unpaid"/"partial" until the
  // admin marks them on the order detail page.
  const paymentStatus =
    paidAmount > 0 && paidAmount < total
      ? "partial"
      : paidAmount >= total && total > 0
        ? "paid"
        : "unpaid";

  const order = await OrderModel.create({
    orderNumber,
    customer: data.customer,
    items,
    subtotal,
    shippingFee,
    discount,
    total,
    advance: paidAmount,
    remaining,
    paymentType,
    paidAmount,
    dueAmount,
    senderNumber: onlinePayment ? (data.senderNumber ?? "").replace(/\D/g, "") : null,
    paymentMethod: data.paymentMethod,
    paymentStatus,
    // New orders land as "confirmed" (not "pending") so they immediately show
    // up in the admin's actionable queue without a manual confirm step.
    status: "confirmed",
    source: data.source,
    notes: data.notes,
    couponCode,
    fbEventId: eventId,
    userId,
  });

  const stockUpdates = items
    .filter((line) => line.productId && !line.custom)
    .map(async (line) => {
      const product = productById.get(String(line.productId));
      if (!product) return null;
      const selectedVariants = line.selectedVariants ?? {};

      if (Array.isArray(product.variants) && product.variants.length > 0) {
        const update: Record<string, unknown> = { $inc: {} };
        let decrementedOptions = 0;
        (product.variants as OrderVariantGroup[]).forEach((group, groupIndex) => {
          const selectedValue = selectedVariants[String(group.name ?? "")];
          const optionIndex = (group.options ?? []).findIndex(
            (option: OrderVariantOption) => String(option.value) === selectedValue,
          );
          if (optionIndex >= 0) {
            (update.$inc as Record<string, number>)[
              `variants.${groupIndex}.options.${optionIndex}.stock`
            ] = -line.quantity;
            decrementedOptions += 1;
          }
        });
        (update.$inc as Record<string, number>).stock =
          -line.quantity * Math.max(1, decrementedOptions);
        return ProductModel.updateOne({ _id: line.productId }, update).catch(() => null);
      }

      return ProductModel.updateOne(
        { _id: line.productId },
        { $inc: { stock: -line.quantity } },
      ).catch(() => null);
    });

  const couponUpdate = couponCode
    ? CouponModel.findOneAndUpdate(
        { code: couponCode },
        { $inc: { redeemed: 1 } },
      ).catch(() => null)
    : null;

  await Promise.all([...stockUpdates, couponUpdate].filter(Boolean));

  // Fire CAPI Purchase event (deduplicated with Pixel via eventId)
  const [firstName, ...rest] = data.customer.name.split(" ");
  void sendCapiEvent({
    event_name: "Purchase",
    event_id: eventId,
    event_time: Math.floor(Date.now() / 1000),
    action_source: data.source === "manual" ? "system_generated" : "website",
    user_data: {
      ...hashUserData({
        email: data.customer.email || undefined,
        phone: data.customer.phone,
        firstName,
        lastName: rest.join(" ") || undefined,
        // CAPI's city field accepts either pair; prefer the legacy `city`
        // when present, fall back to the storefront's `district`.
        city: data.customer.city ?? data.customer.district,
        externalId: orderNumber,
      }),
      fbp: data.fbp,
      fbc: data.fbc,
      client_user_agent: data.clientUserAgent,
      client_ip_address: data.clientIp,
    },
    custom_data: {
      currency: "BDT",
      value: total,
      content_type: "product",
      content_ids: items.map((l) => l.productId ?? `custom-${l.title}`),
      contents: items.map((l) => ({
        id: l.productId ?? `custom-${l.title}`,
        quantity: l.quantity,
        item_price: l.unitPrice,
      })),
      num_items: items.reduce((s, l) => s + l.quantity, 0),
      order_id: orderNumber,
    },
  });

  res.status(201).json({ order, eventId });
});

router.get("/by-number/:orderNumber", async (req, res) => {
  const order = await OrderModel.findOne({ orderNumber: req.params.orderNumber })
    .select(TRACKING_ORDER_FIELDS)
    .lean();
  if (!order) {
    res.status(404).json({ error: "not found" });
    return;
  }
  setPrivateNoStore(res);
  res.json({ order });
});

router.get("/by-phone/:phone", async (req, res) => {
  const orders = await OrderModel.find({ "customer.phone": req.params.phone })
    .sort({ createdAt: -1 })
    .limit(10)
    .select(TRACKING_ORDER_FIELDS)
    .lean();
  if (orders.length === 0) {
    res.status(404).json({ error: "not found" });
    return;
  }
  setPrivateNoStore(res);
  res.json({ orders });
});

/**
 * The public tracking field takes whatever the customer has to hand, so a
 * query is resolved in three passes: a Bangladeshi phone number (all of that
 * customer's recent orders), an order number, or a courier identifier printed
 * on the parcel.
 */
function phoneVariants(value: string): string[] | null {
  const digits = value.replace(/\D/g, "");
  const local = digits.length > 11 ? digits.slice(-11) : digits;
  if (!/^01[3-9]\d{8}$/.test(local)) return null;
  // Checkout stores the number exactly as it was typed, so match the local
  // form alongside the +88 / 88 variants instead of assuming one of them.
  return Array.from(new Set([value.trim(), local, `88${local}`, `+88${local}`]));
}

type TrackableOrder = { orderNumber?: string; customer?: { phone?: string } | null };

function trackQueryMatchesOrder(
  query: string,
  order: TrackableOrder & {
    courier?: { trackingCode?: string; consignmentId?: string; invoice?: string } | null;
  },
): boolean {
  const q = query.trim();
  if (!q) return false;
  const phones = phoneVariants(q);
  const phone = order.customer?.phone;
  if (phones && phone && phones.includes(phone)) return true;
  if (order.orderNumber && order.orderNumber.toUpperCase() === q.toUpperCase()) {
    return true;
  }
  const courier = order.courier;
  if (!courier) return false;
  return [courier.trackingCode, courier.consignmentId, courier.invoice].some(
    (value) => Boolean(value) && String(value) === q,
  );
}

router.get("/track", async (req, res) => {
  const q = String((req.query as Record<string, unknown>).q ?? "").trim();
  if (q.length < 4) {
    res
      .status(400)
      .json({ error: "Enter a phone number, order number or tracking code." });
    return;
  }

  const phones = phoneVariants(q);
  const orders = phones
    ? await OrderModel.find({ "customer.phone": { $in: phones } })
        .sort({ createdAt: -1 })
        .limit(10)
        .select(TRACKING_ORDER_FIELDS)
        .lean()
    : await OrderModel.find({
        $or: [
          { orderNumber: q.toUpperCase() },
          { "courier.trackingCode": q },
          { "courier.consignmentId": q },
          { "courier.invoice": q },
        ],
      })
        .limit(5)
        .select(TRACKING_ORDER_FIELDS)
        .lean();

  if (orders.length === 0) {
    res.status(404).json({ error: "not found" });
    return;
  }
  setPrivateNoStore(res);
  res.json({ orders });
});

/** Steadfast is a metered API; a snapshot this fresh is not worth another call. */
const COURIER_REFRESH_COOLDOWN_MS = 2 * 60_000;

const trackRefreshSchema = z.object({
  q: z.string().min(4).max(64),
  orderNumber: z.string().min(3).max(64),
});

/**
 * Customer-facing courier refresh. Same fetch-and-persist path as the admin
 * sync, but authorised by the identifier the customer already used to find the
 * order: an order number on its own must not let anyone poll a stranger's
 * parcel. Never fails the request — tracking still has to render when the
 * courier API is down, so problems come back as a reason on the stored order.
 */
router.post("/track/courier-refresh", async (req, res) => {
  const parsed = trackRefreshSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid tracking request." });
    return;
  }
  const { q, orderNumber } = parsed.data;
  const order = await OrderModel.findOne({
    orderNumber: orderNumber.trim().toUpperCase(),
  }).lean();
  if (!order || !trackQueryMatchesOrder(q, order)) {
    res.status(404).json({ error: "not found" });
    return;
  }

  setPrivateNoStore(res);
  const respond = async (refreshed: boolean, reason?: string) => {
    const fresh = await OrderModel.findById(order._id)
      .select(TRACKING_ORDER_FIELDS)
      .lean();
    res.json({ order: fresh, refreshed, reason });
  };

  if (!hasCourierIdentifier(order)) {
    await respond(false, "not_dispatched");
    return;
  }
  const lastSync = order.courier?.updatedAt;
  if (lastSync && Date.now() - new Date(lastSync).getTime() < COURIER_REFRESH_COOLDOWN_MS) {
    await respond(false, "recent");
    return;
  }

  try {
    const response = await fetchCourierStatus(order);
    await persistCourierStatus(order, response);
    await respond(true);
  } catch {
    await respond(false, "unavailable");
  }
});

// Admin endpoints
router.get("/", adminRequired, async (req, res) => {
  setPrivateNoStore(res);
  const {
    from,
    to,
    status,
    source,
    productId,
    readyStock,
    sort,
    q,
    page = "1",
    limit = "30",
  } = req.query as Record<string, string>;
  // Everything except the status condition. The status filter counts are taken
  // from this, so a chip can say how many orders it would show rather than how
  // many match the status the list is already narrowed to.
  const baseFilter: Record<string, unknown> = {};
  if (source && source !== "all") baseFilter.source = source;

  // Both of the filters below constrain items.productId, so they are collected
  // and combined with $and — assigning the same key twice would silently drop
  // the first one.
  const productConditions: Record<string, unknown>[] = [];

  // "Orders containing this product". Ignored unless it is a real ObjectId, so
  // a stale or hand-typed value degrades to "no product filter" rather than
  // throwing a cast error.
  if (productId && productId !== "all" && mongoose.isValidObjectId(productId)) {
    productConditions.push({
      "items.productId": new mongoose.Types.ObjectId(productId),
    });
  }

  // Ready stock lives on the product, not the order, so resolve the flag to a
  // set of product ids first. "ready" means nothing in the order is waiting on
  // restock; "not_ready" means at least one line is.
  if (readyStock === "ready" || readyStock === "not_ready") {
    const notReady = await ProductModel.find({ readyStock: { $ne: true } })
      .select("_id")
      .lean();
    const notReadyIds = notReady.map((product) => product._id);
    productConditions.push({
      "items.productId":
        readyStock === "ready" ? { $nin: notReadyIds } : { $in: notReadyIds },
    });
  }

  if (productConditions.length === 1) {
    Object.assign(baseFilter, productConditions[0]);
  } else if (productConditions.length > 1) {
    baseFilter.$and = productConditions;
  }
  const dateFilter = buildDhakaDateRangeFilter(from, to);
  if (dateFilter) baseFilter.createdAt = dateFilter;
  if (q) {
    baseFilter.$or = [
      { orderNumber: { $regex: q, $options: "i" } },
      { "customer.name": { $regex: q, $options: "i" } },
      { "customer.phone": { $regex: q, $options: "i" } },
    ];
  }
  const filter =
    status && status !== "all" ? { ...baseFilter, status } : baseFilter;
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Math.min(Number(limit) || 30, 200));
  const skip = (pageNum - 1) * limitNum;
  const [items, total, statusGroups] = await Promise.all([
    OrderModel.find(filter)
      .sort(ORDER_SORTS[sort] ?? ORDER_SORTS.newest)
      .skip(skip)
      .limit(limitNum)
      .select("orderNumber customer items total dueAmount remaining paymentMethod source status statusChangedAt courier createdAt")
      .lean(),
    OrderModel.countDocuments(filter),
    OrderModel.aggregate<{ _id: string | null; count: number }>([
      { $match: baseFilter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  // Every current status is present even at zero, so the admin's filter chips
  // keep a stable width instead of appearing and disappearing. "all" counts
  // every matching order, including any still on a retired status.
  const statusCounts: Record<string, number> = { all: 0 };
  for (const value of ORDER_STATUSES) statusCounts[value] = 0;
  for (const group of statusGroups) {
    if (!group._id) continue;
    statusCounts[group._id] = group.count;
    statusCounts.all += group.count;
  }

  res.json({
    items,
    total,
    statusCounts,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  });
});

router.get("/:id", adminRequired, async (req, res) => {
  setPrivateNoStore(res);
  const order = await OrderModel.findById(req.params.id).lean();
  if (!order) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json({ order });
});

const orderPatchSchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  // null clears the override and hands the amount back to resolveCodAmount.
  courierCodAmount: z.number().min(0).nullable().optional(),
  paymentStatus: z
    .enum(["unpaid", "partial", "paid", "refunded"])
    .optional(),
  notes: z.string().optional(),
});

router.patch("/:id", adminRequired, async (req, res) => {
  // Only allow patching a small allowlist of fields. Previously this route
  // forwarded the full request body to findByIdAndUpdate, which let an admin
  // overwrite arbitrary persisted state (totals, customer, line items, _id).
  const parsed = orderPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  // A status move is stamped and recorded. Read the current status first so
  // re-saving the same value is not logged as a change — the admin list fires
  // a PATCH on every select, including ones that land back where they were.
  const current = await OrderModel.findById(req.params.id)
    .select("status")
    .lean<{ status?: string } | null>();
  if (!current) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const nextStatus = parsed.data.status;
  const statusMoved = Boolean(nextStatus && nextStatus !== current.status);
  const changedAt = new Date();

  const set: Record<string, unknown> = {
    ...parsed.data,
    ...(statusMoved ? { statusChangedAt: changedAt } : {}),
  };
  const updated = await OrderModel.findByIdAndUpdate(
    req.params.id,
    {
      // Every field here is optional, so a body that sets nothing must not
      // reach Mongo as an empty `$set` — that is a parse error, not a no-op.
      ...(Object.keys(set).length > 0 ? { $set: set } : {}),
      ...(statusMoved
        ? {
            $push: {
              statusHistory: {
                at: changedAt,
                from: current.status,
                to: nextStatus,
                byEmail: req.user?.email,
                via: "admin",
              },
            },
          }
        : {}),
    },
    { new: true },
  ).lean();
  if (!updated) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json({ order: updated });
});

// Full order edit. Unlike PATCH (a narrow status/notes allowlist) this replaces
// the customer, line items and money fields, then recomputes the derived totals
// server-side. Admin-authored prices are trusted here: an edit is a correction
// tool, so unlike POST / the catalog price does NOT overwrite what was typed.
const orderEditSchema = z.object({
  customer: customerSchema,
  items: z.array(lineSchema).min(1),
  shippingFee: z.number().min(0),
  discount: z.number().min(0),
  paidAmount: z.number().min(0).default(0),
  paymentMethod: z.enum(["cod", "bkash", "nagad", "card", "manual"]),
  paymentType: z.enum(["full", "partial"]).nullable().optional(),
  senderNumber: z.string().nullable().optional(),
  notes: z.string().optional(),
});

const UNEDITABLE_STATUSES = new Set([
  "delivered",
  "returned",
  "cancelled",
  "refunded",
]);

router.put("/:id", adminRequired, async (req, res) => {
  const parsed = orderEditSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const data = parsed.data;

  const existing = await OrderModel.findById(req.params.id).lean();
  if (!existing) {
    res.status(404).json({ error: "not found" });
    return;
  }

  // Edit lock: once the consignment is with Steadfast, editing here would make
  // the order and the courier's copy silently diverge. Terminal orders are
  // frozen because their stock and revenue have already been accounted for.
  if (existing.courier) {
    res.status(409).json({
      error:
        "This order has already been sent to the courier and can no longer be edited.",
    });
    return;
  }
  if (UNEDITABLE_STATUSES.has(existing.status)) {
    res.status(409).json({
      error: `A ${existing.status} order can no longer be edited.`,
    });
    return;
  }

  const items = data.items.map((line) => ({
    ...line,
    productId:
      line.productId && mongoose.isValidObjectId(line.productId)
        ? line.productId
        : undefined,
    custom: line.custom ?? false,
  }));

  const subtotal = items.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const total = Math.max(0, subtotal + data.shippingFee - data.discount);

  const onlinePayment =
    data.paymentMethod === "bkash" || data.paymentMethod === "nagad";
  const paymentType = onlinePayment ? data.paymentType ?? "partial" : null;
  const paidAmount =
    onlinePayment && paymentType === "full" ? total : data.paidAmount;
  const dueAmount = Math.max(0, total - paidAmount);

  let senderNumber: string | null = null;
  if (onlinePayment) {
    const senderDigits = (data.senderNumber ?? "").replace(/\D/g, "");
    if (!/^01[3-9]\d{8}$/.test(senderDigits)) {
      res.status(400).json({ error: "Valid sender number is required." });
      return;
    }
    if (paymentType === "partial" && (paidAmount <= 0 || paidAmount >= total)) {
      res.status(400).json({
        error: "Partial paid amount must be greater than 0 and less than total.",
      });
      return;
    }
    senderNumber = senderDigits;
  }

  // A manually refunded order stays refunded — the money already left, so the
  // recomputed paid/due figures must not silently flip it back.
  const paymentStatus =
    existing.paymentStatus === "refunded"
      ? "refunded"
      : paidAmount > 0 && paidAmount < total
        ? "partial"
        : paidAmount >= total && total > 0
          ? "paid"
          : "unpaid";

  const notes = data.notes ?? "";
  const changes = describeOrderChanges(existing, {
    customer: data.customer,
    items,
    subtotal,
    shippingFee: data.shippingFee,
    discount: data.discount,
    total,
    paidAmount,
    paymentMethod: data.paymentMethod,
    notes,
  });

  const editorId =
    req.user?.sub && mongoose.isValidObjectId(req.user.sub)
      ? new mongoose.Types.ObjectId(req.user.sub)
      : undefined;

  const updated = await OrderModel.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        customer: data.customer,
        items,
        subtotal,
        shippingFee: data.shippingFee,
        discount: data.discount,
        total,
        advance: paidAmount,
        remaining: dueAmount,
        paymentType,
        paidAmount,
        dueAmount,
        senderNumber,
        paymentMethod: data.paymentMethod,
        paymentStatus,
        notes,
      },
      $push: {
        editHistory: {
          at: new Date(),
          byId: editorId,
          byEmail: req.user?.email,
          changes: changes.length > 0 ? changes : ["Saved with no field changes"],
        },
      },
    },
    { new: true },
  ).lean();

  if (!updated) {
    res.status(404).json({ error: "not found" });
    return;
  }

  await applyStockDelta(tallyStockDelta(existing.items ?? [], items));

  res.json({ order: updated });
});

export default router;
