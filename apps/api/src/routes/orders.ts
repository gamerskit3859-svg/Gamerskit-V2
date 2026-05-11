import { Router } from "express";
import { z } from "zod";
import { OrderModel } from "../models/Order.js";
import { ProductModel } from "../models/Product.js";
import { CouponModel } from "../models/Coupon.js";
import { adminRequired } from "../lib/auth.js";
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

const customerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(5),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().min(2),
  district: z.string().min(1),
  thana: z.string().optional(),
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
  const subtotal = data.items.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const total = Math.max(0, subtotal + data.shippingFee - data.discount);
  const remaining = Math.max(0, total - data.advance);
  const eventId = data.eventId ?? newEventId();
  const orderNumber = genOrderNumber();

  const order = await OrderModel.create({
    orderNumber,
    customer: data.customer,
    items: data.items,
    subtotal,
    shippingFee: data.shippingFee,
    discount: data.discount,
    total,
    advance: data.advance,
    remaining,
    paymentMethod: data.paymentMethod,
    source: data.source,
    notes: data.notes,
    couponCode: data.couponCode,
    fbEventId: eventId,
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
      content_ids: data.items.map((l) => l.productId ?? `custom-${l.title}`),
      contents: data.items.map((l) => ({
        id: l.productId ?? `custom-${l.title}`,
        quantity: l.quantity,
        item_price: l.unitPrice,
      })),
      num_items: data.items.reduce((s, l) => s + l.quantity, 0),
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

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

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
    if (from) range.$gte = parseLocalDate(from);
    if (to) {
      const end = parseLocalDate(to);
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

router.patch("/:id", adminRequired, async (req, res) => {
  const updated = await OrderModel.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  }).lean();
  if (!updated) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json({ order: updated });
});

export default router;
