import mongoose, { Schema } from "mongoose";

/**
 * Per-date-range manual overrides for the admin Accounting page.
 *
 * The reports endpoint computes auto figures (gross revenue, gross cost / COGS,
 * gross profit) directly from the orders collection. Everything else — shipping
 * income, refunds, ad spend, salaries, and miscellaneous expenses — is entered
 * by the operator and stored here, keyed by the chosen date range.
 *
 * `rangeKey` is `YYYY-MM-DD..YYYY-MM-DD` so the same range always upserts the
 * same document regardless of which admin entered it.
 *
 * Each document also carries an arbitrary `customExpenses` list so operators
 * can add their own expense categories beyond the built-in rows.
 */
const CustomExpenseSchema = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true, default: "" },
    value: { type: Number, required: true, default: 0, min: 0 },
  },
  { _id: false },
);

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
    salaries: { type: Number, default: 0, min: 0 },
    other: { type: Number, default: 0, min: 0 },
    customExpenses: { type: [CustomExpenseSchema], default: [] },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

export const AccountingOverrideModel =
  mongoose.models.AccountingOverride ??
  mongoose.model("AccountingOverride", AccountingOverrideSchema);
