import { z } from "zod";
import * as v1 from "./index";
import * as v2 from "./v2";
import * as v3 from "./v3";
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
  e.schemaVersion === 1
    ? v1.layout(e)
    : e.schemaVersion === 2
      ? v2.layout(e)
      : v3.layout(e);
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
