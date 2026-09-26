import type Anthropic from "@anthropic-ai/sdk";
import type { AiTool } from "./types.js";

/**
 * Every tool the assistant may call. Claude cannot reach MongoDB or anything
 * else except through this list. Order is kept stable on purpose: the tool list
 * is part of the prompt-cache prefix, so reordering it invalidates the cache.
 *
 * Tools are added in Phase 3 (read) and Phase 4 (write).
 */
const TOOLS: AiTool[] = [];

const TOOLS_BY_NAME = new Map(TOOLS.map((tool) => [tool.name, tool]));

export function getTool(name: string): AiTool | undefined {
  return TOOLS_BY_NAME.get(name);
}

/** Tool definitions in the shape the Messages API expects. */
export function getToolSchemas(): Anthropic.Tool[] {
  return TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));
}
