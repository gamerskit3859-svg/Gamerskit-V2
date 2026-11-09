import { z } from "zod";
import { searchProducts } from "../../services/product.service.js";
import { defineTool } from "../types.js";

const schema = z.object({
  query: z.string().trim().min(1).max(100),
  limit: z.number().int().min(1).max(25).default(10),
});

export default defineTool({
  name: "searchProduct",
  type: "read",
  description:
    "Find products by name, part of a name, slug, variant SKU or exact product id. Every word must appear, " +
    "so 'logitech g102' matches 'Logitech G102 Prodigy'. Returns id, title, category, price, discount price, " +
    "effective (customer) price, stock and whether the product is active or has variants. " +
    "If more than one product matches and the admin wants to act on one, list the matches and ask which — never guess.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search text, e.g. 'g102' or 'logitech mouse'." },
      limit: { type: "integer", minimum: 1, maximum: 25, description: "Max products to return. Default 10." },
    },
    required: ["query"],
    additionalProperties: false,
  },
  schema,
  handler: async ({ query, limit }) => {
    const { total, items } = await searchProducts(query, { limit });
    return {
      data: {
        query,
        totalMatches: total,
        returned: items.length,
        ambiguous: total > 1,
        products: items,
        ...(total > items.length
          ? { note: `${total - items.length} more matches not shown; ask the admin to be more specific.` }
          : {}),
      },
    };
  },
});
