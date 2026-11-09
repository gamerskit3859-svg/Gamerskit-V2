/**
 * The admin assistant's tool-use loop.
 *
 * How Claude tool use works, in one paragraph: we send Claude the conversation
 * plus a list of tools (name, description, JSON input schema). Claude either
 * answers in text, or replies with one or more `tool_use` blocks — "please run
 * tool X with input Y". Claude never runs anything itself. We run the tools,
 * send the outputs back as `tool_result` blocks, and ask again. That repeats
 * until Claude answers without asking for a tool (or we hit a limit).
 *
 *   admin text ──▶ Claude ──tool_use──▶ runTool() ──tool_result──▶ Claude ──▶ … ──▶ final text
 *
 * The safety boundary is the tool list: Claude can only do what a registered
 * tool does, with input that passes that tool's zod schema. Write tools do not
 * write — they return a proposal the admin confirms in the UI.
 */
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env.js";
import { AiToolError, HttpError } from "./errors.js";
import { buildSystemBlocks } from "./systemPrompt.js";
import { getTool, getToolSchemas } from "./toolRegistry.js";
import type { AiToolContext, PendingActionView } from "./types.js";

/** Model round trips per chat request. Each tool round costs one. */
const MAX_ITERATIONS = 6;
/** Wall-clock budget for a whole chat request; the web app waits 60s. */
const REQUEST_BUDGET_MS = 50_000;
/** Ceiling for a single model call inside that budget. */
const CALL_TIMEOUT_MS = 40_000;
const MAX_OUTPUT_TOKENS = 16_000;
/** Tool results larger than this are cut before they reach the model. */
const MAX_TOOL_RESULT_CHARS = 12_000;

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ChatUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

export type ChatResult = {
  reply: string;
  proposals: PendingActionView[];
  stopReason: string;
  iterations: number;
  usage: ChatUsage;
};

let client: Anthropic | null = null;

export function isAiConfigured(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

/**
 * Created on first use rather than at import, so a missing key only disables
 * the assistant instead of breaking API startup. The SDK retries 429/5xx and
 * connection errors itself; one retry keeps us inside the time budget.
 */
function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1 });
  }
  return client;
}

/** A response's content is a list of typed blocks; pull out just the text. */
function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

/**
 * Tool output goes to Claude as a string. Oversized output is cut, and the cut
 * is announced so Claude does not treat a partial list as the whole answer.
 */
function serializeToolData(data: unknown): string {
  const json = JSON.stringify(data ?? null);
  if (json.length <= MAX_TOOL_RESULT_CHARS) return json;
  return (
    json.slice(0, MAX_TOOL_RESULT_CHARS) +
    `\n\n[NOTE: this result was truncated at ${MAX_TOOL_RESULT_CHARS} characters and is` +
    " incomplete. Do not present it as the full result. Call the tool again with a" +
    " narrower query or a lower limit.]"
  );
}

type ToolRun = { result: Anthropic.ToolResultBlockParam; proposal?: PendingActionView };

/**
 * Run one `tool_use` block and turn the outcome into a `tool_result` block.
 *
 * The `tool_use_id` ties the result to the request — that is how Claude knows
 * which answer belongs to which call when it asked for several at once.
 *
 * Nothing here throws. A failure becomes a result with `is_error: true`, which
 * tells Claude the call failed and why, so it can retry with better input, try
 * another tool, or explain the problem to the admin.
 */
