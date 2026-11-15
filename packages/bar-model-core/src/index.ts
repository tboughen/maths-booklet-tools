/**
 * Shared bar-model pieces: limits, labels, anchors and exact rationals. The one saved format
 * (schema 3) lives in v3.ts; schemas 1 and 2 were removed on 14 Nov 2026 (no backwards compatibility).
 */
import { z } from "zod";

export const LIMITS = {
  bars: 6,
  partsPerBar: 24,
  parts: 96,
  spans: 18,
  operations: 30,
  labelCharacters: 80,
  requestBytes: 32768,
  widthMm: 280,
  heightMm: 260,
} as const;
const id = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,31}$/);
export const labelSchema = z
  .object({
    text: z
      .string()
      .max(80)
      .regex(
        // Reject XML-invalid controls rather than emitting a corrupt SVG.
        // eslint-disable-next-line no-control-regex
        /^[^\u0000-\u001f\u007f]*$/,
        "Labels cannot contain control characters.",
      ),
    state: z.enum(["value", "blank", "question", "line", "hidden"]),
  })
  .strict();
export type Label = z.infer<typeof labelSchema>;
export const label = (
  text = "",
  state: Label["state"] = text ? "value" : "blank",
): Label => ({ text, state });
export const anchorSchema = z
  .object({ barId: id, partId: id, edge: z.enum(["start", "end"]) })
  .strict();
export type Anchor = z.infer<typeof anchorSchema>;
export type Q = { n: bigint; d: bigint };
function gcd(a: bigint, b: bigint): bigint {
  return b ? gcd(b, a % b) : a < 0n ? -a : a;
}
function q(n: bigint, d: bigint): Q {
  if (d === 0n) throw Error("A denominator cannot be zero.");
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  n /= g;
  d /= g;
  if (n > 1000000n || n < -1000000n || d > 10000n)
    throw Error(
      "Use a rational with numerator at most 1000000 and denominator at most 10000.",
    );
  return { n, d };
}
export function exact(s: string): Q {
  if (!/^-?\d{1,7}(?:\/\d{1,5}|\.\d{1,4})?$/.test(s))
    throw Error(
      "Use an exact integer, decimal (up to four places) or fraction for geometry.",
    );
  if (s.includes("/")) {
    const [n, d] = s.split("/");
    return q(BigInt(n), BigInt(d));
  }
  const [n, f] = s.split(".");
  return f ? q(BigInt(n + f), 10n ** BigInt(f.length)) : q(BigInt(n), 1n);
}
/** The house answer colour, as on graphs, ratio tables, trees and worksheet answer lines. */
export const BAR_ANSWER_COLOUR = "#b0125b";
/** Labels an answers copy shows only because they were saved hidden: drawn in the answer colour. */
export const REVEALED_LABELS = new WeakSet<Label>();
/** A label's artwork, recoloured when it is a revealed saved answer. */
export const inkRevealed = (l: Label, svg: string) =>
  REVEALED_LABELS.has(l) ? svg.replaceAll('"#000"', `"${BAR_ANSWER_COLOUR}"`) : svg;
export const visible = (l: Label) =>
  l.state === "value" ? l.text : l.state === "question" ? "?" : "";
