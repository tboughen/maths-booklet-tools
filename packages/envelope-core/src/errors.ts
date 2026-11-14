/**
 * One error shape for every MathsDock tool (improvement list M12). Cores throw MathsDockError (or
 * a subclass such as GraphError) with a stable code; the connector turns any thrown value into a
 * ToolErrorBody, so a model always reads the same fields whichever tool or family failed:
 *
 *   { code, message, fields?: [{ path, message }], hint?, retry }
 *
 * `message` repeats the field problems in words, so a client that shows only the text still
 * sees them. `retry` says what would make a retry succeed:
 *   fix_input        change the named fields (or the request) and call again
 *   refresh_envelope revise the exact envelope from the last result, quoting its contentHash
 *   try_later        a temporary limit (quota, busy renderer); the same call may work later
 *   none             retrying the same call will not help
 *
 * Pure: no MCP or Node imports, so cores and the website can throw the same errors.
 */
import { z } from "zod";

export type RetryAdvice = "fix_input" | "refresh_envelope" | "try_later" | "none";
export interface FieldProblem {
  /** Dotted path from the tool's arguments, e.g. "spec.series.0.values". "input" for the whole input. */
  path: string;
  message: string;
}
export interface ToolErrorBody {
  code: string;
  message: string;
  fields?: FieldProblem[];
  hint?: string;
  retry: RetryAdvice;
}

/** An error with a stable machine-readable code, optional field problems and a hint. */
export class MathsDockError extends Error {
  constructor(
    public code: string,
    message: string,
    public details: { fields?: FieldProblem[]; hint?: string; retry?: RetryAdvice } = {},
  ) {
    super(message);
    this.name = "MathsDockError";
  }
}

/** Codes whose retry advice is not "fix_input". Anything unlisted is fixed by changing the input. */
const RETRY: Record<string, RetryAdvice> = {
  stale_hash: "refresh_envelope",
  quota_exceeded: "try_later",
  rate_limited: "try_later",
  busy: "try_later",
  render_timeout: "try_later",
  render_failed: "none",
  internal: "none",
};
/** Older codes, kept readable in the cores, mapped to the one current name. */
const ALIASES: Record<string, string> = { base_hash_mismatch: "stale_hash", stale_document: "stale_hash" };
/** The wording older cores use for a stale baseHash without a code. */
const STALE = /^The baseHash does not match|base hash is stale/i;
/** Codes a plain Error may carry as a "code: message" prefix. Any other "word: " stays message text. */
const PREFIXES = new Set([...Object.keys(RETRY), ...Object.keys(ALIASES), "invalid_input", "invalid_diagram", "invalid_graph", "invalid_ratio", "unsupported"]);

export function retryFor(code: string): RetryAdvice {
  return RETRY[code] ?? "fix_input";
}

/** Field problems from a zod error, paths joined with dots ("input" for the root). */
export function zodFields(error: z.ZodError, prefix: (string | number)[] = []): FieldProblem[] {
  return error.issues.map((i) => {
    const path = [...prefix, ...i.path.map((p) => (typeof p === "symbol" ? String(p) : p))];
    return { path: path.length ? path.join(".") : "input", message: i.message };
  });
}

/** "a.b: problem; c: problem (3 more)": the field problems as one readable sentence. */
export function fieldSentence(fields: FieldProblem[], limit = 6): string {
  const lines = fields.slice(0, limit).map((f) => `${f.path}: ${f.message}`);
  if (fields.length > limit) lines.push(`(${fields.length - limit} more)`);
  return lines.join("; ");
}

export interface ErrorDefaults {
  /** Code for a plain Error, such as "invalid_diagram" or "invalid_worksheet". */
  code: string;
  /** Message when the thrown value carries none worth showing. */
  message: string;
  /** Hint for schema problems, such as which capabilities call lists the fields. */
  fieldHint?: string;
  /** Path segments in front of zod paths, e.g. ["resource"] when the tool validated args.resource. */
  pathPrefix?: (string | number)[];
  /**
   * True where an uncoded Error may come from the runtime (rasterising, zipping, storage) rather
   * than from a core's checks: its message is replaced by the default message.
   */
  opaque?: boolean;
}

/**
 * The one error body for anything a tool threw. Zod errors become "invalid_input" with fields;
 * a coded error keeps its code; a message that starts with a known code ("stale_hash: ") is read
 * as that code; any other Error keeps its message under the default code, unless `opaque` is set.
 * Non-Error values never leak.
 */
export function toErrorBody(error: unknown, defaults: ErrorDefaults): ToolErrorBody {
  if (error instanceof z.ZodError) {
    const fields = zodFields(error, defaults.pathPrefix);
    return { code: "invalid_input", message: fieldSentence(fields), fields: fields.slice(0, 20), ...(defaults.fieldHint ? { hint: defaults.fieldHint } : {}), retry: "fix_input" };
  }
  if (!(error instanceof Error)) return { code: defaults.code, message: defaults.message, retry: retryFor(defaults.code) };
  const own = (error as unknown as { code?: unknown }).code;
  let code: string | undefined = typeof own === "string" ? own : undefined;
  let message = error.message || defaults.message;
  const prefixed = /^([a-z][a-z0-9_]{2,40}): (.+)$/s.exec(message);
  if (prefixed && PREFIXES.has(prefixed[1]) && (!code || code === prefixed[1])) {
    code = prefixed[1];
    message = prefixed[2];
  }
  code = ALIASES[code ?? ""] ?? code;
  if (!code) code = STALE.test(message) ? "stale_hash" : defaults.code;
  if (defaults.opaque && code === defaults.code && !(error instanceof MathsDockError)) return { code, message: defaults.message, retry: retryFor(code) };
  const details = error instanceof MathsDockError ? error.details : {};
  const hint = details.hint ?? (code === "stale_hash" ? "Revise the exact envelope from the last result and quote its contentHash as baseHash." : details.fields?.length ? defaults.fieldHint : undefined);
  return {
    code,
    message: details.fields?.length && !message ? fieldSentence(details.fields) : message,
    ...(details.fields?.length ? { fields: details.fields } : {}),
    ...(hint ? { hint } : {}),
    retry: details.retry ?? retryFor(code),
  };
}
