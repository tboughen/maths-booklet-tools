import type { Provider, RunOptions, RunResult } from "./types";

/** Provider code loads only when a teacher first uses the AI maker. */
export async function makeWorksheet(provider: Provider, o: RunOptions): Promise<RunResult> {
  if (provider === "openai") return (await import("./openai")).makeWithOpenAI(o);
  if (provider === "gemini") return (await import("./gemini")).makeWithGemini(o);
  return (await import("./anthropic")).makeWithClaude(o);
}

export async function listModels(provider: Provider, apiKey: string, signal?: AbortSignal): Promise<string[]> {
  if (provider === "openai") return (await import("./openai")).listOpenAIModels(apiKey, signal);
  if (provider === "gemini") return (await import("./gemini")).listGeminiModels(apiKey, signal);
  return (await import("./anthropic")).listClaudeModels(apiKey, signal);
}
