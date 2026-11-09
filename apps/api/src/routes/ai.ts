import { Router } from "express";
import { z } from "zod";
import { adminOnlyRequired } from "../lib/auth.js";
import { setPrivateNoStore } from "../lib/http.js";
import { UserModel } from "../models/User.js";
import { AI_AUDIT_RESULTS, AiAuditLogModel } from "../models/AiAuditLog.js";
import { isAiConfigured, runAssistant, type ChatTurn } from "../ai/assistant.service.js";
import {
  cancelAction,
  confirmAction,
  expireOverdueActions,
} from "../ai/pendingAction.service.js";

const router = Router();

// Revenue and product edits: admins only, never staff.
router.use(adminOnlyRequired);
router.use((_req, res, next) => {
  setPrivateNoStore(res);
  next();
});

/** Turns of history forwarded to the model; older ones are dropped. */
const MAX_HISTORY_TURNS = 20;

// Plain text only. Tool calls and results are built server-side, so a client
// cannot inject its own tool_result blocks into the conversation.
const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1)
    .max(100),
});

/**
 * Trim to the recent window, make it start on a user turn, and merge
 * back-to-back turns from the same side so roles alternate.
 */
function normalizeTurns(input: ChatTurn[]): ChatTurn[] {
  const recent = input.slice(-MAX_HISTORY_TURNS);
  const firstUser = recent.findIndex((turn) => turn.role === "user");
  if (firstUser === -1) return [];
  const turns: ChatTurn[] = [];
  for (const turn of recent.slice(firstUser)) {
    const last = turns[turns.length - 1];
    if (last && last.role === turn.role) last.content += `\n\n${turn.content}`;
    else turns.push({ ...turn });
  }
  return turns;
}

router.post("/chat", async (req, res) => {
  if (!isAiConfigured()) {
    res.status(503).json({
      error: "The AI assistant is not configured: ANTHROPIC_API_KEY is missing.",
      code: "ai_not_configured",
    });
    return;
  }
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const turns = normalizeTurns(parsed.data.messages);
  if (turns.length === 0 || turns[turns.length - 1].role !== "user") {
    res.status(400).json({ error: "the last message must be from the user" });
    return;
  }

  // The JWT carries no name; the audit log wants one.
  const admin = await UserModel.findById(req.user!.sub).select("name email").lean();
  const result = await runAssistant(turns, {
    adminId: req.user!.sub,
    adminEmail: admin?.email ?? req.user!.email,
    adminName: admin?.name ?? "",
    prompt: turns[turns.length - 1].content,
  });

  res.json({
    reply: result.reply,
    proposals: result.proposals,
    usage: result.usage,
  });
});

router.post("/actions/:id/confirm", async (req, res) => {
  const outcome = await confirmAction(String(req.params.id), req.user!.sub);
  if (!outcome.ok) {
    res.status(409).json({ error: outcome.error, code: outcome.code, item: outcome.item });
    return;
  }
  res.json({ item: outcome.item });
});

router.post("/actions/:id/cancel", async (req, res) => {
  const item = await cancelAction(String(req.params.id), req.user!.sub);
  res.json({ item });
});

router.get("/audit-logs", async (req, res) => {
  const { page = "1", limit = "20", result } = req.query as Record<string, string>;
  await expireOverdueActions();

  const filter: Record<string, unknown> = {};
  if (result && (AI_AUDIT_RESULTS as readonly string[]).includes(result)) {
    filter.result = result;
  }
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Math.min(Number(limit) || 20, 100));

  const [items, total] = await Promise.all([
    AiAuditLogModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    AiAuditLogModel.countDocuments(filter),
  ]);
  const totalPages = Math.ceil(total / limitNum);

  res.json({
    items,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages,
    hasMore: pageNum < totalPages,
  });
});

export default router;
