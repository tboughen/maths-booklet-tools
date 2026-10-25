import { z } from "zod";
import * as v1 from "./index";
import * as v2 from "./v2";
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
]);
export type Envelope = v1.Envelope | v2.Envelope;
export const validate = (raw: unknown): Envelope => {
  const e = schema.parse(raw);
  return e.schemaVersion === 1 ? v1.validate(e) : v2.validate(e);
};
export const canonical = (e: Envelope) =>
  e.schemaVersion === 1 ? v1.canonical(e) : v2.canonical(e);
export function parseFile(raw: string): Envelope {
  if (new TextEncoder().encode(raw).length > 32768)
    throw Error("Use an editable file up to 32 KiB.");
  return validate(JSON.parse(raw));
}
export async function hash(e: Envelope) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(canonical(e)),
      ),
    ),
  )
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
export const layout = (e: Envelope) =>
  e.schemaVersion === 1 ? v1.layout(e) : v2.layout(e);
export const renderSvg = (e: Envelope) =>
  e.schemaVersion === 1 ? v1.renderSvg(e) : v2.renderSvg(e);
export const exportIssue = (e: Envelope) =>
  e.schemaVersion === 1 ? v1.exportIssue(e) : v2.exportIssue(e);
export const warnings = (e: Envelope) =>
  e.schemaVersion === 1 ? v1.warnings(e) : v2.warnings(e);
export const printFacts = (e: Envelope) =>
  e.schemaVersion === 1 ? v1.printFacts(e) : v2.printFacts(e);
