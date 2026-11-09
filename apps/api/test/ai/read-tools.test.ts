import { beforeEach, describe, expect, it } from "vitest";
import { useTestDb } from "../helpers/db.js";
import { getTool } from "../../src/ai/toolRegistry.js";
import { AiToolError } from "../../src/ai/errors.js";
import type { AiToolContext } from "../../src/ai/types.js";
import { CategoryModel } from "../../src/models/Category.js";
import { ProductModel } from "../../src/models/Product.js";

useTestDb();

const ctx: AiToolContext = { adminId: "a", adminEmail: "a@x.test", adminName: "A", prompt: "" };

/** Run a tool the way the assistant loop does: zod-parse the raw input, then call the handler. */
async function run(name: string, rawInput: unknown) {
  const tool = getTool(name)!;
  const parsed = tool.schema.safeParse(rawInput);
  if (!parsed.success) throw parsed.error;
  return (await tool.handler(parsed.data, ctx)).data as Record<string, unknown>;
}

beforeEach(async () => {
  const cat = await CategoryModel.create({ slug: "mice", name: "Mice" });
  await ProductModel.create({ slug: "g102", title: "Logitech G102", category: cat._id, price: 2300, stock: 1 });
});

describe("read tools", () => {
  it("fills defaults and says when a period is empty", async () => {
    const data = await run("getSalesSummary", { period: "today" });
    expect(data).toMatchObject({ currency: "BDT", orders: 0, note: "No qualifying orders in this period." });
    expect(data.period).toMatchObject({ name: "today", timezone: "Asia/Dhaka" });

    const top = await run("getTopSellingProducts", { period: "this_month" });
    expect(top).toMatchObject({ sortBy: "units", products: [], note: "No products sold in this period." });
  });

  it("uses the dashboard's low-stock threshold by default", async () => {
    const data = await run("getLowStockProducts", {});
    expect(data).toMatchObject({ threshold: 3, totalLowStock: 1, includeInactive: false });
  });

  it("flags ambiguity on search", async () => {
    expect(await run("searchProduct", { query: "g102" })).toMatchObject({ totalMatches: 1, ambiguous: false });
  });

  it("rejects input outside the schema", () => {
    expect(getTool("getTopSellingProducts")!.schema.safeParse({ period: "forever" }).success).toBe(false);
    expect(getTool("getLowStockProducts")!.schema.safeParse({ threshold: -1 }).success).toBe(false);
    expect(getTool("searchProduct")!.schema.safeParse({ query: "  " }).success).toBe(false);
  });

  it("reports a missing product as a tool error Claude can read", async () => {
    await expect(run("getProduct", { productId: "nope" })).rejects.toBeInstanceOf(AiToolError);
  });

  it("reports a bad custom range as a tool error", async () => {
    await expect(run("getSalesSummary", { period: "custom", from: "2026-05-01" })).rejects.toThrow(/needs both/);
  });
});
