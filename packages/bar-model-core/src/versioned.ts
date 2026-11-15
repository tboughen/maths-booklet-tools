/**
 * The bar-model family's one entry point for the site, the connector and the gates. Bar models
 * have one saved format, schema 3 (v3.ts); schemas 1 and 2 were removed on 14 Nov 2026.
 */
import * as v3 from "./v3";
import { REVEALED_LABELS, type Label } from "./index";
import { sha256Hex } from "../../envelope-core/src/index";
export { LIMITS, labelSchema, label, visible } from "./index";
export type { Label, Anchor } from "./index";
export { exampleNames, example } from "./examples";
export const schema = v3.schema;
export type Envelope = v3.Envelope;
export const validate = v3.validate;
export const canonical = v3.canonical;
export function parseFile(raw: string): Envelope {
  if (new TextEncoder().encode(raw).length > 32768)
    throw Error("Use an editable file up to 32 KiB.");
  return validate(JSON.parse(raw));
}
export async function hash(e: Envelope): Promise<string> {
  return sha256Hex(canonical(e));
}
export const layout = v3.layout;
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
        if (mark) REVEALED_LABELS.add(o as unknown as Label);
      }
      Object.values(o).forEach(walk);
    }
  };
  walk(n.document);
  return n;
}
export const hasHiddenAnswers = (e: Envelope) => JSON.stringify(forView(e, "answer")) !== JSON.stringify(e);
export const renderSvg = v3.renderSvg;
export const exportIssue = v3.exportIssue;
export const warnings = v3.warnings;
export const printFacts = v3.printFacts;
