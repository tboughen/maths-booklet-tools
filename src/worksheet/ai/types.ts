import type { Resource } from "../../../packages/resource-core/src/index";
import type { Submission } from "./brief";

export type Provider = "anthropic" | "openai" | "gemini";
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export type Stage =
  | { kind: "thinking" }
  | { kind: "writing"; chars: number }
  | { kind: "checking"; attempt: number }
  | { kind: "fixing"; attempt: number; problems: string };

export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}
export const noUsage = (): Usage => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
export function addUsage(total: Usage, step: Usage): void {
  total.input += step.input;
  total.output += step.output;
  total.cacheRead += step.cacheRead;
  total.cacheWrite += step.cacheWrite;
}

export interface RunOptions {
  apiKey: string;
  model: string;
  effort: Effort;
  /** The user turn: a new brief or a change request with the current worksheet. */
  request: string;
  signal?: AbortSignal;
  onStage?: (stage: Stage) => void;
  /** Each reply's tokens as it arrives, so spend is counted even when a run fails or is stopped. */
  onUsage?: (usage: Usage, model: string) => void;
}

export interface RunResult {
  submission: Submission;
  resource: Resource;
  usage: Usage;
  /** How many times the model submitted before the sheet passed the checks. */
  attempts: number;
  /** The model that actually answered (a provider may fall back to another). */
  model: string;
}

/** Submissions allowed per request: the first plus three fixes. */
export const MAX_ATTEMPTS = 4;

/** A failure the teacher can act on, with no provider jargon. */
export class MakerError extends Error {}
