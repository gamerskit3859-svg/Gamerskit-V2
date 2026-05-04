import mongoose, { Schema } from "mongoose";

/**
 * Per-date-range manual overrides for the admin Accounting page.
 *
 * The reports endpoint computes auto figures (gross revenue, gross cost / COGS,
 * gross profit) directly from the orders collection. Everything else — shipping
 * income, refunds, ad spend, platform fees, and miscellaneous expenses — is
 * entered by the operator and stored here, keyed by the chosen date range.
 *
 * `rangeKey` is `YYYY-MM-DD..YYYY-MM-DD` so the same range always upserts the
 * same document regardless of which admin entered it.
 */
const AccountingOverrideSchema = new Schema(
  {
    rangeKey: { type: String, required: true, unique: true, index: true },
    from: { type: Date, required: true },
    to: { type: Date, required: true },
    // Money In
    shippingCharged: { type: Number, default: 0, min: 0 },
    refunds: { type: Number, default: 0, min: 0 },
    // Money Out
    shippingExpense: { type: Number, default: 0, min: 0 },
    ads: { type: Number, default: 0, min: 0 },
    platformFees: { type: Number, default: 0, min: 0 },
    other: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

export const AccountingOverrideModel =
  mongoose.models.AccountingOverride ??
  mongoose.model("AccountingOverride", AccountingOverrideSchema);
