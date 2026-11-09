import mongoose, { Schema } from "mongoose";

export const AI_AUDIT_RESULTS = [
  "proposed",
  "success",
  "failed",
  "cancelled",
  "expired",
] as const;

export type AiAuditResult = (typeof AI_AUDIT_RESULTS)[number];

/**
 * One row per AI write proposal, written when the proposal is made and updated
 * as it resolves. `confirmed` records the admin's click, so a confirmed change
 * that then failed (e.g. a stale value) reads confirmed: true, result: failed.
 */
const AiAuditLogSchema = new Schema(
  {
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    adminEmail: { type: String, default: "" },
    adminName: { type: String, default: "" },
    action: { type: String, required: true },
    pendingActionId: { type: Schema.Types.ObjectId, ref: "AiPendingAction" },
    productId: { type: Schema.Types.ObjectId, ref: "Product" },
    productName: { type: String, default: "" },
    field: { type: String, default: "" },
    oldValue: { type: Number },
    newValue: { type: Number },
    proposedAt: { type: Date, default: Date.now },
    confirmed: { type: Boolean, default: false },
    confirmedAt: { type: Date },
    result: {
      type: String,
      enum: [...AI_AUDIT_RESULTS],
      default: "proposed",
    },
    error: { type: String },
    prompt: { type: String, default: "" },
  },
  { timestamps: true },
);

AiAuditLogSchema.index({ createdAt: -1 });
AiAuditLogSchema.index({ adminId: 1, createdAt: -1 });
AiAuditLogSchema.index({ pendingActionId: 1 });

export const AiAuditLogModel =
  mongoose.models.AiAuditLog ?? mongoose.model("AiAuditLog", AiAuditLogSchema);
