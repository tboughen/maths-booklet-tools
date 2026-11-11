import { systemPrompt, toolDescription, toolSchema, TOOL_NAME, type Submission } from "./brief";
import { checkSubmission } from "./check";
import type { Job, JobResult, Provider, RunOptions, RunResult } from "./types";
import type { Resource } from "../../../packages/resource-core/src/index";

/** Provider code loads only when a teacher first uses the AI maker. */
export async function runJob<T>(provider: Provider, job: Job<T>, o: RunOptions): Promise<JobResult<T>> {
  if (provider === "openai") return (await import("./openai")).makeWithOpenAI(job, o);
  if (provider === "gemini") return (await import("./gemini")).makeWithGemini(job, o);
  return (await import("./anthropic")).makeWithClaude(job, o);
}

export const worksheetJob: Job<{ submission: Submission; resource: Resource }> = {
  system: systemPrompt,
  toolName: TOOL_NAME,
  toolDescription,
  toolSchema,
  noun: "worksheet",
  check(input) {
    const c = checkSubmission(input);
    return c.ok ? { ok: true, value: { submission: c.submission, resource: c.resource } } : { ok: false, feedback: c.feedback };
  },
};

export async function makeWorksheet(provider: Provider, o: RunOptions): Promise<RunResult> {
  const r = await runJob(provider, worksheetJob, o);
  return { submission: r.value.submission, resource: r.value.resource, usage: r.usage, attempts: r.attempts, model: r.model };
}

export async function listModels(provider: Provider, apiKey: string, signal?: AbortSignal): Promise<string[]> {
  if (provider === "openai") return (await import("./openai")).listOpenAIModels(apiKey, signal);
  if (provider === "gemini") return (await import("./gemini")).listGeminiModels(apiKey, signal);
  return (await import("./anthropic")).listClaudeModels(apiKey, signal);
}
