import { Router } from "express";
import { OrderModel } from "../models/Order.js";
import { ProductModel } from "../models/Product.js";
import { adminRequired } from "../lib/auth.js";

const router = Router();

router.use(adminRequired);

function buildDateFilter(from?: string, to?: string): Record<string, Date> | undefined {
  if (!from && !to) return undefined;
  const range: Record<string, Date> = {};
  if (from) range.$gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return range;
}

router.get("/stats", async (req, res) => {
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
  ]);

  res.json({
    range: { from: from ?? null, to: to ?? null },
    totalOrders,
    revenue: revenueAgg[0]?.total ?? 0,
    pendingOrders,
    deliveredOrders,
    productsSold: productsSoldAgg[0]?.qty ?? 0,
    lowStockCount,
    statusBreakdown: Object.fromEntries(
      (statusBreakdown as Array<{ _id: string; count: number }>).map((r) => [r._id, r.count]),
    ),
    revenueByDay: revenueByDay as Array<{ _id: string; total: number; orders: number }>,
  });
});

router.get("/top-products", async (req, res) => {
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

router.get("/recent-orders", async (req, res) => {
  const items = await OrderModel.find().sort({ createdAt: -1 }).limit(10).lean();
  res.json({ items });
});

export default router;
