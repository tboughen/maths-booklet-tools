import type { Resource } from "../../../packages/resource-core/src/index";
import type { Submission } from "./brief";

export type Provider = "anthropic" | "openai";
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

export interface RunOptions {
  apiKey: string;
  model: string;
  effort: Effort;
  /** The user turn: a new brief or a change request with the current worksheet. */
  request: string;
  signal?: AbortSignal;
  onStage?: (stage: Stage) => void;
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
