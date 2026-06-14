// Shared types & constants for the GK Shop storefront/admin frontend.
// Local shared frontend/API types so apps/web can build standalone on Vercel.
// without depending on the local monorepo package. Keep in sync with the API copy.

export const CATEGORIES = [
  { slug: "rc-car", label: "RC Cars", apiName: "car" },
  { slug: "f1-jersey", label: "F1 Jerseys", apiName: "F1" },
  { slug: "esports", label: "E-Sports Jerseys", apiName: "E-sports" },
  { slug: "tshirt", label: "T-Shirts", apiName: "Tshirt" },
  { slug: "sleeves", label: "Hand Sleeves", apiName: "Sleeves" },
  { slug: "mask", label: "Masks", apiName: "Mask" },
  { slug: "yoyo", label: "YoYo", apiName: "YoYo" },
  { slug: "pc-accessories", label: "PC Accessories", apiName: "pc" },
  { slug: "consoles", label: "Consoles", apiName: "Console" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_METHODS = ["cod", "bkash", "nagad", "card", "manual"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ["unpaid", "partial", "paid", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface ProductVariant {
  name: string;
  options: ProductVariantOption[];
}

export interface ProductVariantOption {
  value: string;
  stock: number;
  sku?: string;
  price?: number;
}

export interface Product {
  _id: string;
  slug: string;
  title: string;
  description: string;
  /** Category ID (Mongo ObjectId) or, for legacy data, a {@link CategorySlug}. */
  category: string;
  price: number;
  compareAtPrice?: number;
  cost?: number;
  /** Buying / wholesale price per unit, used for gross profit calculations. */
  buyingPrice?: number;
  stock: number;
  images: string[];
  variants?: ProductVariant[];
  isFeatured?: boolean;
  isBestSelling?: boolean;
  isNewArrival?: boolean;
  /** Legacy homepage flag kept for older products. Prefer isFeatured. */
  featured?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderLineItem {
  productId?: string; // optional for custom line items
  title: string;
  image?: string;
  unitPrice: number;
  quantity: number;
  selectedVariants?: Record<string, string>;
  variantSku?: string;
  variantPrice?: number;
  custom?: boolean; // true for ad-hoc line items added by admin
  note?: string;
}

export interface OrderCustomer {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  shippingAddress?: string;
  deliveryAddress?: string;
  location?: string;
  customerAddress?: string;
  /** Legacy / admin custom-order field. */
  city?: string;
  /** Legacy / admin custom-order field. */
  area?: string;
  /** Storefront checkout writes this. */
  district?: string;
  /** Storefront checkout writes this. */
  thana?: string;
}

export interface Order {
  _id: string;
  orderNumber: string;
  customer: OrderCustomer;
  shippingAddress?: string;
  deliveryAddress?: string;
  location?: string;
  customerAddress?: string;
  items: OrderLineItem[];
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  advance: number;
  remaining: number;
  paymentType?: "full" | "partial" | null;
  paidAmount?: number;
  dueAmount?: number;
  senderNumber?: string | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  source: "storefront" | "manual"; // manual = admin-created custom order
  notes?: string;
  courier?: {
    provider?: string;
    invoice?: string;
    consignmentId?: string;
    trackingCode?: string;
    status?: string;
    deliveryStatus?: string;
    courierStatus?: string;
    response?: unknown;
    error?: string;
    createdAt?: string;
    updatedAt?: string;
  } | null;
  fbEventId?: string;
  /** Set when a signed-in customer placed the order. */
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DateRange {
  from?: string;
  to?: string;
}

// FB Pixel / CAPI shared event helpers
export type FbEventName =
  | "PageView"
  | "ViewContent"
  | "AddToCart"
  | "RemoveFromCart"
  | "InitiateCheckout"
  | "AddPaymentInfo"
  | "Purchase"
  | "Lead"
  | "CompleteRegistration"
  | "Search";

export interface FbDataLayerItem {
  id: string;
  name: string;
  category?: string;
  price: number;
  quantity: number;
  brand?: string;
}

export interface FbDataLayerPayload {
  event: FbEventName | "page_view" | "purchase" | "view_item" | "add_to_cart" | "begin_checkout";
  ecommerce?: {
    currency: string;
    value: number;
    items: FbDataLayerItem[];
    transaction_id?: string;
  };
  user_data?: {
    em?: string; // hashed
    ph?: string;
    fn?: string;
    ln?: string;
    ct?: string;
    fbp?: string;
    fbc?: string;
    external_id?: string;
  };
  event_id?: string;
}

export const CURRENCY = "BDT" as const;

export type UserRole = "customer" | "staff" | "admin";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  name?: string;
  phone?: string;
}

export interface AdminUserSummary {
  _id: string;
  email: string;
  name?: string;
  phone?: string;
  role: UserRole;
  createdAt: string;
}

export interface AdminCustomer {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  city?: string;
  orders: number;
  revenue: number;
  lastOrderAt: string;
}

export interface Coupon {
  _id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  minOrder?: number;
  maxRedemptions?: number;
  redeemed: number;
  startsAt?: string;
  endsAt?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type NotificationType = "order" | "low_stock" | "signup";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  href?: string;
  at: string;
}
