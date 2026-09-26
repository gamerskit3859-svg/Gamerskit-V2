import type Anthropic from "@anthropic-ai/sdk";
import { TIMEZONE, dhakaOrderDateKey } from "../lib/timezone.js";

// Placeholder — the full prompt is written in Phase 5.
const SYSTEM_PROMPT = `You are the GamersKit admin assistant. Currency is Bangladeshi taka (৳). Timezone is ${TIMEZONE}.
Answer only from tool results; never invent numbers. You cannot change data yourself: write tools only create proposals that the admin confirms in the UI.`;

/**
 * The stable prompt goes first and carries the cache breakpoint; today's date
 * changes daily, so it sits after the breakpoint where it cannot invalidate
 * the cached prefix.
 */
export function buildSystemBlocks(now = new Date()): Anthropic.TextBlockParam[] {
  return [
    { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    { type: "text", text: `Today is ${dhakaOrderDateKey(now)} (${TIMEZONE}).` },
  ];
}
