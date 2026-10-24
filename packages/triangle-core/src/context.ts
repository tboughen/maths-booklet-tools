import type { Method } from "./maths";
import {
  allLabels,
  basis,
  numeric,
  textOf,
  type Envelope,
  type Label,
} from "./model";
import { owningTriangles, triangleName } from "./ownership";

/** Prepared helper inputs depend on which givens are printed. Saved answers
 * retain the core's existing mathematical-basis/visibility compatibility. */
export const printedInputBasis = (e: Envelope) =>
  JSON.stringify({
    maths: basis(e),
    givens: allLabels(e)
      .filter((l) => l.kind !== "vertex" && l.label.state === "value")
      .map((l) => l.ref),
    rightMarks: e.document.angles
      .filter((a) => a.mark === "right")
      .map((a) => a.id),
  });

export type CalculationContext = {
  target: string;
  triangle: string;
  method: Method;
  raw: Record<string, string>;
  unit: "cm" | "mm" | "m";
  sources: string[];
  missing: string[];
};
const number = (e: Envelope, l: Label | undefined) => {
  if (!l || l.state !== "value") return "";
  try {
    const text = textOf(e, l);
    return numeric(text) > 0 ? text : "";
  } catch {
    return "";
  }
};
export function calculationContexts(
  e: Envelope,
  target: string,
  triangle: string,
): CalculationContext[] {
  if (!owningTriangles(e, target).some((t) => t.id === triangle)) return [];
  const t = e.document.triangles.find((t) => t.id === triangle)!,
    [kind, id] = target.split(":");
  const side = (opposite: string) =>
    e.document.edges.find(
      (a) =>
        t.vertices.includes(a.from) &&
        t.vertices.includes(a.to) &&
        a.from !== opposite &&
        a.to !== opposite,
    )!;
  const angle = (v: string) =>
    e.document.angles.find((a) => a.id === `${t.id}-${v}`);
  const sv = (v: string) => number(e, side(v).label);
  const av = (v: string) => {
    const a = angle(v);
    return t.rightAt === v || a?.mark === "right" ? "90" : number(e, a?.label);
  };
  const usedUnits = new Set(
    e.document.edges
      .filter(
        (a) =>
          t.vertices.includes(a.from) &&
          t.vertices.includes(a.to) &&
          number(e, a.label),
      )
      .map((a) => a.label.unit)
      .filter(Boolean),
  );
  const unit = ([...usedUnits][0] || "cm") as "cm" | "mm" | "m";
  const result: CalculationContext[] = [];
  const add = (
    method: Method,
    raw: Record<string, string>,
    sources: string[],
    required = Object.keys(raw).filter(
      (k) => !["knownSide", "targetSide", "ratio"].includes(k),
    ),
  ) =>
    result.push({
      target,
      triangle,
      method,
      raw,
      unit,
      sources: sources.map(
        (source, i) => `${required[i] ?? "Given"}: ${source}`,
      ),
      missing: required.filter((k) => !raw[k]),
    });
  const sourceSide = (v: string) => {
    const s = side(v);
    return `${name(s.from)}${name(s.to)} = ${sv(v) || "?"} ${unit}`;
  };
  const name = (v: string) => {
    const label = e.document.vertices.find((a) => a.id === v)!.label;
    return textOf(e, label) || v;
  };
  const sourceAngle = (v: string) =>
    `Angle at ${name(v)} in ${triangleName(e, t.id)} = ${av(v) || "?"}°`;
  if (kind === "e") {
    const edge = e.document.edges.find((a) => a.id === id)!;
    const A = t.vertices.find((v) => v !== edge.from && v !== edge.to)!,
      [B, C] = t.vertices.filter((v) => v !== A);
    if (t.rightAt) {
      const H = t.rightAt,
        legs = t.vertices.filter((v) => v !== H);
      if (A === H)
        add(
          "pythagoras-hypotenuse",
          { p: sv(legs[0]), q: sv(legs[1]) },
          legs.map(sourceSide),
        );
      else {
        const P = legs.find((v) => v !== A)!;
        add("pythagoras-leg", { h: sv(H), p: sv(P) }, [
          sourceSide(H),
          sourceSide(P),
        ]);
      }
      for (const alpha of t.vertices.filter((v) => v !== H && av(v))) {
        const classify = (v: string) =>
          v === H ? "H" : v === alpha ? "O" : "A";
        const known = t.vertices.find((v) => v !== A && sv(v));
        if (known) {
          add(
            "right-side",
            {
              angle: av(alpha),
              known: sv(known),
              knownSide: classify(known),
              targetSide: classify(A),
            },
            [sourceAngle(alpha), sourceSide(known)],
          );
          break;
        }
      }
    }
    add("cosine-side", { b: sv(B), c: sv(C), A: av(A) }, [
      sourceSide(B),
      sourceSide(C),
      sourceAngle(A),
    ]);
    const known = [B, C].sort(
      (a, b) => Number(!!sv(b) && !!av(b)) - Number(!!sv(a) && !!av(a)),
    )[0];
    add("sine-side", { a: sv(known), A: av(known), B: av(A) }, [
      sourceSide(known),
      sourceAngle(known),
      sourceAngle(A),
    ]);
  }
  if (kind === "a") {
    const a = e.document.angles.find((a) => a.id === id)!,
      A = a.vertex,
      [B, C] = t.vertices.filter((v) => v !== A);
    add("angle-sum", { A: av(B), B: av(C) }, [sourceAngle(B), sourceAngle(C)]);
    if (t.rightAt && A !== t.rightAt) {
      const H = t.rightAt,
        adj = t.vertices.find((v) => v !== A && v !== H)!;
      const ratio = sv(A) && sv(H) ? "sin" : sv(adj) && sv(H) ? "cos" : "tan";
      const numerator = ratio === "cos" ? adj : A,
        denominator = ratio === "tan" ? adj : H;
      add(
        "right-angle",
        { numerator: sv(numerator), denominator: sv(denominator), ratio },
        [sourceSide(numerator), sourceSide(denominator)],
      );
    }
    add("cosine-angle", { a: sv(A), b: sv(B), c: sv(C) }, [
      sourceSide(A),
      sourceSide(B),
      sourceSide(C),
    ]);
    const known = [B, C].sort(
      (a, b) => Number(!!sv(b) && !!av(b)) - Number(!!sv(a) && !!av(a)),
    )[0];
    add("sine-angle", { a: sv(known), A: av(known), b: sv(A) }, [
      sourceSide(known),
      sourceAngle(known),
      sourceSide(A),
    ]);
    const areas = e.document.captions.filter(
      (c) => number(e, c.label) && c.label.unit === `${unit}²`,
    );
    const area = t.area
      ? t.area.unit === `${unit}²`
        ? { label: t.area }
        : undefined
      : e.document.layout === "single" && areas.length === 1
        ? areas[0]
        : undefined;
    if (area)
      add("area-angle", { b: sv(B), c: sv(C), area: number(e, area.label) }, [
        sourceSide(B),
        sourceSide(C),
        `Area = ${number(e, area.label)} ${area.label.unit}`,
      ]);
  }
  if (kind === "c" || kind === "r") {
    const h = e.document.heights.find((h) => h.triangleId === triangle),
      base = h && e.document.edges.find((a) => a.id === h.base);
    add(
      "area-height",
      { base: number(e, base?.label), height: number(e, h?.label) },
      [
        base
          ? `Base ${name(base.from)}${name(base.to)} = ${number(e, base.label) || "?"} ${unit}`
          : "Select/enter a base",
        `Perpendicular height = ${number(e, h?.label) || "?"} ${unit}`,
      ],
    );
    const A =
        t.vertices.find(
          (v) => av(v) && t.vertices.filter((x) => x !== v).every((x) => sv(x)),
        ) || t.vertices[0],
      [B, C] = t.vertices.filter((v) => v !== A);
    add("area-sine", { b: sv(B), c: sv(C), A: av(A) }, [
      sourceSide(B),
      sourceSide(C),
      sourceAngle(A),
    ]);
  }
  if (kind === "h") {
    const h = e.document.heights.find((h) => h.id === id)!,
      base = e.document.edges.find((a) => a.id === h.base)!;
    const areas = e.document.captions.filter(
      (c) => number(e, c.label) && c.label.unit === `${unit}²`,
    );
    const area = t.area
      ? t.area.unit === `${unit}²`
        ? { label: t.area }
        : undefined
      : e.document.layout === "single" && areas.length === 1
        ? areas[0]
        : undefined;
    add(
      "height-area",
      { area: area ? number(e, area.label) : "", base: number(e, base.label) },
      [
        area
          ? `Area = ${number(e, area.label)} ${area.label.unit}`
          : "Enter the area of this triangle",
        `Base ${name(base.from)}${name(base.to)} = ${number(e, base.label) || "?"} ${unit}`,
      ],
    );
  }
  return result.sort((a, b) => a.missing.length - b.missing.length);
}
