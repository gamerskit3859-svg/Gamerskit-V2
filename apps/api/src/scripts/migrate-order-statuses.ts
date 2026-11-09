/**
 * One-off migration: retire the "pending", "processing" and "shipped" order
 * statuses by folding them into "confirmed".
 *
 * Those three values are no longer in the Order schema enum, so any document
 * still holding one would fail validation the next time it is saved. The
 * Courier column already carries the real shipping state, which is why
 * "shipped" collapses into "confirmed" without losing anything.
 *
 * Runs as a dry run by default and prints what it would change:
 *
 *   npm run migrate:statuses --workspace apps/api
 *   npm run migrate:statuses --workspace apps/api -- --apply
 *
 * It is safe to run more than once: orders already on a current status are not
 * matched by the query.
 */
import mongoose from "mongoose";
import { connectDb } from "../db.js";
import { OrderModel } from "../models/Order.js";

const RETIRED_STATUSES = ["pending", "processing", "shipped"];
const REPLACEMENT = "confirmed";

async function main() {
  const apply = process.argv.includes("--apply");
  await connectDb();

  const total = await OrderModel.countDocuments({});
  const affected = await OrderModel.aggregate<{ _id: string; count: number }>([
    { $match: { status: { $in: RETIRED_STATUSES } } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  const totalAffected = affected.reduce((sum, row) => sum + row.count, 0);

  console.log(`database holds ${total} orders`);
  if (totalAffected === 0) {
    console.log("nothing to migrate — no order is on a retired status.");
    await mongoose.disconnect();
    return;
  }

  console.log(`\n${totalAffected} order(s) to move to "${REPLACEMENT}":`);
  for (const row of affected) {
    console.log(`  ${row._id.padEnd(12)} ${String(row.count).padStart(6)}`);
  }

  // Orders already with the courier are the ones worth eyeballing: their
  // status changes but the consignment does not, which is the intended outcome.
  const withCourier = await OrderModel.countDocuments({
    status: { $in: RETIRED_STATUSES },
    courier: { $ne: null },
  });
  console.log(`\n  ...of which already handed to the courier: ${withCourier}`);

  if (!apply) {
    console.log("\nDRY RUN — nothing was written. Re-run with --apply to commit.");
    await mongoose.disconnect();
    return;
  }

  const result = await OrderModel.updateMany(
    { status: { $in: RETIRED_STATUSES } },
    { $set: { status: REPLACEMENT } },
  );
  console.log(`\napplied: ${result.modifiedCount} order(s) updated.`);

  const left = await OrderModel.countDocuments({
    status: { $in: RETIRED_STATUSES },
  });
  console.log(
    left === 0
      ? "verified: no order remains on a retired status."
      : `WARNING: ${left} order(s) still on a retired status.`,
  );

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("migration failed:", (err as Error).message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
