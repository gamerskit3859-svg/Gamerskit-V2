import mongoose from "mongoose";
import {
  AiPendingActionModel,
  type AiPendingActionDocument,
} from "../models/AiPendingAction.js";
import { AiAuditLogModel } from "../models/AiAuditLog.js";
import { AiActionError, HttpError } from "./errors.js";
import { getTool } from "./toolRegistry.js";
import type { AiToolContext, PendingActionView } from "./types.js";

export const PENDING_ACTION_TTL_MS = 10 * 60_000;

export function toPendingActionView(action: AiPendingActionDocument): PendingActionView {
  return {
    id: String(action._id),
    toolName: action.toolName,
    productId: String(action.targetId),
    productName: action.targetName,
    field: action.field,
    oldValue: action.oldValue,
    newValue: action.newValue,
    summary: action.summary,
    warnings: action.warnings ?? [],
    status: action.status,
    expiresAt: new Date(action.expiresAt).toISOString(),
    createdAt: new Date(action.createdAt).toISOString(),
    ...(action.confirmedAt ? { confirmedAt: new Date(action.confirmedAt).toISOString() } : {}),
    ...(action.error ? { error: action.error } : {}),
  };
}

export type ProposalInput = {
  toolName: string;
  productId: string;
  productName: string;
  field: string;
  oldValue: number;
  newValue: number;
  summary: string;
  warnings?: string[];
};

/**
 * Record a proposal and its audit row. Nothing about the product changes here —
 * write tools call this instead of touching data.
 */
export async function createPendingAction(
  input: ProposalInput,
  ctx: AiToolContext,
): Promise<PendingActionView> {
  const now = new Date();
  const actionId = new mongoose.Types.ObjectId();
  const audit = await AiAuditLogModel.create({
    adminId: ctx.adminId,
    adminEmail: ctx.adminEmail,
    adminName: ctx.adminName,
    action: input.toolName,
    pendingActionId: actionId,
    productId: input.productId,
    productName: input.productName,
    field: input.field,
    oldValue: input.oldValue,
    newValue: input.newValue,
    proposedAt: now,
    result: "proposed",
    prompt: ctx.prompt,
  });
  const action = await AiPendingActionModel.create({
    _id: actionId,
    adminId: ctx.adminId,
    toolName: input.toolName,
    targetId: input.productId,
    targetName: input.productName,
    field: input.field,
    oldValue: input.oldValue,
    newValue: input.newValue,
    summary: input.summary,
    warnings: input.warnings ?? [],
    status: "pending",
    expiresAt: new Date(now.getTime() + PENDING_ACTION_TTL_MS),
    auditLogId: audit._id,
  });
  return toPendingActionView(action.toObject() as AiPendingActionDocument);
}

/**
 * Mark every overdue proposal expired, along with its audit row. Called before
 * anything reads action or audit state, so nothing reports a stale "pending".
 */
export async function expireOverdueActions(now = new Date()): Promise<void> {
  const overdue = await AiPendingActionModel.find({
    status: "pending",
    expiresAt: { $lte: now },
  })
    .select("_id")
    .lean();
  if (overdue.length === 0) return;
  const ids = overdue.map((action) => action._id);
  await Promise.all([
    AiPendingActionModel.updateMany(
      { _id: { $in: ids }, status: "pending" },
      { $set: { status: "expired" } },
    ),
    AiAuditLogModel.updateMany(
      { pendingActionId: { $in: ids }, result: "proposed" },
      { $set: { result: "expired" } },
    ),
  ]);
}

/**
 * Load an action the admin owns. Someone else's action answers 404, same as a
 * missing one, so ids cannot be probed.
 */
async function loadOwnAction(id: string, adminId: string): Promise<AiPendingActionDocument> {
  if (!mongoose.isValidObjectId(id)) {
    throw new HttpError(404, "action not found", "action_not_found");
  }
  await expireOverdueActions();
  const action = (await AiPendingActionModel.findOne({
    _id: id,
    adminId,
  }).lean()) as AiPendingActionDocument | null;
  if (!action) throw new HttpError(404, "action not found", "action_not_found");
  return action;
}

function notPendingError(action: AiPendingActionDocument): HttpError {
  return action.status === "expired"
    ? new HttpError(409, "This proposal expired. Ask the assistant again.", "action_expired")
    : new HttpError(409, `This proposal is already ${action.status}.`, "action_not_pending");
}

export async function cancelAction(id: string, adminId: string): Promise<PendingActionView> {
  const action = await loadOwnAction(id, adminId);
  const now = new Date();
  const cancelled = (await AiPendingActionModel.findOneAndUpdate(
    { _id: action._id, status: "pending" },
    { $set: { status: "cancelled", cancelledAt: now } },
    { returnDocument: "after" },
  ).lean()) as AiPendingActionDocument | null;
  if (!cancelled) throw notPendingError(action);
  await AiAuditLogModel.updateOne(
    { pendingActionId: action._id },
    { $set: { result: "cancelled" } },
  );
  return toPendingActionView(cancelled);
}

export type ConfirmOutcome =
  | { ok: true; item: PendingActionView }
  | { ok: false; item: PendingActionView; error: string; code: string };

/**
 * Apply a proposal. The admin's click is the only thing that reaches here —
 * the assistant has no route to it.
 *
 * The pending → confirmed transition is a single conditional update, so a
 * double click or two tabs cannot apply the same change twice. The tool's
 * `execute` then re-checks the live value against `oldValue` itself.
 */
export async function confirmAction(id: string, adminId: string): Promise<ConfirmOutcome> {
  const action = await loadOwnAction(id, adminId);
  if (action.status !== "pending") throw notPendingError(action);

  const now = new Date();
  const claimed = (await AiPendingActionModel.findOneAndUpdate(
    { _id: action._id, status: "pending", expiresAt: { $gt: now } },
    { $set: { status: "confirmed", confirmedAt: now } },
    { returnDocument: "after" },
  ).lean()) as AiPendingActionDocument | null;
  if (!claimed) {
    // Lost a race with another confirm/cancel, or expired between the read
    // above and the claim.
    const current = await loadOwnAction(id, adminId);
    throw notPendingError(current.status === "pending" ? { ...current, status: "expired" } : current);
  }

  try {
    const tool = getTool(claimed.toolName);
    if (!tool || tool.type !== "write") {
      throw new AiActionError(
        `The ${claimed.toolName} action is no longer available.`,
        "tool_unavailable",
      );
    }
    await tool.execute(claimed);
  } catch (err) {
    const known = err instanceof AiActionError;
    if (!known) console.error(`[ai] confirm ${claimed._id} failed:`, err);
    const message = known ? err.message : "The change could not be applied.";
    const code = known ? err.code : "apply_failed";
    const failed = (await AiPendingActionModel.findByIdAndUpdate(
      claimed._id,
      { $set: { status: "failed", error: message } },
      { returnDocument: "after" },
    ).lean()) as AiPendingActionDocument;
    await AiAuditLogModel.updateOne(
      { pendingActionId: claimed._id },
      { $set: { confirmed: true, confirmedAt: now, result: "failed", error: message } },
    );
    return { ok: false, item: toPendingActionView(failed), error: message, code };
  }

  await AiAuditLogModel.updateOne(
    { pendingActionId: claimed._id },
    { $set: { confirmed: true, confirmedAt: now, result: "success" } },
  );
  return { ok: true, item: toPendingActionView(claimed) };
}
