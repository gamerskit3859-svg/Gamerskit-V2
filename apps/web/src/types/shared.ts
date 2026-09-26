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

// Ordered along the real COD lifecycle so the admin status dropdown reads top
// to bottom as the order progresses. New orders arrive as "confirmed"; the
// "called_*" pair is the phone verification step; "waiting_stock" parks an
// order that cannot be packed until the item is back on the shelf; "exchange"
// is a replacement parcel going back out; "returned" is the courier bringing
// one back.
export const ORDER_STATUSES = [
  "confirmed",
  "called_confirmed",
  "called_no_answer",
  "waiting_stock",
  "exchange",
  "delivered",
  "returned",
  "cancelled",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Display labels for order statuses. The stored values are snake_case, so every
 * admin surface renders through this map rather than printing the raw enum.
 */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  confirmed: "Confirmed",
  called_confirmed: "Called & confirmed",
  called_no_answer: "Called & no answer",
  waiting_stock: "Waiting on stock",
  exchange: "Exchange",
  delivered: "Delivered",
  returned: "Returned",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export type OrderStatusTone =
  | "neutral"
  | "success"
  | "warning"
  | "info"
  | "danger"
  | "accent";

/** Badge tone per status, shared by the order list and the order detail page. */
export const ORDER_STATUS_TONES: Record<OrderStatus, OrderStatusTone> = {
  confirmed: "info",
  called_confirmed: "info",
  called_no_answer: "warning",
  // Parked, not in trouble: the order is fine, the shelf is not.
  waiting_stock: "warning",
  // Its own colour: an exchange is neither in trouble nor progressing normally,
  // and it is the one status that changes what the courier collects.
  exchange: "accent",
  delivered: "success",
  returned: "danger",
  cancelled: "danger",
  refunded: "danger",
};

/**
 * Sort options accepted by the admin order list endpoint. Values must match the
 * ORDER_SORTS keys in apps/api/src/routes/orders.ts.
 */
export const ORDER_SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "total_desc", label: "Order value: high to low" },
  { value: "total_asc", label: "Order value: low to high" },
] as const;

export type OrderListSort = (typeof ORDER_SORT_OPTIONS)[number]["value"];

/**
 * Ready-stock segmentation for the admin order list. "ready" is an order whose
 * every catalogue line is on the shelf; "not_ready" has at least one line
 * waiting on restock.
 *
 * Deliberately not worded "waiting on stock": that is now an order status, and
 * this filter asks a different question — it reads the product's ready-stock
 * flag, not what the order has been set to.
 */
export const ORDER_STOCK_OPTIONS = [
  { value: "all", label: "Ready & waiting" },
  { value: "ready", label: "Ready stock only" },
  { value: "not_ready", label: "Has a not-ready item" },
] as const;

export type OrderStockFilter = (typeof ORDER_STOCK_OPTIONS)[number]["value"];

/**
 * Sort options accepted by the admin product list endpoint. Values must match
 * the PRODUCT_SORTS keys in apps/api/src/routes/products.ts.
 */
export const PRODUCT_SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "title_asc", label: "Title: A to Z" },
  { value: "title_desc", label: "Title: Z to A" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "stock_asc", label: "Stock: low to high" },
  { value: "stock_desc", label: "Stock: high to low" },
] as const;

export type ProductListSort = (typeof PRODUCT_SORT_OPTIONS)[number]["value"];

/** Storefront-visibility segmentation for the admin product list. */
export const PRODUCT_ACTIVE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Deactivated" },
] as const;

export type ProductActiveFilter =
  (typeof PRODUCT_ACTIVE_OPTIONS)[number]["value"];

/**
 * What the courier will be asked to collect. Mirrors resolveCodAmount in
 * apps/api/src/services/steadfast.service.ts — the API is authoritative, this
 * is for showing the admin the number before they send.
 */
export function resolveCourierCodAmount(order: {
  courierCodAmount?: number | null;
  status: OrderStatus;
  dueAmount?: number;
  remaining?: number;
  total: number;
}): number {
  if (order.courierCodAmount !== null && order.courierCodAmount !== undefined) {
    return Math.max(0, order.courierCodAmount);
  }
  if (order.status === "exchange") return 0;
  return Math.max(0, order.dueAmount ?? order.remaining ?? order.total);
}

/** Statuses an order can no longer move on from. */
export const TERMINAL_ORDER_STATUSES: OrderStatus[] = [
  "delivered",
  "returned",
  "cancelled",
  "refunded",
];

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
  freeDelivery?: boolean;
  sizeChartUrl?: string;
  cost?: number;
  /** Buying / wholesale price per unit, used for gross profit calculations. */
  buyingPrice?: number;
  stock: number;
  /**
   * Admin-only fulfilment flag: is this on the shelf and shippable today? The
   * public product endpoints never return it, so it is absent on storefront
   * reads even though it is always present on admin reads.
   */
  readyStock?: boolean;
  images: string[];
  variants?: ProductVariant[];
  /**
   * Storefront visibility. Absent on products created before the flag existed,
   * which counts as active — read it as `isActive !== false`, never as `true`.
   */
  isActive?: boolean;
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

export interface OrderEditEntry {
  at: string;
  byId?: string;
  byEmail?: string;
  changes: string[];
}

/** One move along the order's status trail, oldest first. */
export interface OrderStatusEntry {
  at: string;
  from?: OrderStatus;
  to: OrderStatus;
  byEmail?: string;
  /** "admin" for a human change, "courier" for the automatic delivered flip. */
  via?: "admin" | "courier";
}

/** Payload accepted by the admin order-edit endpoint (PUT /api/orders/:id). */
export interface OrderEditPayload {
  customer: OrderCustomer;
  items: OrderLineItem[];
  shippingFee: number;
  discount: number;
  paidAmount: number;
  paymentMethod: PaymentMethod;
  paymentType?: "full" | "partial" | null;
  senderNumber?: string | null;
  notes?: string;
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
  /**
   * Explicit amount for the courier to collect, overriding the computed due.
   * Null means "work it out" — an exchange then collects nothing.
   */
  courierCodAmount?: number | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  /**
   * When `status` last moved. Absent on orders that have not been touched since
   * the field was added — fall back to createdAt rather than showing nothing.
   */
  statusChangedAt?: string;
  /** Append-only status trail, oldest first. Only sent on the detail endpoint. */
  statusHistory?: OrderStatusEntry[];
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
  /** Coupon the customer checked out with, when one was used. */
  couponCode?: string;
  /** Append-only trail of admin edits, newest last. */
  editHistory?: OrderEditEntry[];
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
