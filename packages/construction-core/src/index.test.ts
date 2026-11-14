import { describe, expect, it } from "vitest";
import * as c from "./index";
import { examples } from "./examples";

const twoPoints = () => {
  const e = c.blank(12, 8);
  e.document.points.push(c.newPoint("A", 2, 3), c.newPoint("B", 9, 3));
  e.document.objects.push(c.segment("AB", "A", "B"));
  return c.validate(e);
};
const at = (e: c.Envelope, id: string) => c.pointById(e.document, id)!;
const svgSize = (svg: string) => {
  const m = svg.match(/width="([\d.]+)mm" height="([\d.]+)mm" viewBox="0 0 ([\d.]+) ([\d.]+)"/)!;
  return { width: +m[1], height: +m[2], vw: +m[3], vh: +m[4] };
};

describe("construction drawings", () => {
  it("print at true size: one document centimetre is ten SVG millimetres", () => {
    const e = twoPoints();
    const svg = c.renderSvg(e);
    const s = svgSize(svg);
    expect(s.width).toBe(s.vw);
    expect(s.height).toBe(s.vh);
    // The 12 x 8 cm drawing area is always kept, with a small margin.
    expect(s.width).toBeGreaterThanOrEqual(120);
    expect(s.height).toBeGreaterThanOrEqual(80);
    const g = c.layout(e);
    const line = g.paths.find((p) => /^M[\d.]+ [\d.]+L[\d.]+ [\d.]+$/.test(p.d))!;
    const [x1, , x2] = line.d.slice(1).split(/[ L]/).map(Number);
    expect(x2 - x1).toBeCloseTo(70, 6); // AB = 7 cm prints as 70 mm
  });

  it("keeps answers out of the pupil copy and prints them on the answer copy", () => {
    const e = c.create();
    expect(c.hasHidden(e)).toBe(true);
    const pupil = c.renderSvg(e),
      answer = c.renderSvg(c.forView(e, "answer"));
    expect(pupil.match(/<path/g)!.length).toBeLessThan(answer.match(/<path/g)!.length);
    // forView never changes the saved document.
    expect(e.document.objects.some((o) => o.role === "answer")).toBe(true);
  });

  it("constructs the perpendicular bisector through the midpoint at right angles", () => {
    const e = c.perpendicularBisector(twoPoints(), { a: "A", b: "B" });
    const p = at(e, "pb1-p"),
      q = at(e, "pb1-q");
    expect((p.x + q.x) / 2).toBeCloseTo(5.5, 2);
    expect(p.x).toBeCloseTo(q.x, 2);
    expect(e.document.objects.filter((o) => o.group === "pb1" && o.type === "arc")).toHaveLength(4);
    expect(e.document.objects.every((o) => o.group !== "pb1" || o.role === "answer")).toBe(true);
    expect(() => c.perpendicularBisector(twoPoints(), { a: "A", b: "B", radius: 3 })).toThrow(/more than half/);
  });

  it("bisects an angle into two equal angles", () => {
    const e0 = c.blank(12, 8);
    e0.document.points.push(c.newPoint("V", 1, 1), c.newPoint("P", 10, 1), c.newPoint("Q", 1 + 6 * Math.cos(1), 1 + 6 * Math.sin(1)));
    const e = c.angleBisector(c.validate(e0), { at: "V", from: "P", to: "Q" });
    const z = at(e, "ab1-z");
    expect(c.angleOf(at(e, "V"), z)).toBeCloseTo((1 * 180) / Math.PI / 2, 1);
  });

  it("drops a perpendicular from a point to a line and raises one at a point", () => {
    const e0 = twoPoints();
    e0.document.points.push(c.newPoint("P", 4, 6), c.newPoint("M", 5, 3));
    let e = c.perpendicularFromPoint(c.validate(e0), { point: "P", a: "A", b: "B" });
    const z = at(e, "pf1-z");
    expect(z.x).toBeCloseTo(4, 3);
    expect(z.y).toBeCloseTo(0, 3);
    e = c.perpendicularAtPoint(e, { point: "M", a: "A", b: "B" });
    const z2 = at(e, "pa1-z");
    expect(z2.x).toBeCloseTo(5, 3);
    expect(z2.y).toBeGreaterThan(3);
    expect(() => c.perpendicularAtPoint(e, { point: "P", a: "A", b: "B" })).toThrow(/from the line/);
  });

  it("draws loci around a point and a segment", () => {
    let e = c.locusFromPoint(twoPoints(), { point: "A", distance: 1.5 });
    e = c.locusFromSegment(e, { a: "A", b: "B", distance: 2 });
    const sides = e.document.objects.filter((o) => o.group === "ls1" && o.type === "segment");
    expect(sides).toHaveLength(2);
    expect(at(e, "ls1-a1").y).toBeCloseTo(5, 6);
    expect(at(e, "ls1-a2").y).toBeCloseTo(1, 6);
  });

  it("places points by bearing and measures bearings, angles and lengths only when asked", () => {
    let e = c.pointByBearing(twoPoints(), { id: "Q", from: "A", bearing: 90, distance: 4 });
    expect(at(e, "Q").x).toBeCloseTo(6, 6);
    expect(at(e, "Q").y).toBeCloseTo(3, 6);
    e = c.pointByBearing(e, { id: "R", from: "A", bearing: 315, distance: 2 });
    e.document.objects.push({ id: "bAR", type: "bearing", from: "A", to: "R", northLine: true, label: c.label(""), role: "given" });
    expect(c.validate(e).document.objects.find((o) => o.id === "bAR")).toMatchObject({ label: { text: "" } });
    e = c.measureBearing(c.validate(e), "bAR");
    expect(e.document.objects.find((o) => o.id === "bAR")).toMatchObject({ label: { text: "315°" } });
    expect(c.formatBearing(c.bearingOf({ x: 0, y: 0 }, { x: 1, y: 1 }))).toBe("045°");
    e = c.measureSegment(e, "AB", { cm: 1, per: 4, unit: "km" });
    expect(e.document.objects.find((o) => o.id === "AB")).toMatchObject({ label: { text: "28 km" } });
  });

  it("hatches only where every region rule holds", () => {
    const e0 = twoPoints();
    e0.document.objects.push({ id: "r", type: "region", rules: [{ kind: "distance", from: "A", distance: 2, side: "within" }, { kind: "closer", to: "B", than: "A" }], pattern: "hatch", role: "given" });
    expect(c.layout(c.validate(e0)).paths.some((p) => p.width === 0.2)).toBe(false); // nothing is within 2 cm of A and closer to B
    const e1 = twoPoints();
    e1.document.objects.push({ id: "r", type: "region", rules: [{ kind: "distance", from: "AB", distance: 1, side: "within" }], pattern: "cross", role: "given" });
    const hatch = c.layout(c.validate(e1)).paths.find((p) => p.width === 0.2)!;
    // Every hatch end lies inside the drawing and within 1 cm of AB (allowing for the 0.25 mm sampling).
    const g = c.layout(c.validate(e1));
    for (const [x, y] of [...hatch.d.matchAll(/[ML]([\d.-]+) ([\d.-]+)/g)].map((m) => [+m[1], +m[2]])) {
      const doc = { x: x / 10, y: (80 - y) / 10 };
      expect(c.distanceToSegment(doc, { x: 2, y: 3 }, { x: 9, y: 3 })).toBeLessThan(1.02);
    }
    expect(g.issues).toEqual([]);
  });

  it("removes dependants with a point, and whole groups", () => {
    let e = c.perpendicularBisector(twoPoints(), { a: "A", b: "B" });
    expect(c.removeGroup(e, "pb1").document.objects.map((o) => o.id)).toEqual(["AB"]);
    e = c.remove(e, ["A"]);
    expect(e.document.objects.some((o) => o.id === "AB" || o.group === "pb1" && o.type === "arc" && (o as { center: string }).center === "A")).toBe(false);
  });

  it("refuses broken references and reports points outside the drawing", () => {
    const e = twoPoints();
    e.document.objects.push(c.segment("AC", "A", "C"));
    expect(() => c.validate(e)).toThrow(/point C/);
    const f = twoPoints();
    f.document.points.push(c.newPoint("Z", 13, 2));
    expect(c.exportIssue(c.validate(f))).toMatch(/outside/);
  });

  it("round-trips files and links, and keeps every example valid on both copies", async () => {
    for (const x of examples)
      for (const worked of [false, true]) {
        const e = x.make(worked);
        expect(c.parseFile(JSON.stringify(e))).toEqual(e);
        expect(c.decodeLinkHash(c.linkHash(e))).toEqual(e);
        expect(c.exportIssue(e), x.id).toBeNull();
        expect(c.exportIssue(c.forView(e, "answer")), x.id).toBeNull();
        expect(await c.hash(e)).toMatch(/^[0-9a-f]{64}$/);
      }
    expect(c.editorLink(c.create(), "https://mathsdock.co.uk/")).toBeNull(); // no editor until it is released
  });

  it("answers the source questions correctly", () => {
    const port = examples.find((x) => x.id === "bearings-port")!.make(true);
    const P = at(port, "P"),
      Q = at(port, "Q");
    expect(Math.hypot(Q.x - P.x, Q.y - P.y)).toBeCloseTo(4.5, 2); // 18 km at 1 cm to 4 km
    expect(c.bearingOf(P, Q)).toBeCloseTo(70, 1);
    const map = examples.find((x) => x.id === "map-equidistant")!.make(true);
    // The 2.5 cm circle about A meets the perpendicular bisector of BC, so T exists.
    const A = at(map, "A"),
      p = at(map, "pb1-p"),
      q = at(map, "pb1-q");
    const u = { x: q.x - p.x, y: q.y - p.y },
      l = Math.hypot(u.x, u.y);
    const dLine = Math.abs((A.x - p.x) * u.y - (A.y - p.y) * u.x) / l;
    expect(dLine).toBeLessThan(2.5);
  });
});
