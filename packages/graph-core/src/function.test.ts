import { describe, expect, it } from "vitest";
import { createGraph, documentFromEnvelope, graphHash, graphWarnings, reviseGraph, validateEnvelope } from "./interchange";
import { formatFunction, functionRuns, functionValue } from "./function";
import { isDiagramDocument } from "./legacy-validation";
import { renderDiagramSvg } from "./svg";

const axes = { x: { negativeSquares: 4, positiveSquares: 4, unitsPerSquare: 1 }, y: { negativeSquares: 6, positiveSquares: 6, unitsPerSquare: 1 } };
const trigAxes = { x: { negativeSquares: 0, positiveSquares: 12, unitsPerSquare: 30 }, y: { negativeSquares: 4, positiveSquares: 4, unitsPerSquare: 0.5 } };

describe("equation curves", () => {
  it("evaluates every family with its gradient", () => {
    expect(functionValue({ family: "polynomial", a: 1, b: -2, c: -3 }, 3)).toEqual({ y: 0, slope: 4 });
    expect(functionValue({ family: "polynomial", a: 0, b: 0, c: 1, cubic: 1 }, 2)).toEqual({ y: 9, slope: 12 });
    expect(functionValue({ family: "reciprocal", k: 6, c: 0 }, 0)).toBeNull();
    expect(functionValue({ family: "reciprocal", k: 6, c: 1 }, 2)).toEqual({ y: 4, slope: -1.5 });
    expect(functionValue({ family: "exponential", coefficient: 3, base: 2, c: 0 }, 2)!.y).toBeCloseTo(12);
    const sin = functionValue({ family: "trig", fn: "sin", amplitude: 1, multiplier: 1, shift: 0, c: 0 }, 30)!;
    expect(sin.y).toBeCloseTo(0.5);
    expect(sin.slope).toBeCloseTo((Math.PI / 180) * Math.cos(Math.PI / 6));
    expect(functionValue({ family: "trig", fn: "tan", amplitude: 1, multiplier: 1, shift: 0, c: 0 }, 90)).toBeNull();
  });
  it("breaks a branch at every asymptote so none is joined across", () => {
    const runs = (equation: Parameters<typeof formatFunction>[0], bounds: { xMin: number; xMax: number; yMin: number; yMax: number }) =>
      functionRuns({ id: "f", kind: "function", equation }, bounds);
    expect(runs({ family: "reciprocal", k: 3, c: 0 }, { xMin: -4, xMax: 4, yMin: -6, yMax: 6 })).toHaveLength(2);
    const tan = runs({ family: "trig", fn: "tan", amplitude: 1, multiplier: 1, shift: 0, c: 0 }, { xMin: 0, xMax: 360, yMin: -2, yMax: 2 });
    expect(tan).toHaveLength(3);
    for (const run of tan) for (let i = 1; i < run.length; i++) expect(Math.abs(run[i].y - run[i - 1].y)).toBeLessThan(4);
  });
  it("prints equations the way pupils write them", () => {
    expect(formatFunction({ family: "polynomial", a: 1, b: -3, c: 0 })).toBe("y = x² − 3x");
    expect(formatFunction({ family: "polynomial", a: -2, b: 0, c: 5, cubic: 1 })).toBe("y = x³ − 2x² + 5");
    expect(formatFunction({ family: "reciprocal", k: 6, c: -1 })).toBe("y = 6/x − 1");
    expect(formatFunction({ family: "exponential", coefficient: 3, base: 2, c: 0 })).toBe("y = 3 × 2ˣ");
    expect(formatFunction({ family: "trig", fn: "cos", amplitude: 2, multiplier: 1, shift: 30, c: -1 })).toBe("y = 2cos (x + 30) − 1");
    expect(formatFunction({ family: "trig", fn: "sin", amplitude: 1, multiplier: 1, shift: 0, c: 0 })).toBe("y = sin x");
  });
  it("creates, renders, validates and round-trips a curve, keeping hidden answers off the pupil copy", () => {
    const e = createGraph({ axes, objects: [{ id: "q", kind: "function", equation: { family: "polynomial", a: 1, b: -2, c: -3 } }, { kind: "function", equation: { family: "reciprocal", k: 3 }, answerOnly: true }] });
    expect(e.document.objects[1]).toEqual({ id: "object-2", kind: "function", equation: { family: "reciprocal", k: 3, c: 0 }, answerOnly: true });
    const pupil = renderDiagramSvg(documentFromEnvelope(e), "pupil");
    const answer = renderDiagramSvg(documentFromEnvelope(e), "answer");
    expect((pupil.match(/class="graph-function"/g) ?? []).length).toBe(1);
    expect((answer.match(/class="graph-function"/g) ?? []).length).toBe(2);
    expect(isDiagramDocument(e.document)).toBe(true);
    expect(validateEnvelope(structuredClone(e)).document).toEqual(e.document);
  });
  it("refuses curves that cannot be drawn, in both validators", () => {
    expect(() => createGraph({ objects: [{ kind: "function", equation: { family: "polynomial", c: 2 } }] })).toThrow(/x² or x³ term/);
    expect(() => createGraph({ objects: [{ kind: "function", equation: { family: "exponential", base: 1 } }] })).toThrow(/base/);
    expect(() => createGraph({ objects: [{ kind: "function", equation: { family: "polynomial", a: 1 }, from: 2, to: 1 }] })).toThrow(/after/);
    const e = createGraph({ objects: [{ kind: "function", equation: { family: "polynomial", a: 1 } }] });
    const bad = structuredClone(e);
    (bad.document.objects[0] as unknown as { equation: Record<string, unknown> }).equation.k = 1;
    expect(() => validateEnvelope(bad)).toThrow();
    expect(isDiagramDocument(bad.document)).toBe(false);
  });
  it("draws a tangent and strips on an equation curve from its exact gradient", async () => {
    const e = createGraph({ axes, objects: [{ id: "q", kind: "function", equation: { family: "polynomial", a: 1, b: -2, c: -3 } }, { kind: "tangent", of: "q", x: 3 }] });
    expect(e.document.objects[1]).toMatchObject({ kind: "straight", start: { x: 1, y: -8 }, end: { x: 5, y: 8 } });
    const r = await reviseGraph({ envelope: e, baseHash: await graphHash(e), operations: [{ op: "add_object", object: { kind: "strips", of: "q", from: 3, to: 4, count: 2 } }] });
    expect(r.document.objects.filter((o) => o.kind === "polygon")).toHaveLength(2);
    expect(() => createGraph({ axes, objects: [{ id: "r", kind: "function", equation: { family: "reciprocal", k: 3 } }, { kind: "strips", of: "r", from: -1, to: 1, count: 2 }] })).toThrow();
  });
  it("draws trig graphs in degrees and warns when a curve misses the grid", () => {
    const e = createGraph({ axes: trigAxes, objects: [{ kind: "function", equation: { family: "trig", fn: "tan" } }] });
    expect(renderDiagramSvg(documentFromEnvelope(e), "pupil").match(/class="graph-function"[^>]* d="([^"]*)"/)![1].split("M").length - 1).toBe(3);
    const off = createGraph({ axes, objects: [{ kind: "function", equation: { family: "polynomial", a: 1, c: 50 } }] });
    expect(graphWarnings(off).some((w) => w.includes("outside the visible grid"))).toBe(true);
  });
  it("reaches the grid edge on a steep branch, refuses strips across an asymptote and prints fractions", () => {
    const big = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
    const runs = functionRuns({ id: "f", kind: "function", equation: { family: "reciprocal", k: 1, c: 0 } }, big);
    expect(Math.max(...runs.flat().map((p) => p.y))).toBeGreaterThan(10);
    expect(() => createGraph({ axes, objects: [{ id: "r", kind: "function", equation: { family: "reciprocal", k: 1, c: 5 } }, { kind: "strips", of: "r", from: -2, to: 2, count: 3 }] })).toThrow(/asymptote/);
    expect(formatFunction({ family: "polynomial", a: 1 / 3, b: -0.5, c: 0 })).toBe("y = 1/3x² − 1/2x");
    expect(() => createGraph({ objects: [{ kind: "function", equation: { family: "polynomial", b: 2, c: 1 } }] })).toThrow(/straight line/);
  });
  it("legacy validation refuses an unknown family without throwing", () => {
    const e = createGraph({ objects: [{ kind: "function", equation: { family: "polynomial", a: 1 } }] });
    for (const family of ["constructor", "toString", "__proto__"]) {
      const bad = structuredClone(e.document) as unknown as { objects: { equation: Record<string, unknown> }[] };
      bad.objects[0].equation = { family, a: 1 };
      expect(isDiagramDocument(bad)).toBe(false);
    }
  });
});
