import Anthropic from "@anthropic-ai/sdk";
import { systemPrompt, toolDescription, toolSchema, TOOL_NAME } from "./brief";
import { checkSubmission } from "./check";
import { MakerError, MAX_ATTEMPTS, noUsage, type RunOptions, type RunResult } from "./types";


// Server-side fallback: if a model declines, the API re-runs the request on its fallback model.
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5"]);

export function claudeClient(apiKey: string) {
  // The teacher's own key goes straight from this browser to Anthropic; MathsDock never sees it.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });
}

export async function listClaudeModels(apiKey: string, signal?: AbortSignal): Promise<string[]> {
  const ids: string[] = [];
  for await (const m of claudeClient(apiKey).models.list({ limit: 100 }, { signal })) ids.push(m.id);
  return ids;
}

function friendly(e: unknown): Error {
  if (e instanceof Anthropic.APIUserAbortError) return new MakerError("Stopped.");
  if (e instanceof Anthropic.AuthenticationError) return new MakerError("Anthropic did not accept this API key. Check it in AI settings.");
  if (e instanceof Anthropic.PermissionDeniedError) return new MakerError("This Anthropic key cannot use that model. Choose another model in AI settings.");
  if (e instanceof Anthropic.NotFoundError) return new MakerError("Anthropic does not recognise that model name. Choose another model in AI settings.");
  if (e instanceof Anthropic.RateLimitError) return new MakerError("Anthropic says this key has hit its rate or spending limit. Wait a minute, or check the key's limits in the Anthropic Console.");
  if (e instanceof Anthropic.BadRequestError) return new MakerError(`Anthropic refused the request: ${e.message}`);
  if (e instanceof Anthropic.APIConnectionError) return new MakerError("Could not reach Anthropic. Check the connection and try again.");
  if (e instanceof Anthropic.APIError) return new MakerError(`Anthropic returned an error (${e.status ?? "no status"}). Try again in a moment.`);
  return e instanceof Error ? e : new Error(String(e));
}

const tool: Anthropic.Beta.BetaTool = {
  name: TOOL_NAME,
  description: toolDescription,
  input_schema: toolSchema as Anthropic.Beta.BetaTool.InputSchema,
  // Stream the large worksheet input as it is written; the page validates it before use.
  eager_input_streaming: true,
};

export async function makeWithClaude(o: RunOptions): Promise<RunResult> {
  const client = claudeClient(o.apiKey);
  const usage = noUsage();
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: o.request }];
  let model = o.model;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    o.onStage?.({ kind: "thinking" });
    let message: Anthropic.Beta.BetaMessage;
    try {
      const stream = client.beta.messages.stream(
        {
          model: o.model,
          max_tokens: 64000,
          thinking: { type: "adaptive" },
          output_config: { effort: o.effort },
          // Caches the guide and tools: later attempts and requests read them at a tenth of the price.
          cache_control: { type: "ephemeral" },
          system: systemPrompt,
          tools: [tool],
          messages,
          ...(FALLBACK_MODELS.has(o.model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
        },
        { signal: o.signal },
      );
      stream.on("inputJson", (_delta, snapshot) => o.onStage?.({ kind: "writing", chars: JSON.stringify(snapshot ?? "").length }));
      message = await stream.finalMessage();
    } catch (e) {
      throw friendly(e);
    }
    model = message.model;
    usage.input += message.usage.input_tokens;
    usage.output += message.usage.output_tokens;
    usage.cacheRead += message.usage.cache_read_input_tokens ?? 0;
    usage.cacheWrite += message.usage.cache_creation_input_tokens ?? 0;

    if (message.stop_reason === "refusal") throw new MakerError("The model declined this request. Rephrase the objective or notes and try again.");
    if (message.stop_reason === "max_tokens") throw new MakerError("The model ran out of room before finishing the worksheet. Try a lower thinking level or a shorter request.");
    const call = message.content.find((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === TOOL_NAME);
    messages.push({ role: "assistant", content: message.content });
    if (!call) {
      // Forced tool choice is not available on current models, so steer with a reminder.
      messages.push({ role: "user", content: `Submit the complete worksheet now by calling ${TOOL_NAME}.` });
      continue;
    }
    o.onStage?.({ kind: "checking", attempt });
    const checked = checkSubmission(call.input);
    if (checked.ok) return { submission: checked.submission, resource: checked.resource, usage, attempts: attempt, model };
    if (attempt < MAX_ATTEMPTS) o.onStage?.({ kind: "fixing", attempt, problems: checked.feedback });
    // Every tool_use gets its result, all in one user message.
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = message.content
      .filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use")
      .map((b) => ({ type: "tool_result", tool_use_id: b.id, is_error: true, content: b.id === call.id ? checked.feedback : "Ignored: submit once." }));
    messages.push({ role: "user", content: results });
  }
  throw new MakerError(`The worksheet still did not pass the checks after ${MAX_ATTEMPTS} tries. Try again, or choose a stronger model or higher thinking level.`);
}
