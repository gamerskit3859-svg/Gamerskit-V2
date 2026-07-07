export type PricedProduct = {
  price: number;
  compareAtPrice?: number | null;
};

// compareAtPrice is this codebase's discount-price field (admin UI labels it
// "Discount price"): when set and lower than price, it's the effective price.
export function getEffectivePrice(product: PricedProduct): number {
  return product.compareAtPrice != null &&
    product.compareAtPrice > 0 &&
    product.compareAtPrice < product.price
    ? product.compareAtPrice
    : product.price;
}
