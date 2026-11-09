import mongoose from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import { useTestDb } from "../helpers/db.js";
import { CategoryModel } from "../../src/models/Category.js";
import { ProductModel } from "../../src/models/Product.js";
import { OrderModel } from "../../src/models/Order.js";
import { resolvePeriod } from "../../src/ai/period.js";
import {
  getSalesSummary,
  getTopCategoriesBySales,
  getTopSellingProducts,
} from "../../src/services/sales.service.js";

useTestDb();

// The Dhaka day 2026-09-28 runs 2026-09-27T18:00Z → 2026-09-28T18:00Z.
const DAY = resolvePeriod({ period: "custom", from: "2026-09-28", to: "2026-09-28" }).range;

let orderSeq = 0;
function order(status: string, createdAt: string, items: object[], extra: object = {}) {
  orderSeq += 1;
  const subtotal = (items as Array<{ unitPrice: number; quantity: number }>).reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  );
  const shippingFee = (extra as { shippingFee?: number }).shippingFee ?? 0;
  const discount = (extra as { discount?: number }).discount ?? 0;
  return {
    orderNumber: `T-${orderSeq}`,
    customer: { name: "Test", phone: "01700000000", address: "Dhaka" },
    items,
    subtotal,
    shippingFee,
    discount,
    total: subtotal + shippingFee - discount,
    status,
    createdAt: new Date(createdAt),
  };
}

let g102: mongoose.Types.ObjectId;
let k120: mongoose.Types.ObjectId;
let mice: mongoose.Types.ObjectId;
const deletedProduct = new mongoose.Types.ObjectId();

beforeEach(async () => {
  const peripherals = await CategoryModel.create({ slug: "peripherals", name: "Peripherals" });
  const miceCat = await CategoryModel.create({ slug: "mice", name: "Mice", parentId: peripherals._id });
  const keyboards = await CategoryModel.create({ slug: "keyboards", name: "Keyboards" });
  mice = miceCat._id;
  g102 = (await ProductModel.create({ slug: "g102", title: "Logitech G102", category: mice, price: 2300, stock: 2 }))._id;
  k120 = (await ProductModel.create({ slug: "k120", title: "Logitech K120", category: keyboards._id, price: 1500, stock: 10 }))._id;

  // `timestamps: true` would overwrite createdAt, so insert raw documents.
  await OrderModel.collection.insertMany([
    // Dhaka 00:00 on the 28th — first instant inside the day.
    order("confirmed", "2026-09-27T18:00:00Z", [{ productId: g102, title: "Logitech G102", unitPrice: 2300, quantity: 2 }], { shippingFee: 60, discount: 100 }),
    // Sold under an old name: must still group with G102 and read as its current name.
    order("delivered", "2026-09-28T10:00:00Z", [
      { productId: g102, title: "G102 (old name)", unitPrice: 2300, quantity: 1 },
      { productId: k120, title: "Logitech K120", unitPrice: 1500, quantity: 1 },
    ], { shippingFee: 60 }),
    order("exchange", "2026-09-28T11:00:00Z", [{ title: "USB cable", unitPrice: 100, quantity: 3, custom: true }]),
    order("called_no_answer", "2026-09-28T12:00:00Z", [{ productId: deletedProduct, title: "Old headset", unitPrice: 500, quantity: 1 }]),
    // Excluded statuses.
    order("cancelled", "2026-09-28T13:00:00Z", [{ productId: g102, title: "Logitech G102", unitPrice: 2300, quantity: 5 }]),
    order("returned", "2026-09-28T14:00:00Z", [{ productId: k120, title: "Logitech K120", unitPrice: 1500, quantity: 1 }]),
    // Dhaka 23:59:59 on the 27th — just outside the day.
    order("confirmed", "2026-09-27T17:59:59Z", [{ productId: k120, title: "Logitech K120", unitPrice: 1500, quantity: 9 }]),
  ]);
});

describe("getSalesSummary", () => {
  it("totals sale orders inside the Dhaka day and reports exclusions", async () => {
    const summary = await getSalesSummary(DAY);
    expect(summary).toEqual({
      orders: 4,
      revenue: 4560 + 3860 + 300 + 500,
      averageOrderValue: Math.round(9220 / 4),
      unitsSold: 2 + 2 + 3 + 1,
      itemRevenue: 4600 + 3800 + 300 + 500,
      shippingFees: 120,
      discounts: 100,
      excluded: {
        statuses: ["cancelled", "refunded", "returned"],
        orders: 2,
        total: 11500 + 1500,
        byStatus: { cancelled: 1, returned: 1 },
      },
    });
  });

  it("returns zeros for an empty period", async () => {
    const empty = resolvePeriod({ period: "custom", from: "2025-01-01", to: "2025-01-01" }).range;
    const summary = await getSalesSummary(empty);
    expect(summary).toMatchObject({ orders: 0, revenue: 0, averageOrderValue: 0, unitsSold: 0 });
    expect(summary.excluded.orders).toBe(0);
  });
});

describe("getTopSellingProducts", () => {
  it("groups by productId under the current name, ranked by units", async () => {
    const rows = await getTopSellingProducts(DAY, { limit: 10, sortBy: "units" });
    expect(rows.map((row) => [row.title, row.unitsSold, row.revenue])).toEqual([
      ["Logitech G102", 3, 6900],
      ["USB cable", 3, 300],
      ["Logitech K120", 1, 1500],
      ["Old headset", 1, 500],
    ]);
    expect(rows[0]).toMatchObject({ productId: String(g102), orders: 2, currentStock: 2, custom: false });
    expect(rows[1]).toMatchObject({ productId: null, custom: true, currentStock: null });
    // A deleted product keeps its id and order-line title.
    expect(rows[3]).toMatchObject({ productId: String(deletedProduct), custom: false, currentStock: null });
  });

  it("ranks by revenue and honours the limit", async () => {
    const rows = await getTopSellingProducts(DAY, { limit: 2, sortBy: "revenue" });
    expect(rows.map((row) => row.title)).toEqual(["Logitech G102", "Logitech K120"]);
  });
});

describe("getTopCategoriesBySales", () => {
  it("ranks categories and buckets custom and deleted items together", async () => {
    const result = await getTopCategoriesBySales(DAY, { limit: 10 });
    expect(result.totalItemRevenue).toBe(9200);
    expect(result.categoryCount).toBe(3);
    expect(result.categories).toEqual([
      { categoryId: String(mice), name: "Mice", parentName: "Peripherals", unitsSold: 3, revenue: 6900, orders: 2, revenueShare: 75 },
      expect.objectContaining({ name: "Keyboards", parentName: null, unitsSold: 1, revenue: 1500, orders: 1, revenueShare: 16.3 }),
      expect.objectContaining({ name: "Uncategorised / custom items", categoryId: null, unitsSold: 4, revenue: 800, orders: 2, revenueShare: 8.7 }),
    ]);
  });

  it("applies the limit after computing the total", async () => {
    const result = await getTopCategoriesBySales(DAY, { limit: 1 });
    expect(result.categories).toHaveLength(1);
    expect(result.totalItemRevenue).toBe(9200);
    expect(result.categoryCount).toBe(3);
  });
});
