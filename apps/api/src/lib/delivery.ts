const METRO_FEE = 70;
const DHAKA_SUBURBAN_FEE = 100;
const STANDARD_FEE = 130;

type DistrictZone = "dhaka" | "dhaka-suburban" | "chattogram" | "other";

function classifyDistrict(district?: string | null): DistrictZone {
  const normalized = (district ?? "").trim().toLowerCase();
  if (!normalized) return "other";
  if (normalized.startsWith("dhaka sub") || normalized.includes("sub-urban") || normalized.includes("suburban")) {
    return "dhaka-suburban";
  }
  if (normalized.startsWith("dhaka")) return "dhaka";
  if (normalized.startsWith("chattogram")) return "chattogram";
  return "other";
}

export type DeliveryChargeInput = {
  freeDelivery: boolean;
  district?: string | null;
};

// Single source of truth for delivery charges. freeDelivery always wins;
// otherwise Dhaka/Chattogram get the metro rate, Dhaka Sub-Urban its own
// rate, and everywhere else the standard rate.
export function getDeliveryCharge({ freeDelivery, district }: DeliveryChargeInput): number {
  if (freeDelivery) return 0;
  const zone = classifyDistrict(district);
  if (zone === "dhaka-suburban") return DHAKA_SUBURBAN_FEE;
  if (zone === "dhaka" || zone === "chattogram") return METRO_FEE;
  return STANDARD_FEE;
}

// An order only carries free delivery when every line item qualifies —
// there's a single shippingFee per order, not one per line.
export function getOrderDeliveryCharge(
  items: Array<{ freeDelivery?: boolean }>,
  district?: string | null,
): number {
  const allFreeDelivery = items.length > 0 && items.every((item) => item.freeDelivery === true);
  return getDeliveryCharge({ freeDelivery: allFreeDelivery, district });
}
