import mongoose, { Schema, type Types } from "mongoose";

export const AI_ACTION_STATUSES = [
  "pending",
  "confirmed",
  "cancelled",
  "expired",
  "failed",
] as const;

export type AiActionStatus = (typeof AI_ACTION_STATUSES)[number];

/**
 * A change the AI assistant proposed but did not make. Only the admin's click
 * on the confirm endpoint applies it, and only while it is still pending and
 * `oldValue` still matches the live record. Expiry is checked when the action
 * is read or confirmed rather than by a TTL index, so an expired proposal stays
 * on file with status "expired" instead of disappearing.
 */
const AiPendingActionSchema = new Schema(
  {
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    toolName: { type: String, required: true },
    targetId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    targetName: { type: String, default: "" },
    field: { type: String, required: true },
    oldValue: { type: Number, required: true },
    newValue: { type: Number, required: true },
    summary: { type: String, default: "" },
    warnings: { type: [String], default: [] },
    status: {
      type: String,
      enum: [...AI_ACTION_STATUSES],
      default: "pending",
    },
    expiresAt: { type: Date, required: true },
    confirmedAt: { type: Date },
    cancelledAt: { type: Date },
    error: { type: String },
    auditLogId: { type: Schema.Types.ObjectId, ref: "AiAuditLog" },
  },
  { timestamps: true },
);

AiPendingActionSchema.index({ adminId: 1, status: 1, createdAt: -1 });
// Backs the sweep that marks overdue proposals expired.
AiPendingActionSchema.index({ status: 1, expiresAt: 1 });

export const AiPendingActionModel =
  mongoose.models.AiPendingAction ??
  mongoose.model("AiPendingAction", AiPendingActionSchema);

export interface AiPendingActionDocument {
  _id: Types.ObjectId;
  adminId: Types.ObjectId;
  toolName: string;
  targetId: Types.ObjectId;
  targetName: string;
  field: string;
  oldValue: number;
  newValue: number;
  summary: string;
  warnings: string[];
  status: AiActionStatus;
  expiresAt: Date;
  confirmedAt?: Date;
  cancelledAt?: Date;
  error?: string;
  auditLogId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
