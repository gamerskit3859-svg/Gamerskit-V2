import { z } from "zod";
import { getTopCategoriesBySales } from "../../services/sales.service.js";
import { periodFields, periodJsonSchema, resolvePeriod } from "../period.js";
import { defineTool } from "../types.js";
import { periodInfo } from "./shared.js";

const schema = z.object({
  ...periodFields,
  limit: z.number().int().min(1).max(20).default(5),
});

export default defineTool({
  name: "getTopCategoriesBySales",
  type: "read",
  description:
    "Categories ranked by item revenue (unit price × quantity) in a period (Asia/Dhaka days), excluding " +
    "cancelled, refunded and returned orders. Each row has units sold, orders, revenue and share of total item " +
    "revenue. Products count under their current category; subcategories are NOT rolled into their parent. " +
    "When a row has a parentName, mention it (e.g. 'Mice, under Peripherals'). " +
    "'Uncategorised / custom items' holds custom order lines and deleted products.",
  inputSchema: {
    type: "object",
    properties: {
      ...periodJsonSchema,
      limit: { type: "integer", minimum: 1, maximum: 20, description: "How many categories. Default 5." },
    },
    required: ["period"],
    additionalProperties: false,
  },
  schema,
  handler: async ({ limit, ...periodInput }) => {
    const resolved = resolvePeriod(periodInput);
    const result = await getTopCategoriesBySales(resolved.range, { limit });
    return {
      data: {
        period: periodInfo(resolved),
        currency: "BDT",
        ...result,
        ...(result.categories.length === 0 ? { note: "No sales in this period." } : {}),
      },
    };
  },
});
