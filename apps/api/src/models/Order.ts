import mongoose, { Schema } from "mongoose";

const LineItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product" },
    title: { type: String, required: true },
    image: { type: String },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
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
    district: { type: String },
    thana: { type: String },
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
    paymentMethod: {
      type: String,
      enum: ["cod", "bkash", "nagad", "card", "manual"],
      default: "cod",
    },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "refunded",
      ],
      default: "pending",
      index: true,
    },
    source: {
      type: String,
      enum: ["storefront", "manual"],
      default: "storefront",
      index: true,
    },
    notes: { type: String },
    fbEventId: { type: String },
    couponCode: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export const OrderModel =
  mongoose.models.Order ?? mongoose.model("Order", OrderSchema);
