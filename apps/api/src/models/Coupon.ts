import mongoose, { Schema } from "mongoose";

const CouponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, index: true },
    type: { type: String, enum: ["percent", "fixed"], required: true },
    value: { type: Number, required: true, min: 0 },
    minOrder: { type: Number, default: 0 },
    maxRedemptions: { type: Number, default: 0 },
    redeemed: { type: Number, default: 0 },
    startsAt: { type: Date },
    endsAt: { type: Date },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const CouponModel =
  mongoose.models.Coupon ?? mongoose.model("Coupon", CouponSchema);
