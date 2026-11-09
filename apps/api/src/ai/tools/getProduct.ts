import { z } from "zod";
import { getProductDetail } from "../../services/product.service.js";
import { AiToolError } from "../errors.js";
import { defineTool } from "../types.js";
import { ADMIN_PRODUCTS_PATH } from "./shared.js";

const schema = z.object({
  productId: z.string().trim().min(1).max(200),
});

export default defineTool({
  name: "getProduct",
  type: "read",
  description:
    "Full details for one product by id (from searchProduct) or slug: prices (price, discount price, effective " +
    "customer price, buying price), stock, variants with per-option stock/price/SKU, visibility and flags. " +
    "Use searchProduct first when you only have a name.",
  inputSchema: {
    type: "object",
    properties: {
      productId: { type: "string", description: "Product id, or the product slug." },
    },
    required: ["productId"],
    additionalProperties: false,
  },
  schema,
  handler: async ({ productId }) => {
    const product = await getProductDetail(productId);
    if (!product) {
      throw new AiToolError(`No product found with id or slug "${productId}". Use searchProduct to find it.`);
    }
    return { data: { ...product, adminPage: ADMIN_PRODUCTS_PATH } };
  },
});
