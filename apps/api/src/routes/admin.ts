import { Router } from "express";
import { z } from "zod";
import type { PipelineStage } from "mongoose";
import { OrderModel } from "../models/Order.js";
import { ProductModel } from "../models/Product.js";
import { UserModel } from "../models/User.js";
import { CouponModel } from "../models/Coupon.js";
import { AccountingOverrideModel } from "../models/AccountingOverride.js";
import { adminOnlyRequired, adminRequired, hashPassword } from "../lib/auth.js";
import { setPrivateNoStore } from "../lib/http.js";

const router = Router();

router.use(adminRequired);
router.use((_req, res, next) => {
  setPrivateNoStore(res);
  next();
});

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function buildDateFilter(from?: string, to?: string): Record<string, Date> | undefined {
  if (!from && !to) return undefined;
  const range: Record<string, Date> = {};
  if (from) range.$gte = parseLocalDate(from);
  if (to) {
    const end = parseLocalDate(to);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return range;
}

router.get("/stats", adminOnlyRequired, async (req, res) => {
  const { from, to } = req.query as Record<string, string>;
  const dateFilter = buildDateFilter(from, to);
  const orderMatch: Record<string, unknown> = {};
  if (dateFilter) orderMatch.createdAt = dateFilter;

  const [
    totalOrders,
    revenueAgg,
    pendingOrders,
    deliveredOrders,
    statusBreakdown,
    revenueByDay,
    productsSoldAgg,
    lowStockCount,
    newCustomers,
    grossAgg,
  ] = await Promise.all([
    OrderModel.countDocuments(orderMatch),
    OrderModel.aggregate([
      { $match: { ...orderMatch, status: { $nin: ["cancelled", "refunded"] } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    OrderModel.countDocuments({ ...orderMatch, status: "pending" }),
    OrderModel.countDocuments({ ...orderMatch, status: "delivered" }),
    OrderModel.aggregate([
      { $match: orderMatch },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    OrderModel.aggregate([
      { $match: { ...orderMatch, status: { $nin: ["cancelled", "refunded"] } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          total: { $sum: "$total" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    OrderModel.aggregate([
      { $match: { ...orderMatch, status: { $nin: ["cancelled", "refunded"] } } },
      { $unwind: "$items" },
      { $group: { _id: null, qty: { $sum: "$items.quantity" } } },
    ]),
    ProductModel.countDocuments({ stock: { $lte: 3 } }),
    UserModel.countDocuments({
      role: "customer",
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    }),
    OrderModel.aggregate([
      { $match: { ...orderMatch, status: { $nin: ["cancelled", "refunded"] } } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $addFields: {
          buyingPrice: { $ifNull: [{ $arrayElemAt: ["$product.buyingPrice", 0] }, 0] },
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: { $multiply: ["$items.unitPrice", "$items.quantity"] } },
          cost: { $sum: { $multiply: ["$buyingPrice", "$items.quantity"] } },
        },
      },
    ]),
  ]);

  const grossRevenue = grossAgg[0]?.revenue ?? 0;
  const grossCost = grossAgg[0]?.cost ?? 0;
  const grossProfit = grossRevenue - grossCost;

  res.json({
    range: { from: from ?? null, to: to ?? null },
    totalOrders,
    revenue: revenueAgg[0]?.total ?? 0,
    pendingOrders,
    deliveredOrders,
    productsSold: productsSoldAgg[0]?.qty ?? 0,
    lowStockCount,
    newCustomers,
    grossRevenue,
    grossCost,
    grossProfit,
    statusBreakdown: Object.fromEntries(
      (statusBreakdown as Array<{ _id: string; count: number }>).map((r) => [r._id, r.count]),
    ),
    revenueByDay: revenueByDay as Array<{ _id: string; total: number; orders: number }>,
  });
});

router.get("/top-products", adminOnlyRequired, async (req, res) => {
  const { from, to, limit = "10" } = req.query as Record<string, string>;
  const dateFilter = buildDateFilter(from, to);
  const match: Record<string, unknown> = { status: { $nin: ["cancelled", "refunded"] } };
  if (dateFilter) match.createdAt = dateFilter;
  const items = await OrderModel.aggregate([
    { $match: match },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.title",
        qty: { $sum: "$items.quantity" },
        revenue: { $sum: { $multiply: ["$items.unitPrice", "$items.quantity"] } },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: Math.min(Number(limit) || 10, 50) },
  ]);
  res.json({ items });
});

router.get("/recent-orders", adminOnlyRequired, async (req, res) => {
  const items = await OrderModel.find().sort({ createdAt: -1 }).limit(10).lean();
  res.json({ items });
});

// === Reports ===
router.get("/reports", adminOnlyRequired, async (req, res) => {
  const { from, to } = req.query as Record<string, string>;
  const dateFilter = buildDateFilter(from, to);
  const match: Record<string, unknown> = { status: { $nin: ["cancelled", "refunded"] } };
  if (dateFilter) match.createdAt = dateFilter;

  const transactionsMatch: Record<string, unknown> = {};
  if (dateFilter) transactionsMatch.createdAt = dateFilter;

  const [
    byCategory,
    byPayment,
    bySource,
    aovAgg,
    repeatBuyers,
    grossAgg,
    transactions,
  ] = await Promise.all([
    OrderModel.aggregate([
      { $match: match },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $group: {
          _id: { $ifNull: [{ $arrayElemAt: ["$product.category", 0] }, "uncategorised"] },
          qty: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.unitPrice", "$items.quantity"] } },
        },
      },
      { $sort: { revenue: -1 } },
    ]),
    OrderModel.aggregate([
      { $match: match },
      { $group: { _id: "$paymentMethod", count: { $sum: 1 }, revenue: { $sum: "$total" } } },
      { $sort: { revenue: -1 } },
    ]),
    OrderModel.aggregate([
      { $match: match },
      { $group: { _id: "$source", count: { $sum: 1 }, revenue: { $sum: "$total" } } },
    ]),
    OrderModel.aggregate([
      { $match: match },
      { $group: { _id: null, avg: { $avg: "$total" }, count: { $sum: 1 } } },
    ]),
    OrderModel.aggregate([
      { $match: match },
      { $group: { _id: "$customer.phone", orders: { $sum: 1 } } },
      { $match: { orders: { $gte: 2 } } },
      { $count: "buyers" },
    ]),
    // Gross profit = sum over each line item of (unitPrice − product.buyingPrice) × quantity.
    // Custom / ad-hoc lines (no productId or no matched product) contribute their full
    // revenue as profit (no recorded cost).
    OrderModel.aggregate([
      { $match: match },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $addFields: {
          buyingPrice: {
            $ifNull: [{ $arrayElemAt: ["$product.buyingPrice", 0] }, 0],
          },
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: { $multiply: ["$items.unitPrice", "$items.quantity"] } },
          cost: { $sum: { $multiply: ["$buyingPrice", "$items.quantity"] } },
        },
      },
    ]),
    OrderModel.find(transactionsMatch)
      .sort({ createdAt: -1 })
      .limit(15)
      .select("orderNumber total status paymentMethod customer.name createdAt")
      .lean(),
  ]);

  const grossRevenue = grossAgg[0]?.revenue ?? 0;
  const grossCost = grossAgg[0]?.cost ?? 0;
  const grossProfit = grossRevenue - grossCost;
  const grossMargin = grossRevenue > 0 ? grossProfit / grossRevenue : 0;

  res.json({
    byCategory,
    byPayment,
    bySource,
    aov: aovAgg[0]?.avg ?? 0,
    orderCount: aovAgg[0]?.count ?? 0,
    repeatBuyers: repeatBuyers[0]?.buyers ?? 0,
    grossRevenue,
    grossCost,
    grossProfit,
    grossMargin,
    transactions,
  });
});

// === Accounting overrides (per-date-range manual entries) ===
const customExpenseSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().max(120).default(""),
  value: z.number().min(0).default(0),
});
const accountingSchema = z.object({
  shippingCharged: z.number().min(0).optional(),
  refunds: z.number().min(0).optional(),
  shippingExpense: z.number().min(0).optional(),
  ads: z.number().min(0).optional(),
  salaries: z.number().min(0).optional(),
  other: z.number().min(0).optional(),
  customExpenses: z.array(customExpenseSchema).max(50).optional(),
  notes: z.string().max(2000).optional(),
});

function rangeKey(from: string, to: string): string {
  const f = new Date(from);
  const t = new Date(to);
  const fk = `${f.getUTCFullYear()}-${String(f.getUTCMonth() + 1).padStart(2, "0")}-${String(
    f.getUTCDate(),
  ).padStart(2, "0")}`;
  const tk = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(
    t.getUTCDate(),
  ).padStart(2, "0")}`;
  return `${fk}..${tk}`;
}

router.get("/accounting", adminOnlyRequired, async (req, res) => {
  const { from, to } = req.query as Record<string, string>;
  if (!from || !to) {
    res.status(400).json({ error: "from and to are required" });
    return;
  }
  const key = rangeKey(from, to);
  const doc = await AccountingOverrideModel.findOne({ rangeKey: key }).lean();
  res.json({
    item: {
      rangeKey: key,
      shippingCharged: doc?.shippingCharged ?? 0,
      refunds: doc?.refunds ?? 0,
      shippingExpense: doc?.shippingExpense ?? 0,
      ads: doc?.ads ?? 0,
      salaries: doc?.salaries ?? 0,
      other: doc?.other ?? 0,
      customExpenses: doc?.customExpenses ?? [],
      notes: doc?.notes ?? "",
      updatedAt: doc?.updatedAt ?? null,
    },
  });
});

router.put("/accounting", adminOnlyRequired, async (req, res) => {
  const parsed = accountingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { from, to } = req.query as Record<string, string>;
  if (!from || !to) {
    res.status(400).json({ error: "from and to query params required" });
    return;
  }
  const key = rangeKey(from, to);
  const doc = await AccountingOverrideModel.findOneAndUpdate(
    { rangeKey: key },
    {
      $set: { ...parsed.data, from: new Date(from), to: new Date(to), rangeKey: key },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  res.json({ item: doc });
});

// === Customers ===
router.get("/customers", adminOnlyRequired, async (req, res) => {
  const { q, page = "1", limit = "30" } = req.query as Record<string, string>;
  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
  const lim = Math.min(Number(limit) || 30, 200);

  // Aggregate distinct customers from orders (covers guest checkouts + registered users)
  const pipeline: PipelineStage[] = [
    {
      $group: {
        _id: { $ifNull: ["$customer.phone", "$customer.email"] },
        name: { $first: "$customer.name" },
        phone: { $first: "$customer.phone" },
        email: { $first: "$customer.email" },
        city: { $first: "$customer.city" },
        orders: { $sum: 1 },
        revenue: { $sum: "$total" },
        lastOrderAt: { $max: "$createdAt" },
      },
    },
  ];
  if (q) {
    pipeline.push({
      $match: {
        $or: [
          { name: { $regex: q, $options: "i" } },
          { phone: { $regex: q, $options: "i" } },
          { email: { $regex: q, $options: "i" } },
        ],
      },
    });
  }
  const countPipeline: PipelineStage[] = [...pipeline, { $count: "n" }];
  pipeline.push({ $sort: { revenue: -1 } });
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: lim });

  const [items, totalAgg] = await Promise.all([
    OrderModel.aggregate(pipeline),
    OrderModel.aggregate(countPipeline),
  ]);
  res.json({ items, total: totalAgg[0]?.n ?? 0 });
});

// === Notifications (derived feed) ===
router.get("/notifications", adminOnlyRequired, async (_req, res) => {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const [recentOrders, lowStock, recentSignups] = await Promise.all([
    OrderModel.find({ createdAt: { $gte: since } })
      .sort({ createdAt: -1 })
      .limit(25)
      .lean(),
    ProductModel.find({ stock: { $lte: 3 } })
      .sort({ stock: 1 })
      .limit(15)
      .lean(),
    UserModel.find({ role: "customer", createdAt: { $gte: since } })
      .sort({ createdAt: -1 })
      .limit(15)
      .lean(),
  ]);

  type Notification = {
    id: string;
    type: "order" | "low_stock" | "signup";
    title: string;
    body: string;
    href?: string;
    at: Date;
  };

  const events: Notification[] = [
    ...recentOrders.map((o) => ({
      id: `order-${o._id}`,
      type: "order" as const,
      title: `New ${o.source === "manual" ? "manual " : ""}order ${o.orderNumber}`,
      body: `${o.customer.name} · ৳${o.total.toLocaleString()}`,
      href: `/admin/orders`,
      at: o.createdAt,
    })),
    ...lowStock.map((p) => ({
      id: `stock-${p._id}`,
      type: "low_stock" as const,
      title: `Low stock — ${p.title}`,
      body: `${p.stock} left`,
      href: `/admin/inventory`,
      at: p.updatedAt ?? new Date(),
    })),
    ...recentSignups.map((u) => ({
      id: `user-${u._id}`,
      type: "signup" as const,
      title: `New customer · ${u.name || u.email}`,
      body: u.email,
      href: `/admin/customers`,
      at: u.createdAt ?? new Date(),
    })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at));

  res.json({ items: events });
});

router.get("/inventory-summary", adminOnlyRequired, async (_req, res) => {
  const [total, low, out, stockValueAgg] = await Promise.all([
    ProductModel.countDocuments(),
    ProductModel.countDocuments({ stock: { $gt: 0, $lte: 3 } }),
    ProductModel.countDocuments({ stock: { $lte: 0 } }),
    ProductModel.aggregate([
      {
        $group: {
          _id: null,
          value: {
            $sum: {
              $multiply: ["$price", { $max: ["$stock", 0] }],
            },
          },
        },
      },
    ]),
  ]);

  res.json({
    total,
    low,
    out,
    stockValue: stockValueAgg[0]?.value ?? 0,
  });
});

// === Inventory: stock adjust ===
const stockAdjustSchema = z.object({
  delta: z.number().int(),
  reason: z.string().max(200).optional(),
});

router.post("/products/:id/stock", adminOnlyRequired, async (req, res) => {
  const parsed = stockAdjustSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const updated = await ProductModel.findByIdAndUpdate(
    req.params.id,
    { $inc: { stock: parsed.data.delta } },
    { new: true },
  ).lean();
  if (!updated) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json({ item: updated });
});

// === Coupons CRUD ===
const couponSchema = z.object({
  code: z.string().min(2),
  type: z.enum(["percent", "fixed"]),
  value: z.number().min(0),
  minOrder: z.number().min(0).optional(),
  maxRedemptions: z.number().int().min(0).optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  active: z.boolean().optional(),
});

router.get("/coupons", adminOnlyRequired, async (_req, res) => {
  const items = await CouponModel.find().sort({ createdAt: -1 }).lean();
  res.json({ items });
});

router.post("/coupons", adminOnlyRequired, async (req, res) => {
  const parsed = couponSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const created = await CouponModel.create(parsed.data);
    res.status(201).json({ item: created });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.patch("/coupons/:id", adminOnlyRequired, async (req, res) => {
  const updated = await CouponModel.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  }).lean();
  if (!updated) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json({ item: updated });
});

router.delete("/coupons/:id", adminOnlyRequired, async (req, res) => {
  await CouponModel.findByIdAndDelete(req.params.id);
  res.status(204).end();
});

// Public-ish: validate coupon code (still admin-protected for simplicity here;
// the /api/coupons/validate route below is the public one).
router.get("/coupons/:code", adminOnlyRequired, async (req, res) => {
  const item = await CouponModel.findOne({
    code: String(req.params.code).toUpperCase(),
  }).lean();
  if (!item) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json({ item });
});

// === Staff & users ===
const staffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(["staff", "admin"]),
});

router.get("/users", adminOnlyRequired, async (req, res) => {
  const { role, q } = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (role && role !== "all") filter.role = role;
  if (q) {
    filter.$or = [
      { email: { $regex: q, $options: "i" } },
      { name: { $regex: q, $options: "i" } },
      { phone: { $regex: q, $options: "i" } },
    ];
  }
  const items = await UserModel.find(filter)
    .select("email name phone role createdAt")
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  res.json({ items });
});

router.post("/users", adminOnlyRequired, async (req, res) => {
  const parsed = staffSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const exists = await UserModel.findOne({ email: parsed.data.email });
  if (exists) {
    res.status(409).json({ error: "email already in use" });
    return;
  }
  const passwordHash = await hashPassword(parsed.data.password);
  const user = await UserModel.create({
    email: parsed.data.email,
    passwordHash,
    name: parsed.data.name ?? "",
    phone: parsed.data.phone ?? "",
    role: parsed.data.role,
  });
  res.status(201).json({
    item: {
      _id: user._id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      createdAt: user.createdAt,
    },
  });
});

const userPatchSchema = z.object({
  role: z.enum(["customer", "staff", "admin"]).optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  password: z.string().min(6).optional(),
});

router.patch("/users/:id", adminOnlyRequired, async (req, res) => {
  const parsed = userPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const update: Record<string, unknown> = {};
  if (parsed.data.role) update.role = parsed.data.role;
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.phone !== undefined) update.phone = parsed.data.phone;
  if (parsed.data.password) update.passwordHash = await hashPassword(parsed.data.password);
  const updated = await UserModel.findByIdAndUpdate(req.params.id, update, { new: true })
    .select("email name phone role createdAt")
    .lean();
  if (!updated) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json({ item: updated });
});

router.delete("/users/:id", adminOnlyRequired, async (req, res) => {
  if (req.user?.sub === req.params.id) {
    res.status(400).json({ error: "cannot delete yourself" });
    return;
  }
  await UserModel.findByIdAndDelete(req.params.id);
  res.status(204).end();
});

export default router;
