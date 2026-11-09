import type Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import type { AiActionStatus, AiPendingActionDocument } from "../models/AiPendingAction.js";

/** Who is asking. Write tools stamp this onto the proposal and its audit row. */
export type AiToolContext = {
  adminId: string;
  adminEmail: string;
  adminName: string;
  /** The admin's latest message, kept on the audit row. */
  prompt: string;
};

/** A pending action as the web app sees it. */
export type PendingActionView = {
  id: string;
  toolName: string;
  productId: string;
  productName: string;
  field: string;
  oldValue: number;
  newValue: number;
  summary: string;
  warnings: string[];
  status: AiActionStatus;
  expiresAt: string;
  createdAt: string;
  confirmedAt?: string;
  error?: string;
};

export type AiToolOutput = {
  /** Sent to Claude as the tool_result content. Keep it small. */
  data: unknown;
  /** Set by write tools: the proposal the admin must confirm in the UI. */
  proposal?: PendingActionView;
};

type AiToolBase<TInput> = {
  name: string;
  description: string;
  /** JSON Schema sent to Claude. Must describe the same shape as `schema`. */
  inputSchema: Anthropic.Tool.InputSchema;
  /** Server-side validation. Claude's input is never trusted as-is. */
  schema: z.ZodType<TInput, z.ZodTypeDef, unknown>;
  handler: (input: TInput, ctx: AiToolContext) => Promise<AiToolOutput>;
};

export type AiReadTool<TInput> = AiToolBase<TInput> & { type: "read" };

export type AiWriteTool<TInput> = AiToolBase<TInput> & {
  type: "write";
  /**
   * Apply a confirmed proposal. Only the confirm endpoint calls this, after it
   * has claimed the action. Throw AiActionError when the live record no longer
   * matches `oldValue` or the change is otherwise refused.
   */
  execute: (action: AiPendingActionDocument) => Promise<void>;
};

export type AiTool<TInput = unknown> = AiReadTool<TInput> | AiWriteTool<TInput>;

/**
 * Erase a tool's input type for storage in the registry. Safe because the
 * registry only ever calls `handler` with the output of the tool's own
 * `schema.safeParse`.
 */
export function defineTool<TInput>(tool: AiTool<TInput>): AiTool {
  return tool as unknown as AiTool;
}
