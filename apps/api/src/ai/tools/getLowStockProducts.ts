import { z } from "zod";
import { DEFAULT_LOW_STOCK_THRESHOLD, getLowStockProducts } from "../../services/product.service.js";
import { defineTool } from "../types.js";

const schema = z.object({
  threshold: z.number().int().min(0).max(10_000).default(DEFAULT_LOW_STOCK_THRESHOLD),
  limit: z.number().int().min(1).max(50).default(20),
  includeInactive: z.boolean().default(false),
});

export default defineTool({
  name: "getLowStockProducts",
  type: "read",
  description:
    `Products whose stock is at or below a threshold (default ${DEFAULT_LOW_STOCK_THRESHOLD}, the same rule as the ` +
    "dashboard's low-stock count), lowest stock first. Includes out-of-stock products (stock 0 or below). " +
    "Hidden (inactive) products are left out unless includeInactive is true.",
  inputSchema: {
    type: "object",
    properties: {
      threshold: {
        type: "integer",
        minimum: 0,
        maximum: 10000,
        description: `Stock at or below this counts as low. Default ${DEFAULT_LOW_STOCK_THRESHOLD}.`,
      },
      limit: { type: "integer", minimum: 1, maximum: 50, description: "Max products to return. Default 20." },
      includeInactive: { type: "boolean", description: "Also include products hidden from the storefront." },
    },
    required: [],
    additionalProperties: false,
  },
  schema,
  handler: async ({ threshold, limit, includeInactive }) => {
    const { total, outOfStock, items } = await getLowStockProducts({ threshold, limit, includeInactive });
    return {
      data: {
        threshold,
        includeInactive,
        totalLowStock: total,
        outOfStock,
        returned: items.length,
        products: items,
        ...(total === 0 ? { note: `No products at or below stock ${threshold}.` } : {}),
        ...(total > items.length ? { note: `${total - items.length} more not shown; raise limit to see them.` } : {}),
      },
    };
  },
});