async function runTool(block: Anthropic.ToolUseBlock, ctx: AiToolContext): Promise<ToolRun> {
  const fail = (message: string): ToolRun => ({
    result: { type: "tool_result", tool_use_id: block.id, content: message, is_error: true },
  });

  // Claude can only name tools we sent it, but check anyway.
  const tool = getTool(block.name);
  if (!tool) return fail(`Unknown tool "${block.name}".`);

  // `block.input` is model output: validate it like any untrusted request body.
  const parsed = tool.schema.safeParse(block.input);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
      .join("; ");
    return fail(`Invalid input for ${tool.name}: ${issues}`);
  }

  try {
    const output = await tool.handler(parsed.data, ctx);
    return {
      result: { type: "tool_result", tool_use_id: block.id, content: serializeToolData(output.data) },
      proposal: output.proposal,
    };
  } catch (err) {
    // AiToolError messages are written for Claude ("2 products match …").
    // Anything else is a bug or an outage: log it, and give Claude a generic
    // message so stack traces and internals never reach the model.
    if (err instanceof AiToolError) return fail(err.message);
    console.error(`[ai] tool ${tool.name} failed:`, err);
    return fail(`${tool.name} failed with an internal error. Tell the admin the data could not be loaded.`);
  }
}

/**
 * Translate SDK errors into HTTP errors the central errorHandler understands.
 * Most specific first: APIConnectionTimeoutError extends APIConnectionError,
 * which extends APIError.
 */
function toHttpError(err: unknown): unknown {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new HttpError(503, "The AI provider rejected the API key. Check ANTHROPIC_API_KEY.", "ai_auth_failed");
  }
  if (err instanceof Anthropic.NotFoundError) {
    return new HttpError(503, `AI model "${env.AI_MODEL}" was not found. Check AI_MODEL.`, "ai_model_not_found");
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new HttpError(429, "The AI provider is rate limiting requests. Try again shortly.", "ai_rate_limited");
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return new HttpError(504, "The AI provider took too long to answer. Try again.", "ai_timeout");
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new HttpError(502, "Could not reach the AI provider.", "ai_unreachable");
  }
  if (err instanceof Anthropic.APIError) {
    return new HttpError(502, "The AI provider returned an error. Try again.", "ai_upstream_error");
  }
  return err;
}

/**
 * Run one chat request: loop between Claude and the tools until Claude gives a
 * final answer or a limit is reached.
 *
 * The client supplies only plain text turns. Every tool_use / tool_result
 * block is created here, within this request, so a forged history cannot
 * smuggle in fake tool results.
 */
