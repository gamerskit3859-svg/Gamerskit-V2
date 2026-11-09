import type { Types } from "mongoose";
import { NON_REVENUE_ORDER_STATUSES, OrderModel } from "../models/Order.js";
import { CategoryModel } from "../models/Category.js";
import type { DateRangeFilter } from "../lib/timezone.js";

/**
 * Sales figures shared by the admin AI assistant. The definitions match the
 * admin dashboard (routes/admin.ts) so both report the same numbers:
 *
 *   - An order counts as a sale unless its status is in
 *     NON_REVENUE_ORDER_STATUSES (cancelled, refunded, returned).
 *   - Orders are bucketed by createdAt — there is no delivered-at field.
 *   - "revenue" is the sum of order totals (after discount, incl. shipping),
 *     the dashboard's Revenue card.
 *   - "itemRevenue" is Σ unitPrice × quantity over line items (before order
 *     discount, excl. shipping), the dashboard's gross revenue and the basis
 *     for per-product and per-category figures.
 */

export type SalesRange = Required<DateRangeFilter>;

function saleMatch(range: SalesRange) {
  return { createdAt: range, status: { $nin: NON_REVENUE_ORDER_STATUSES } };
}

const lineRevenue = { $multiply: ["$items.unitPrice", "$items.quantity"] };

export type SalesSummary = {
  orders: number;
  revenue: number;
  averageOrderValue: number;
  unitsSold: number;
  itemRevenue: number;
  shippingFees: number;
  discounts: number;
  excluded: {
    statuses: string[];
    orders: number;
    total: number;
    byStatus: Record<string, number>;
  };
};

export async function getSalesSummary(range: SalesRange): Promise<SalesSummary> {
  const [totalsAgg, itemsAgg, excludedAgg] = await Promise.all([
    OrderModel.aggregate([
      { $match: saleMatch(range) },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          revenue: { $sum: "$total" },
          shippingFees: { $sum: { $ifNull: ["$shippingFee", 0] } },
          discounts: { $sum: { $ifNull: ["$discount", 0] } },
        },
      },
    ]),
    OrderModel.aggregate([
      { $match: saleMatch(range) },
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          unitsSold: { $sum: "$items.quantity" },
          itemRevenue: { $sum: lineRevenue },
        },
      },
    ]),
    // Reported alongside so "we sold X" can also say what was left out.
    OrderModel.aggregate([
      { $match: { createdAt: range, status: { $in: NON_REVENUE_ORDER_STATUSES } } },
      { $group: { _id: "$status", orders: { $sum: 1 }, total: { $sum: "$total" } } },
    ]),
  ]);

  const totals = totalsAgg[0] ?? {};
  const items = itemsAgg[0] ?? {};
  const excludedRows = excludedAgg as Array<{ _id: string; orders: number; total: number }>;
  const orders = totals.orders ?? 0;
  const revenue = totals.revenue ?? 0;

  return {
    orders,
    revenue,
    averageOrderValue: orders > 0 ? Math.round(revenue / orders) : 0,
    unitsSold: items.unitsSold ?? 0,
    itemRevenue: items.itemRevenue ?? 0,
    shippingFees: totals.shippingFees ?? 0,
    discounts: totals.discounts ?? 0,
    excluded: {
      statuses: [...NON_REVENUE_ORDER_STATUSES],
      orders: excludedRows.reduce((sum, row) => sum + row.orders, 0),
      total: excludedRows.reduce((sum, row) => sum + row.total, 0),
      byStatus: Object.fromEntries(excludedRows.map((row) => [row._id, row.orders])),
    },
  };
}

export type TopProductRow = {
  productId: string | null;
  title: string;
  custom: boolean;
  unitsSold: number;
  revenue: number;
  orders: number;
  currentStock: number | null;
};

/**
 * Best sellers in the window. Grouped by productId, so a product renamed
 * mid-period stays one row and reads under its current name. Custom line items
 * have no productId and group by their own title instead.
 */
