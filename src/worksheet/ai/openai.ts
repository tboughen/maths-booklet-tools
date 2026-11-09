import OpenAI from "openai";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import { systemPrompt, toolDescription, toolSchema, TOOL_NAME } from "./brief";
import { checkSubmission } from "./check";
import { MakerError, MAX_ATTEMPTS, noUsage, type RunOptions, type RunResult } from "./types";

export function openaiClient(apiKey: string) {
  // The teacher's own key goes straight from this browser to OpenAI; MathsDock never sees it.
  return new OpenAI({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });
}

/** Text models the key can use, newest-looking first. The list comes from OpenAI, so it stays current. */
export async function listOpenAIModels(apiKey: string, signal?: AbortSignal): Promise<string[]> {
  const ids: string[] = [];
  for await (const m of openaiClient(apiKey).models.list({ signal })) ids.push(m.id);
  return ids
    .filter((id) => /^(gpt-|o\d)/.test(id) && !/(audio|realtime|transcribe|tts|image|search|embedding|instruct|mini-tts)/.test(id))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
}

function friendly(e: unknown): Error {
  if (e instanceof OpenAI.APIUserAbortError) return new MakerError("Stopped.");
  if (e instanceof OpenAI.AuthenticationError) return new MakerError("OpenAI did not accept this API key. Check it in AI settings. A ChatGPT subscription does not include API access: the key must come from platform.openai.com.");
  if (e instanceof OpenAI.PermissionDeniedError) return new MakerError("This OpenAI key cannot use that model. Choose another model in AI settings.");
  if (e instanceof OpenAI.NotFoundError) return new MakerError("OpenAI does not recognise that model name. Choose another model in AI settings.");
  if (e instanceof OpenAI.RateLimitError) return new MakerError("OpenAI says this key has hit its rate limit or has no credit. Wait a minute, or check billing at platform.openai.com.");
  if (e instanceof OpenAI.BadRequestError) return new MakerError(`OpenAI refused the request: ${e.message}`);
  if (e instanceof OpenAI.APIConnectionError) return new MakerError("Could not reach OpenAI. Check the connection and try again.");
  if (e instanceof OpenAI.APIError) return new MakerError(`OpenAI returned an error (${e.status ?? "no status"}). Try again in a moment.`);
  return e instanceof Error ? e : new Error(String(e));
}

export async function makeWithOpenAI(o: RunOptions): Promise<RunResult> {
  const client = openaiClient(o.apiKey);
  const usage = noUsage();
  // Nothing is stored at OpenAI between turns (store: false); the conversation is resent, with
  // encrypted reasoning carried forward so fixes build on the model's earlier thinking.
  const input: ResponseInputItem[] = [{ role: "user", content: o.request }];
  let model = o.model;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    o.onStage?.({ kind: "thinking" });
    let response: OpenAI.Responses.Response;
    try {
      let chars = 0;
      const stream = client.responses.stream(
        {
          model: o.model,
          instructions: systemPrompt,
          input,
          tools: [{ type: "function", name: TOOL_NAME, description: toolDescription, parameters: toolSchema, strict: false }],
          reasoning: { effort: o.effort },
          store: false,
          include: ["reasoning.encrypted_content"],
          max_output_tokens: 64000,
        },
        { signal: o.signal },
      );
      stream.on("response.function_call_arguments.delta", (event) => o.onStage?.({ kind: "writing", chars: (chars += event.delta.length) }));
      response = await stream.finalResponse();
    } catch (e) {
      throw friendly(e);
    }
    model = response.model;
    const cached = response.usage?.input_tokens_details?.cached_tokens ?? 0;
    usage.input += (response.usage?.input_tokens ?? 0) - cached;
    usage.cacheRead += cached;
    usage.output += response.usage?.output_tokens ?? 0;

    if (response.status === "incomplete")
      throw new MakerError(
        response.incomplete_details?.reason === "content_filter"
          ? "The model declined this request. Rephrase the objective or notes and try again."
          : "The model ran out of room before finishing the worksheet. Try a lower thinking level or a shorter request.",
      );
    const calls = response.output.filter((item): item is OpenAI.Responses.ResponseFunctionToolCall => item.type === "function_call");
    input.push(...(response.output as ResponseInputItem[]));
    const call = calls.find((c) => c.name === TOOL_NAME);
    if (!call) {
      input.push({ role: "user", content: `Submit the complete worksheet now by calling ${TOOL_NAME}.` });
      continue;
    }
    o.onStage?.({ kind: "checking", attempt });
    let args: unknown;
    try {
      args = JSON.parse(call.arguments);
    } catch {
      args = undefined;
    }
    const checked = args === undefined ? ({ ok: false, feedback: "The tool arguments were not valid JSON. Submit the whole worksheet again." } as const) : checkSubmission(args);
    if (checked.ok) return { submission: checked.submission, resource: checked.resource, usage, attempts: attempt, model };
    if (attempt < MAX_ATTEMPTS) o.onStage?.({ kind: "fixing", attempt, problems: checked.feedback });
    for (const c of calls) input.push({ type: "function_call_output", call_id: c.call_id, output: c === call ? checked.feedback : "Ignored: submit once." });
  }
  throw new MakerError(`The worksheet still did not pass the checks after ${MAX_ATTEMPTS} tries. Try again, or choose a stronger model or higher thinking level.`);
}
