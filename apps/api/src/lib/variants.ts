export type VariantGroup = {
  name?: string;
  options?: Array<{ value?: string; stock?: number; sku?: string; price?: number }>;
};

export function hasVariants(product: { variants?: VariantGroup[] }) {
  return Array.isArray(product.variants) && product.variants.some((group) => group.options?.length);
}

/** A variant product's stock is the sum of its option stocks. */
export function variantStock(variants?: VariantGroup[]) {
  if (!Array.isArray(variants)) return 0;
  return variants.reduce(
    (sum, group) =>
      sum +
      (group.options ?? []).reduce(
        (optionSum, option) => optionSum + (Number(option.stock) || 0),
        0,
      ),
    0,
  );
}
