import mongoose, { Schema } from "mongoose";

/**
 * A batch of product units written off as "damaged".
 *
 * When the operator marks stock as damaged on the Inventory page we decrement
 * the product's on-hand stock and record the loss here. `unitCost` is a
 * snapshot of the product's `buyingPrice` at the time of the write-off, so the
 * accounting figures stay stable even if the buying price changes later.
 *
 * `totalCost` = unitCost × quantity is the amount deducted from accounting
 * (added to Money Out) and summarised on the dashboard.
 */
const DamagedItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", index: true },
    title: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitCost: { type: Number, required: true, default: 0, min: 0 },
    totalCost: { type: Number, required: true, default: 0, min: 0 },
    reason: { type: String, default: "" },
  },
  { timestamps: true },
);

DamagedItemSchema.index({ createdAt: -1 });

export const DamagedItemModel =
  mongoose.models.DamagedItem ??
  mongoose.model("DamagedItem", DamagedItemSchema);
