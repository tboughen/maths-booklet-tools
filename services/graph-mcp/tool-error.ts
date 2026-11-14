/**
 * The connector's one error result (improvement list M12). Every tool, including the SDK's own
 * input validation, answers a failure with the same JSON body in its text content:
 *
 *   { "code": "invalid_input", "message": "spec.categories: Expected array",
 *     "fields": [{ "path": "spec.categories", "message": "Expected array" }],
 *     "hint": "Check diagram_capabilities {kind:\"charts\"} for the expected fields.",
 *     "retry": "fix_input" }
 *
 * The body shape lives in packages/envelope-core/src/errors.ts so cores throw the same errors.
 */
import { z } from "zod";
import { toErrorBody, zodFields, fieldSentence, type ErrorDefaults, type ToolErrorBody } from "../../packages/envelope-core/src/errors";

export type { ToolErrorBody } from "../../packages/envelope-core/src/errors";

/** Codes whose underlying message may hold internal detail, so the text is replaced. */
const OPAQUE = new Set(["render_failed", "internal"]);

/** The error body for anything a tool threw, with internal detail kept out. */
export function errorBody(error: unknown, defaults: ErrorDefaults): ToolErrorBody {
  const body = toErrorBody(error, defaults);
  if (OPAQUE.has(body.code)) return { ...body, message: defaults.code === body.code ? defaults.message : "The request could not be completed. Try again or simplify it." };
  return body;
}

/** A tool result carrying the error body as JSON text. */
export function errorResult(body: ToolErrorBody) {
  return { isError: true as const, content: [{ type: "text" as const, text: JSON.stringify(body) }] };
}

/** Shorthand: the error result for anything a tool threw. */
export function toolFailure(error: unknown, defaults: ErrorDefaults) {
  return errorResult(errorBody(error, defaults));
}

/** Where each tool's field names are listed, for invalid_input hints. */
export function fieldHintFor(tool: string, args: unknown): string | undefined {
  const kind = typeof args === "object" && args !== null && typeof (args as { kind?: unknown }).kind === "string" ? (args as { kind: string }).kind : undefined;
  if (tool === "create_worksheet" || tool === "create_booklet") return "Check worksheet_capabilities for the layouts, item types and limits.";
  if (kind && tool !== "diagram_capabilities") return `Check diagram_capabilities {kind:"${kind}"} for the expected fields.`;
  return "Check the tool's input schema for the expected fields.";
}

/**
 * The body for arguments that fail a tool's own input schema, before its handler runs. The SDK
 * would otherwise answer with an unstructured "Input validation error: ..." string.
 */
export function inputErrorBody(tool: string, error: z.ZodError, args: unknown): ToolErrorBody {
  const fields = zodFields(error);
  return { code: "invalid_input", message: fieldSentence(fields), fields: fields.slice(0, 20), hint: fieldHintFor(tool, args), retry: "fix_input" };
}
