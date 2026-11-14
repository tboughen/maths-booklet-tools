import { z } from "zod";
import * as v1 from "./index";
import * as v2 from "./v2";
import * as v3 from "./v3";
import { sha256Hex } from "../../envelope-core/src/index";
export {
  LIMITS,
  labelSchema,
  label,
  visible,
  exampleNames,
  example,
} from "./index";
export type { Label, Anchor } from "./index";
export const schema = z.discriminatedUnion("schemaVersion", [
  v1.schema,
  v2.schema,
  v3.schema,
]);
export type Envelope = v1.Envelope | v2.Envelope | v3.Envelope;
export const validate = (raw: unknown): Envelope => {
  const e = schema.parse(raw);
  return e.schemaVersion === 1
    ? v1.validate(e)
    : e.schemaVersion === 2
      ? v2.validate(e)
      : v3.validate(e);
};
export const canonical = (e: Envelope) =>
  e.schemaVersion === 1
    ? v1.canonical(e)
    : e.schemaVersion === 2
      ? v2.canonical(e)
      : v3.canonical(e);
export function parseFile(raw: string): Envelope {
  if (new TextEncoder().encode(raw).length > 32768)
    throw Error("Use an editable file up to 32 KiB.");
  return validate(JSON.parse(raw));
}
export async function hash(e: Envelope): Promise<string> {
  return sha256Hex(canonical(e));
}
export const layout = (e: Envelope) =>
  e.schemaVersion === 1
    ? v1.layout(e)
    : e.schemaVersion === 2
      ? v2.layout(e)
      : v3.layout(e);
/**
 * The answers copy: labels saved hidden print their saved text. With `mark` they print in the house
 * answer colour (worksheet answers copies and outputView answer). Blank, question and answer-line
 * labels stay as they are; nothing is calculated.
 */
export function forView(e: Envelope, view: "pupil" | "answer", mark = false): Envelope {
  if (view === "pupil") return e;
  const n = structuredClone(e);
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.text === "string" && o.state === "hidden" && o.text.trim()) {
        o.state = "value";
        if (mark) v1.REVEALED_LABELS.add(o as unknown as v1.Label);
      }
      Object.values(o).forEach(walk);
    }
  };
  walk(n.document);
  return n;
}
export const hasHiddenAnswers = (e: Envelope) => JSON.stringify(forView(e, "answer")) !== JSON.stringify(e);
export const renderSvg = (e: Envelope) =>
  e.schemaVersion === 1
    ? v1.renderSvg(e)
    : e.schemaVersion === 2
      ? v2.renderSvg(e)
      : v3.renderSvg(e);
export const exportIssue = (e: Envelope) =>
  e.schemaVersion === 1
    ? v1.exportIssue(e)
    : e.schemaVersion === 2
      ? v2.exportIssue(e)
      : v3.exportIssue(e);
export const warnings = (e: Envelope) =>
  e.schemaVersion === 1
    ? v1.warnings(e)
    : e.schemaVersion === 2
      ? v2.warnings(e)
      : v3.warnings(e);
export const printFacts = (e: Envelope) =>
  e.schemaVersion === 1
    ? v1.printFacts(e)
    : e.schemaVersion === 2
      ? v2.printFacts(e)
      : v3.printFacts(e);
