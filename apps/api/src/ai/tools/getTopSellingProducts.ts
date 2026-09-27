import { z } from "zod";
import { getTopSellingProducts } from "../../services/sales.service.js";
import { periodFields, periodJsonSchema, resolvePeriod } from "../period.js";
import { defineTool } from "../types.js";
import { periodInfo } from "./shared.js";

const schema = z.object({
  ...periodFields,
  limit: z.number().int().min(1).max(20).default(5),
  sortBy: z.enum(["units", "revenue"]).default("units"),
});

export default defineTool({
  name: "getTopSellingProducts",
  type: "read",
  description:
    "Best-selling products in a period (Asia/Dhaka days), excluding cancelled, refunded and returned orders. " +
    "Each row has units sold, item revenue (unit price × quantity), number of orders and current stock. " +
    "Rank by units (default, for 'selling the most') or by revenue (when the admin asks about earnings or revenue). " +
    "Every row has both figures: give both, and say which one you ranked by (e.g. 'ranked by units sold'). " +
    "Rows with custom: true are one-off custom order lines, not catalogue products.",
  inputSchema: {
    type: "object",
    properties: {
      ...periodJsonSchema,
      limit: { type: "integer", minimum: 1, maximum: 20, description: "How many products. Default 5." },
      sortBy: {
        type: "string",
        enum: ["units", "revenue"],
        description: "Rank by units sold (default) or by revenue.",
      },
    },
    required: ["period"],
    additionalProperties: false,
  },
  schema,
  handler: async ({ limit, sortBy, ...periodInput }) => {
    const resolved = resolvePeriod(periodInput);
    const products = await getTopSellingProducts(resolved.range, { limit, sortBy });
    return {
      data: {
        period: periodInfo(resolved),
        currency: "BDT",
        sortBy,
        products,
        ...(products.length === 0 ? { note: "No products sold in this period." } : {}),
      },
    };
  },
});
