import { z } from "zod";
import { getSalesSummary } from "../../services/sales.service.js";
import { periodFields, periodJsonSchema, resolvePeriod } from "../period.js";
import { defineTool } from "../types.js";
import { periodInfo } from "./shared.js";

const schema = z.object(periodFields);

export default defineTool({
  name: "getSalesSummary",
  type: "read",
  description:
    "Sales totals for a period (Asia/Dhaka days), using the same rules as the admin dashboard: order count, " +
    "revenue (sum of order totals after discount, including shipping), average order value, units sold, " +
    "item revenue (unit price × quantity, before discount and shipping), shipping fees and discounts. " +
    "Also reports which statuses were excluded (cancelled, refunded, returned) and how many orders that left out. " +
    "Mention the exclusion when you give a sales figure.",
  inputSchema: {
    type: "object",
    properties: { ...periodJsonSchema },
    required: ["period"],
    additionalProperties: false,
  },
  schema,
  handler: async (input) => {
    const resolved = resolvePeriod(input);
    const summary = await getSalesSummary(resolved.range);
    return {
      data: {
        period: periodInfo(resolved),
        currency: "BDT",
        ...summary,
        ...(summary.orders === 0 ? { note: "No qualifying orders in this period." } : {}),
      },
    };
  },
});