export async function runAssistant(turns: ChatTurn[], ctx: AiToolContext): Promise<ChatResult> {
  const startedAt = Date.now();

  // The conversation so far. It grows during the loop: each round appends
  // Claude's turn (with its tool_use blocks) and then our turn (with the
  // matching tool_result blocks). Roles must alternate user → assistant.
  const messages: Anthropic.MessageParam[] = turns.map((turn) => ({
    role: turn.role,
    content: turn.content,
  }));

  // Sent unchanged on every round. Keeping tools + system byte-identical lets
  // the API serve them from the prompt cache on rounds 2..n (see
  // usage.cache_read_input_tokens in the log line).
  const tools = getToolSchemas();
  const system = buildSystemBlocks();

  const usage: ChatUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  const proposals: PendingActionView[] = [];
  const toolsCalled: string[] = [];

  let reply = "";
  let stopReason = "";
  let iterations = 0;

  try {
    while (iterations < MAX_ITERATIONS) {
      // ── Stop condition: time. Leave room for one more call to finish. ──
      const remaining = REQUEST_BUDGET_MS - (Date.now() - startedAt);
      if (remaining < 5_000) {
        stopReason = "time_budget";
        break;
      }
      iterations += 1;

      // ── Step 1: request. Send the whole conversation plus the tool list. ──
      // Claude is stateless between calls: it sees only what is in `messages`.
      const response = await getClient().messages.create(
        {
          model: env.AI_MODEL,
          max_tokens: MAX_OUTPUT_TOKENS,
          // Claude decides per turn whether to think before answering.
          thinking: { type: "adaptive" },
          system,
          ...(tools.length ? { tools } : {}),
          messages,
        },
        { timeout: Math.min(CALL_TIMEOUT_MS, remaining) },
      );

      // Every call is billed separately, so sum usage across rounds.
      usage.inputTokens += response.usage.input_tokens;
      usage.outputTokens += response.usage.output_tokens;
      usage.cacheReadTokens += response.usage.cache_read_input_tokens ?? 0;
      usage.cacheWriteTokens += response.usage.cache_creation_input_tokens ?? 0;

      // ── Step 2: read why Claude stopped. ──
      //   "end_turn"   – a final answer; we are done.
      //   "tool_use"   – it wants tools run before it can answer.
      //   "max_tokens" – the answer hit MAX_OUTPUT_TOKENS and was cut.
      //   "refusal"    – it declined the request.
      //   "pause_turn" – the API paused a long turn; send it back to resume.
      stopReason = response.stop_reason ?? "";

      // Claude often writes a sentence alongside its tool calls ("Let me check
      // today's orders"). Keep the latest text so there is always a reply.
      const text = textOf(response.content);
      if (text) reply = text;

      if (response.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }
      // ── Stop condition: anything other than a tool request ends the loop. ──
      if (response.stop_reason !== "tool_use") break;

      // ── Step 3: collect the tool_use blocks. There can be several — Claude
      // may ask for sales and low stock in the same turn. ──
      const toolUses = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
      );

      // Append Claude's turn exactly as received — text, thinking and tool_use
      // blocks alike. The API checks that every tool_result below answers a
      // tool_use in the turn right before it, and needs the thinking blocks to
      // continue a turn that used tools.
      messages.push({ role: "assistant", content: response.content });

      // ── Step 4: run the tools in parallel. They are independent reads (or
      // proposal writes), so there is no reason to wait on each in turn. ──
      const runs = await Promise.all(toolUses.map((block) => runTool(block, ctx)));
      toolsCalled.push(...toolUses.map((block) => block.name));
      for (const run of runs) if (run.proposal) proposals.push(run.proposal);

      // ── Step 5: send every tool_result back in ONE user turn. Splitting them
      // across several messages breaks the pairing and teaches Claude to stop
      // making parallel calls. Then loop back to step 1. ──
      messages.push({ role: "user", content: runs.map((run) => run.result) });
    }
    // ── Stop condition: MAX_ITERATIONS. If we fall out of the while here with
    // stopReason still "tool_use", Claude wanted more rounds than allowed. ──
  } catch (err) {
    const detail =
      err instanceof Anthropic.APIError
        ? `${err.status ?? "-"} ${err.type ?? ""} request_id=${err.requestID ?? "-"}`
        : err instanceof Error
          ? err.message
          : String(err);
    console.error(`[ai] chat failed admin=${ctx.adminEmail} iterations=${iterations}: ${detail}`);
    throw toHttpError(err);
  } finally {
    // One line per chat request, success or failure: the token-usage log.
    console.info(
      `[ai] chat admin=${ctx.adminEmail} model=${env.AI_MODEL} iterations=${iterations}` +
        ` stop=${stopReason || "-"} tools=[${toolsCalled.join(",")}] proposals=${proposals.length}` +
        ` tokens in=${usage.inputTokens} out=${usage.outputTokens}` +
        ` cache_read=${usage.cacheReadTokens} cache_write=${usage.cacheWriteTokens}` +
        ` ms=${Date.now() - startedAt}`,
    );
  }

  // ── Step 6: shape the reply for the admin, explaining any early stop. ──
  if (stopReason === "refusal") {
    reply = "I can't help with that request.";
  } else if (stopReason === "tool_use" || stopReason === "time_budget") {
    reply =
      (reply ? `${reply}\n\n` : "") +
      "I couldn't finish looking this up in one go. Try a narrower question.";
  } else if (stopReason === "max_tokens") {
    reply = (reply ? `${reply}\n\n` : "") + "(Answer cut short.)";
  }
  if (!reply) reply = "I don't have an answer for that.";

  // Proposals made along the way are returned even on an early stop — they
  // already exist as pending actions the admin can confirm or cancel.
  return { reply, proposals, stopReason, iterations, usage };
}
