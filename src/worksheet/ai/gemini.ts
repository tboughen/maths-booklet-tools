import { ApiError, FinishReason, FunctionCallingConfigMode, GoogleGenAI, ThinkingLevel, type Content, type FunctionCall, type GenerateContentResponse, type Part } from "@google/genai";
import { systemPrompt, toolDescription, toolSchema, TOOL_NAME } from "./brief";
import { checkSubmission } from "./check";
import { addUsage, MakerError, MAX_ATTEMPTS, noUsage, type Effort, type RunOptions, type RunResult } from "./types";

export function geminiClient(apiKey: string) {
  // The teacher's own key goes straight from this browser to Google; MathsDock never sees it.
  return new GoogleGenAI({ apiKey, httpOptions: { retryOptions: { attempts: 3 } } });
}

/** Text models the key can use, newest first. The list comes from Google, so it stays current. */
export async function listGeminiModels(apiKey: string, signal?: AbortSignal): Promise<string[]> {
  const ids: string[] = [];
  const pager = await geminiClient(apiKey).models.list({ config: { pageSize: 100, abortSignal: signal } });
  for await (const m of pager) {
    const id = (m.name ?? "").replace(/^models\//, "");
    if (!m.supportedActions?.includes("generateContent")) continue;
    if (!/^gemini-/.test(id) || /(image|tts|audio|live|embedding|robotics|transcribe|omni|computer-use)/.test(id)) continue;
    ids.push(id);
  }
  return ids.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
}

const thinking: Record<Effort, ThinkingLevel> = { low: ThinkingLevel.LOW, medium: ThinkingLevel.MEDIUM, high: ThinkingLevel.HIGH, xhigh: ThinkingLevel.HIGH, max: ThinkingLevel.HIGH };
const declined = new Set<string>([FinishReason.SAFETY, FinishReason.PROHIBITED_CONTENT, FinishReason.BLOCKLIST, FinishReason.SPII, FinishReason.RECITATION]);

function friendly(e: unknown, signal?: AbortSignal): Error {
  if (signal?.aborted || (e instanceof Error && e.name === "AbortError")) return new MakerError("Stopped.");
  if (e instanceof ApiError) {
    if ((e.status === 400 && /API key not valid|API_KEY_INVALID/i.test(e.message)) || e.status === 401)
      return new MakerError("Google did not accept this API key. Check it in AI settings. A Gemini app subscription does not include API access: the key must come from aistudio.google.com.");
    if (e.status === 403) return new MakerError("This Google key cannot use that model. Choose another model in AI settings, or check the key's project in Google AI Studio.");
    if (e.status === 404) return new MakerError("Google does not recognise that model name. Choose another model in AI settings.");
    if (e.status === 429) return new MakerError("Google says this key has hit its rate limit or quota. Wait a minute, or check billing in Google AI Studio.");
    if (e.status === 400) return new MakerError(`Google refused the request: ${e.message}`);
    return new MakerError(`Google returned an error (${e.status}). Try again in a moment.`);
  }
  if (e instanceof TypeError) return new MakerError("Could not reach Google. Check the connection and try again.");
  return e instanceof Error ? e : new Error(String(e));
}

export async function makeWithGemini(o: RunOptions): Promise<RunResult> {
  const client = geminiClient(o.apiKey);
  const usage = noUsage();
  // Nothing is stored at Google between turns; the conversation is resent with the model's own
  // parts (and their thought signatures) so fixes build on its earlier thinking.
  const contents: Content[] = [{ role: "user", parts: [{ text: o.request }] }];
  let model = o.model;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    o.onStage?.({ kind: "thinking" });
    const parts: Part[] = [];
    let last: GenerateContentResponse | undefined;
    try {
      let chars = 0;
      const stream = await client.models.generateContentStream({
        model: o.model,
        contents,
        config: {
          systemInstruction: systemPrompt,
          tools: [{ functionDeclarations: [{ name: TOOL_NAME, description: toolDescription, parametersJsonSchema: toolSchema }] }],
          // Gemini can be required to call the tool, so no reminder turn is needed.
          toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY, allowedFunctionNames: [TOOL_NAME] } },
          thinkingConfig: { thinkingLevel: thinking[o.effort] },
          maxOutputTokens: 64000,
          abortSignal: o.signal,
        },
      });
      for await (const chunk of stream) {
        last = chunk;
        for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
          parts.push(part);
          if (part.functionCall) o.onStage?.({ kind: "writing", chars: (chars += JSON.stringify(part.functionCall.args ?? {}).length) });
        }
      }
    } catch (e) {
      throw friendly(e, o.signal);
    }
    if (!last) throw new MakerError("Google sent an empty reply. Try again in a moment.");
    model = last.modelVersion ?? model;
    const u = last.usageMetadata;
    const cached = u?.cachedContentTokenCount ?? 0;
    const step = { input: (u?.promptTokenCount ?? 0) - cached + (u?.toolUsePromptTokenCount ?? 0), output: (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0), cacheRead: cached, cacheWrite: 0 };
    addUsage(usage, step);
    o.onUsage?.(step, model);

    const finish = last.candidates?.[0]?.finishReason;
    if (last.promptFeedback?.blockReason || (finish && declined.has(finish))) throw new MakerError("The model declined this request. Rephrase the objective or notes and try again.");
    if (finish === FinishReason.MAX_TOKENS) throw new MakerError("The model ran out of room before finishing the worksheet. Try a lower thinking level or a shorter request.");

    contents.push({ role: "model", parts });
    const calls = parts.map((p) => p.functionCall).filter((c): c is FunctionCall => !!c);
    const call = calls.find((c) => c.name === TOOL_NAME);
    if (!call) {
      contents.push({ role: "user", parts: [{ text: `Submit the complete worksheet now by calling ${TOOL_NAME}.` }] });
      continue;
    }
    o.onStage?.({ kind: "checking", attempt });
    const checked = checkSubmission(call.args);
    if (checked.ok) return { submission: checked.submission, resource: checked.resource, usage, attempts: attempt, model };
    if (attempt < MAX_ATTEMPTS) o.onStage?.({ kind: "fixing", attempt, problems: checked.feedback });
    // Every call gets its response, all in one user turn.
    contents.push({
      role: "user",
      parts: calls.map((c) => ({ functionResponse: { id: c.id, name: c.name, response: { error: c === call ? checked.feedback : "Ignored: submit once." } } })),
    });
  }
  throw new MakerError(`The worksheet still did not pass the checks after ${MAX_ATTEMPTS} tries. Try again, or choose a stronger model or higher thinking level.`);
}
