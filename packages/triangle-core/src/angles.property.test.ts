// Property tests for constructed triangles (improvement list L19): whatever is typed into Construct,
// the drawn angles add to 180° and match what was asked for, and side labels are never drawn over each
// other, over seeded random triangles (src/testing/random.ts).
import { describe, expect, it } from "vitest";
import { forAll, type Random } from "../../../src/testing/random";
import { starter, triangleVertices } from "./geometry";
import { construct, type Construction } from "./maths";
import { layout, type Rect } from "./render";
import type { Envelope, Point } from "./model";

const deg = Math.PI / 180, dp = (v: number) => v.toFixed(2);
/** Interior angles at A, B, C in degrees and the sides a, b, c, read from the drawn vertices. */
function measure(e: Envelope) {
  const [A, B, C] = triangleVertices(e, e.document.triangles[0]), len = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.y - q.y);
  const at = (v: Point, p: Point, q: Point) => Math.acos(((p.x - v.x) * (q.x - v.x) + (p.y - v.y) * (q.y - v.y)) / (len(v, p) * len(v, q))) / deg;
  return { A: at(A, B, C), B: at(B, C, A), C: at(C, A, B), a: len(B, C), b: len(A, C), c: len(A, B) };
}
/** A random triangle with no angle under `least` degrees, as the inputs for one construction. */
function request(r: Random, least = 10) {
  let A: number, B: number, C: number;
  do [A, B] = [r.int(least, 160), r.int(least, 160)];
  while ((C = 180 - A - B) < least);
  const c = r.int(20, 150) / 10, k = c / Math.sin(C * deg), a = k * Math.sin(A * deg), b = k * Math.sin(B * deg);
  const method = r.pick<Construction>(["SSS", "SAS", "ASA", "AAS", "right"]);
  const raw: Record<string, string> = { SSS: { a: dp(a), b: dp(b), c: dp(c) }, SAS: { b: dp(b), c: dp(c), A: `${A}` }, ASA: { A: `${A}`, B: `${B}`, c: dp(c) }, AAS: { A: `${A}`, C: `${C}`, c: dp(c) }, right: { b: dp(b), c: dp(c) } }[method];
  return { method, raw, e: construct(starter(), "T1", method, raw) };
}
/** The white boxes drawn behind labels in the SVG, by label reference. */
const boxes = (svg: string) =>
  [...svg.matchAll(/data-triangle-label="([^"]+)"><rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/g)].map((m) => ({ ref: m[1], r: { x: +m[2], y: +m[3], w: +m[4], h: +m[5] } }));
const overlap = (p: Rect, q: Rect) => p.x + p.w > q.x && q.x + q.w > p.x && p.y + p.h > q.y && q.y + q.h > p.y;
const clashes = (list: { r: Rect }[]) => list.some((p, i) => list.slice(i + 1).some((q) => overlap(p.r, q.r)));

describe("constructed triangles", () => {
  it("the drawn angles add to 180° and match the angles and side ratios asked for", () => {
    forAll(300, (r) => {
      const { method, raw, e } = request(r), m = measure(e);
      expect(m.A + m.B + m.C).toBeCloseTo(180, 9);
      if (method === "SSS") expect([m.a / m.c, m.b / m.c].map((v) => v.toFixed(9))).toEqual([+raw.a / +raw.c, +raw.b / +raw.c].map((v) => v.toFixed(9)));
      if (method === "SAS" || method === "right") expect(m.b / m.c).toBeCloseTo(+raw.b / +raw.c, 9);
      if (method === "right") expect(m.A).toBeCloseTo(90, 9);
      for (const k of ["A", "B", "C"] as const) if (raw[k]) expect(m[k]).toBeCloseTo(+raw[k], 9);
    });
  });

  it("side labels do not overlap on triangles with no angle under 25°", () => {
    forAll(200, (r) => {
      const sides = boxes(layout(request(r, 25).e).svg).filter((b) => b.ref.startsWith("e:"));
      expect(sides).toHaveLength(3);
      expect(clashes(sides)).toBe(false);
    });
  });

  it("labels are never drawn over each other without the overlap warning", () => {
    forAll(200, (r) => {
      const m = layout(request(r).e);
      if (clashes(boxes(m.svg))) expect(m.issues).toContain("Some labels overlap. Adjust their positions or increase print width.");
    });
  });
});
