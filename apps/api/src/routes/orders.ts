import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { OrderModel } from "../models/Order.js";
import { ProductModel } from "../models/Product.js";
import { CouponModel } from "../models/Coupon.js";
import { getEffectivePrice } from "../lib/pricing.js";
import { getOrderDeliveryCharge } from "../lib/delivery.js";
import { adminRequired, authPayloadFromRequest } from "../lib/auth.js";
import { hashUserData, newEventId, sendCapiEvent } from "../lib/fb.js";
import { setPrivateNoStore } from "../lib/http.js";
import {
  buildDhakaDateRangeFilter,
  dhakaOrderDateKey,
} from "../lib/timezone.js";

const router = Router();
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

// Admin endpoints
router.get("/", adminRequired, async (req, res) => {
  setPrivateNoStore(res);
  const {
    from,
    to,
    status,
    source,
    q,
    page = "1",
    limit = "30",
  } = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (status && status !== "all") filter.status = status;
  if (source && source !== "all") filter.source = source;
  const dateFilter = buildDhakaDateRangeFilter(from, to);
  if (dateFilter) filter.createdAt = dateFilter;
  if (q) {
    filter.$or = [
      { orderNumber: { $regex: q, $options: "i" } },
      { "customer.name": { $regex: q, $options: "i" } },
      { "customer.phone": { $regex: q, $options: "i" } },
    ];
  }
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Math.min(Number(limit) || 30, 200));
  const skip = (pageNum - 1) * limitNum;
  const [items, total] = await Promise.all([
    OrderModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .select("orderNumber customer items total dueAmount remaining paymentMethod source status courier createdAt")
      .lean(),
    OrderModel.countDocuments(filter),
  ]);
  res.json({
    items,
    total,
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
  status: z
    .enum([
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
      "refunded",
    ])
    .optional(),
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
  const updated = await OrderModel.findByIdAndUpdate(
    req.params.id,
    parsed.data,
    { new: true },
  ).lean();
  if (!updated) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json({ order: updated });
});

export default router;
