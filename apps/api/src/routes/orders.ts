import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { OrderModel } from "../models/Order.js";
import { ProductModel } from "../models/Product.js";
import { CouponModel } from "../models/Coupon.js";
import { adminRequired, verifyToken } from "../lib/auth.js";
import { hashUserData, newEventId, sendCapiEvent } from "../lib/fb.js";

const router = Router();

const lineSchema = z.object({
  productId: z.string().optional(),
  title: z.string(),
  image: z.string().optional(),
  unitPrice: z.number().min(0),
  quantity: z.number().int().min(1),
  custom: z.boolean().optional(),
  note: z.string().optional(),
});

// Customer shape is intentionally lenient on location: the storefront ships
// district/thana, while admin custom-order builder ships city/area. Both
// combinations are accepted and persisted as-is.
const customerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(5),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().min(2),
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
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `GK-${ymd}-${rand}`;
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
  const authHeader = req.header("authorization") ?? "";
  const rawToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const jwtPayload = rawToken ? verifyToken(rawToken) : null;
  const userId =
    jwtPayload?.sub && mongoose.isValidObjectId(jwtPayload.sub)
      ? new mongoose.Types.ObjectId(jwtPayload.sub)
      : undefined;

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
    ? await ProductModel.find({ _id: { $in: productIds } }).lean()
    : [];
  const productById = new Map(products.map((p) => [String(p._id), p]));

  const items = data.items.map((line) => {
    if (line.custom || !line.productId) return line;
    const p = productById.get(line.productId);
    if (!p) return line; // product was deleted; honour whatever was on the client
    return {
      ...line,
      title: p.title ?? line.title,
      image: line.image ?? (Array.isArray(p.images) ? p.images[0] : undefined),
      unitPrice: typeof p.price === "number" ? p.price : line.unitPrice,
    };
  });

  const subtotal = items.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const total = Math.max(0, subtotal + data.shippingFee - data.discount);
  const remaining = Math.max(0, total - data.advance);
  const eventId = data.eventId ?? newEventId();
  const orderNumber = genOrderNumber();

  // Payment status follows the money. Online prepayments collected up front
  // settle to "paid"; COD / advance flows start "unpaid"/"partial" until the
  // admin marks them on the order detail page.
  const paymentStatus =
    data.advance > 0 && data.advance < total
      ? "partial"
      : data.advance >= total && total > 0
        ? "paid"
        : "unpaid";

  const order = await OrderModel.create({
    orderNumber,
    customer: data.customer,
    items,
    subtotal,
    shippingFee: data.shippingFee,
    discount: data.discount,
    total,
    advance: data.advance,
    remaining,
    paymentMethod: data.paymentMethod,
    paymentStatus,
    source: data.source,
    notes: data.notes,
    couponCode: data.couponCode,
    fbEventId: eventId,
    userId,
  });

  // decrement stock for non-custom lines
  for (const line of data.items) {
    if (line.productId && !line.custom) {
      await ProductModel.findByIdAndUpdate(line.productId, {
        $inc: { stock: -line.quantity },
      }).catch(() => null);
    }
  }

  // increment coupon redemption count
  if (data.couponCode) {
    await CouponModel.findOneAndUpdate(
      { code: data.couponCode.toUpperCase() },
      { $inc: { redeemed: 1 } },
    ).catch(() => null);
  }

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
  const order = await OrderModel.findOne({ orderNumber: req.params.orderNumber }).lean();
  if (!order) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json({ order });
});

router.get("/by-phone/:phone", async (req, res) => {
  const orders = await OrderModel.find({ "customer.phone": req.params.phone })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
  if (orders.length === 0) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json({ orders });
});

// Admin endpoints
router.get("/", adminRequired, async (req, res) => {
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
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      range.$lte = end;
    }
    filter.createdAt = range;
  }
  if (q) {
    filter.$or = [
      { orderNumber: { $regex: q, $options: "i" } },
      { "customer.name": { $regex: q, $options: "i" } },
      { "customer.phone": { $regex: q, $options: "i" } },
    ];
  }
  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    OrderModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Math.min(Number(limit), 200))
      .lean(),
    OrderModel.countDocuments(filter),
  ]);
  res.json({ items, total, page: Number(page), limit: Number(limit) });
});

router.get("/:id", adminRequired, async (req, res) => {
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
