import mongoose, { Schema } from "mongoose";

// Order lifecycle. New orders arrive as "confirmed"; the "called_*" pair records
// the phone-verification step; "waiting_stock" parks a confirmed order that
// cannot be packed until the item is back on the shelf; "exchange" is a
// replacement parcel going back out (which collects no money unless an amount
// is set explicitly); "returned" is the courier bringing an undelivered parcel
// back.
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
 * Statuses that must never count toward revenue, sold units or profit. A
 * returned parcel is money that came back, so it belongs here alongside
 * cancelled and refunded.
 */
export const NON_REVENUE_ORDER_STATUSES: OrderStatus[] = [
  "cancelled",
  "refunded",
  "returned",
];

/** Statuses an order can no longer move on from. */
export const TERMINAL_ORDER_STATUSES: OrderStatus[] = [
  "delivered",
  "returned",
  "cancelled",
  "refunded",
];

const LineItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product" },
    title: { type: String, required: true },
    image: { type: String },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    selectedVariants: { type: Map, of: String },
    variantSku: { type: String },
    variantPrice: { type: Number, min: 0 },
    custom: { type: Boolean, default: false },
    note: { type: String },
  },
  { _id: false },
);

const CustomerSchema = new Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true, index: true },
    email: { type: String },
    address: { type: String, required: true },
    // Bangladesh-style location pair used by the storefront checkout.
    district: { type: String },
    thana: { type: String },
    // Legacy / admin custom-order location pair. Kept so the admin form
    // continues to round-trip values it has historically written.
    city: { type: String },
    area: { type: String },
  },
  { _id: false },
);

const CourierSchema = new Schema(
  {
    provider: { type: String },
    invoice: { type: String, index: true },
    consignmentId: { type: String, index: true },
    trackingCode: { type: String, index: true },
    status: { type: String },
    response: { type: Schema.Types.Mixed },
    createdAt: { type: Date },
    updatedAt: { type: Date },
  },
  { _id: false },
);

// Append-only trail of status moves. The admin list and the order page both
// need to answer "when did this become what it is?", and `updatedAt` cannot:
// it also moves for a note, a courier sync or a payment edit.
const StatusEntrySchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    from: { type: String },
    to: { type: String, required: true },
    byEmail: { type: String },
    // "admin" for a human change, "courier" for the automatic delivered flip.
    via: { type: String, default: "admin" },
  },
  { _id: false },
);

// Append-only trail of admin edits. Order edits move money and stock, so each
// save records who changed what rather than silently overwriting the order.
const EditEntrySchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    byId: { type: Schema.Types.ObjectId, ref: "User" },
    byEmail: { type: String },
    changes: { type: [String], default: [] },
  },
  { _id: false },
);

const OrderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    customer: { type: CustomerSchema, required: true },
    items: { type: [LineItemSchema], required: true },
    subtotal: { type: Number, required: true },
    shippingFee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    advance: { type: Number, default: 0 },
    remaining: { type: Number, default: 0 },
    paymentType: {
      type: String,
      enum: ["full", "partial", null],
      default: null,
    },
    paidAmount: { type: Number, default: 0 },
    dueAmount: { type: Number, default: 0 },
    senderNumber: { type: String, default: null },
    // Explicit amount for the courier to collect, overriding the computed due.
    // Null means "work it out from the order" — an exchange collects nothing
    // unless a number is set here. See resolveCodAmount in steadfast.service.
    courierCodAmount: { type: Number, default: null, min: 0 },
    paymentMethod: {
      type: String,
      enum: ["cod", "bkash", "nagad", "card", "manual"],
      default: "cod",
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "partial", "paid", "refunded"],
      default: "unpaid",
      index: true,
    },
    status: {
      type: String,
      enum: [...ORDER_STATUSES],
      default: "confirmed",
      index: true,
    },
    // When `status` last moved. Unset on orders created before this existed —
    // readers fall back to createdAt rather than inventing a time.
    statusChangedAt: { type: Date },
    statusHistory: { type: [StatusEntrySchema], default: [] },
    source: {
      type: String,
      enum: ["storefront", "manual"],
      default: "storefront",
      index: true,
    },
    notes: { type: String },
    courier: { type: CourierSchema },
    fbEventId: { type: String },
    couponCode: { type: String },
    editHistory: { type: [EditEntrySchema], default: [] },
    metadata: { type: Schema.Types.Mixed },
    // If the order was placed by a signed-in customer we link it here so the
    // /account "your orders" view can find it even when the phone/email at
    // checkout doesn't match the saved profile.
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
  },
  { timestamps: true },
);

OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ source: 1, createdAt: -1 });
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ "customer.phone": 1, createdAt: -1 });
OrderSchema.index({ orderNumber: 1, createdAt: -1 });
OrderSchema.index({ "customer.name": 1 });
// Backs the admin order list's "filter by product" option.
OrderSchema.index({ "items.productId": 1, createdAt: -1 });
// Backs sorting the admin order list by order value.
OrderSchema.index({ total: -1, createdAt: -1 });

export const OrderModel =
  mongoose.models.Order ?? mongoose.model("Order", OrderSchema);