export async function getTopSellingProducts(
  range: SalesRange,
  options: { limit: number; sortBy: "units" | "revenue" },
): Promise<TopProductRow[]> {
  const sort: Record<string, 1 | -1> =
    options.sortBy === "revenue"
      ? { revenue: -1, unitsSold: -1, title: 1 }
      : { unitsSold: -1, revenue: -1, title: 1 };

  const rows = await OrderModel.aggregate([
    { $match: saleMatch(range) },
    { $unwind: "$items" },
    {
      $group: {
        _id: { $ifNull: ["$items.productId", "$items.title"] },
        title: { $first: "$items.title" },
        unitsSold: { $sum: "$items.quantity" },
        revenue: { $sum: lineRevenue },
        orderIds: { $addToSet: "$_id" },
      },
    },
    { $sort: sort },
    { $limit: options.limit },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product",
      },
    },
    {
      $project: {
        _id: 1,
        title: { $ifNull: [{ $arrayElemAt: ["$product.title", 0] }, "$title"] },
        unitsSold: 1,
        revenue: 1,
        orders: { $size: "$orderIds" },
        currentStock: { $ifNull: [{ $arrayElemAt: ["$product.stock", 0] }, null] },
        isProductId: { $eq: [{ $type: "$_id" }, "objectId"] },
      },
    },
  ]);

  return (rows as Array<{
    _id: Types.ObjectId | string;
    title: string;
    unitsSold: number;
    revenue: number;
    orders: number;
    currentStock: number | null;
    isProductId: boolean;
  }>).map((row) => ({
    productId: row.isProductId ? String(row._id) : null,
    title: row.title,
    custom: !row.isProductId,
    unitsSold: row.unitsSold,
    revenue: row.revenue,
    orders: row.orders,
    currentStock: row.currentStock,
  }));
}

export type TopCategoryRow = {
  categoryId: string | null;
  name: string;
  parentName: string | null;
  unitsSold: number;
  revenue: number;
  orders: number;
  revenueShare: number;
};

/**
 * Sales per category, by each product's current category (the same basis as
 * the Accounting report's by-category table). Subcategories are not rolled up
 * into their parent; `parentName` is included so the model can say so.
 * Custom lines and deleted products land in one "Uncategorised" row.
 */
export async function getTopCategoriesBySales(
  range: SalesRange,
  options: { limit: number },
): Promise<{ categories: TopCategoryRow[]; totalItemRevenue: number; categoryCount: number }> {
  const rows = (await OrderModel.aggregate([
    { $match: saleMatch(range) },
    { $unwind: "$items" },
    // Collapse to one row per product first so the product lookup runs once
    // per product rather than once per line item.
    {
      $group: {
        _id: "$items.productId",
        unitsSold: { $sum: "$items.quantity" },
        revenue: { $sum: lineRevenue },
        orderIds: { $addToSet: "$_id" },
      },
    },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product",
      },
    },
    {
      $group: {
        _id: { $ifNull: [{ $arrayElemAt: ["$product.category", 0] }, null] },
        unitsSold: { $sum: "$unitsSold" },
        revenue: { $sum: "$revenue" },
        orderIds: { $push: "$orderIds" },
      },
    },
    {
      $project: {
        unitsSold: 1,
        revenue: 1,
        // Distinct orders across all of the category's products.
        orders: {
          $size: {
            $reduce: {
              input: "$orderIds",
              initialValue: [],
              in: { $setUnion: ["$$value", "$$this"] },
            },
          },
        },
      },
    },
    { $sort: { revenue: -1, unitsSold: -1 } },
  ])) as Array<{ _id: Types.ObjectId | null; unitsSold: number; revenue: number; orders: number }>;

  const totalItemRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const top = rows.slice(0, options.limit);

  const categoryIds = top.flatMap((row) => (row._id ? [row._id] : []));
  const categories = await CategoryModel.find({ _id: { $in: categoryIds } })
    .select("name parentId")
    .lean();
  const parentIds = categories.flatMap((cat) => (cat.parentId ? [cat.parentId] : []));
  const parents = parentIds.length
    ? await CategoryModel.find({ _id: { $in: parentIds } }).select("name").lean()
    : [];
  const byId = new Map([...categories, ...parents].map((cat) => [String(cat._id), cat]));

  return {
    totalItemRevenue,
    categoryCount: rows.length,
    categories: top.map((row) => {
      const category = row._id ? byId.get(String(row._id)) : undefined;
      const parent = category?.parentId ? byId.get(String(category.parentId)) : undefined;
      return {
        categoryId: row._id ? String(row._id) : null,
        name: row._id ? (category?.name ?? "Deleted category") : "Uncategorised / custom items",
        parentName: parent?.name ?? null,
        unitsSold: row.unitsSold,
        revenue: row.revenue,
        orders: row.orders,
        revenueShare: totalItemRevenue > 0 ? Math.round((row.revenue / totalItemRevenue) * 1000) / 10 : 0,
      };
    }),
  };
}
