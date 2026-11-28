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
      answer = c.renderSvg(e, "answer");
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
        expect(c.exportIssue(e, "answer"), x.id).toBeNull();
        expect(await c.hash(e)).toMatch(/^[0-9a-f]{64}$/);
      }
    expect(c.editorLink(c.create(), "https://mathsdock.co.uk/")).toMatch(/^https:\/\/mathsdock\.co\.uk\/tools\/construction#construction=/);
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

describe("drawing details Tim checked", () => {
  it("runs a bisector on to meet a named segment", () => {
    const e0 = c.blank(12, 8);
    e0.document.points.push(c.newPoint("A", 1, 1), c.newPoint("B", 11, 1), c.newPoint("D", 1, 7), c.newPoint("C", 11, 7));
    e0.document.objects.push(c.segment("DC", "D", "C"));
    const e = c.angleBisector(c.validate(e0), { at: "A", from: "B", to: "D", reach: "DC" });
    const line = e.document.objects.find((o) => o.id === "ab1-line") as Extract<c.Obj, { type: "segment" }>;
    const z = c.pointById(e.document, "ab1-z")!,
      a = c.pointById(e.document, "A")!;
    const l = Math.hypot(z.x - a.x, z.y - a.y) + line.extend[1];
    expect(a.y + (l * (z.y - a.y)) / Math.hypot(z.x - a.x, z.y - a.y)).toBeCloseTo(7, 2);
    const f = c.perpendicularBisector(c.validate(e0), { a: "A", b: "B", reach: "DC" });
    const pb = f.document.objects.find((o) => o.id === "pb1-line") as Extract<c.Obj, { type: "segment" }>;
    const top = Math.max(c.pointById(f.document, "pb1-p")!.y + pb.extend[0], c.pointById(f.document, "pb1-q")!.y + pb.extend[1]);
    expect(top).toBeCloseTo(7, 2);
  });

  it("starts the north line's arrowhead past the end of the line", () => {
    const e = c.blank(6, 6);
    e.document.points.push(c.newPoint("P", 3, 1));
    e.document.objects.push({ id: "n", type: "north", at: "P", length: 4, role: "given" });
    const g = c.layout(c.validate(e));
    const shaft = g.paths.find((p) => !p.fill && /^M[\d.]+ [\d.]+L/.test(p.d))!;
    const head = g.paths.find((p) => p.fill)!;
    const shaftTop = Number(shaft.d.split(/[ L]/)[3]);
    const tip = Number(head.d.slice(1).split(/[ L]/)[1]);
    expect(shaftTop - tip).toBeGreaterThan(2); // the line stops inside the head, well short of its tip
  });
});

describe("review fixes", () => {
  it("prints the pupil and answer copies at one size with the frame in one place", () => {
    for (const x of examples) {
      const e = x.make(false);
      const p = c.layout(e),
        a = c.layout(e, "answer");
      expect([p.width, p.height, p.dx, p.dy], x.id).toEqual([a.width, a.height, a.dx, a.dy]);
    }
  });

  it("keeps both copies aligned when a revealed line moves a given label", () => {
    const e = c.blank(8, 6);
    e.document.points.push(c.newPoint("A", 0, 6), c.newPoint("B", 0.2, 6.2, "", { mark: "none", role: "answer" }));
    e.document.objects.push({ ...c.segment("AB", "A", "B"), role: "answer" });
    const v = c.validate(e);
    const p = c.layout(v),
      a = c.layout(v, "answer");
    expect([p.width, p.height, p.dx, p.dy]).toEqual([a.width, a.height, a.dx, a.dy]);
  });

  it("draws a due-north bearing without an arc", () => {
    const e = c.blank(6, 8);
    e.document.points.push(c.newPoint("A", 3, 1), c.newPoint("B", 3, 6));
    e.document.objects.push({ id: "b", type: "bearing", from: "A", to: "B", northLine: true, label: c.label("000°"), role: "given" });
    expect(c.renderSvg(c.validate(e))).not.toMatch(/NaN/);
  });

  it("never draws something on the pupil copy from a hidden answer", () => {
    const e = c.pointByBearing(twoPoints(), { id: "C", from: "A", bearing: 45, distance: 3, role: "answer" });
    e.document.objects.push(c.segment("AC", "A", "C"));
    expect(() => c.validate(e)).toThrow(/drawn from C, which is an answer/);
    const f = c.pointByBearing(twoPoints(), { id: "C", from: "A", bearing: 45, distance: 3 });
    f.document.objects.push(c.segment("AC", "A", "C"));
    const hidden = c.setRole(c.validate(f), ["C"], "answer");
    expect(hidden.document.objects.find((o) => o.id === "AC")?.role).toBe("answer");
    expect(c.setRole(hidden, ["AC"], "given").document.points.find((p) => p.id === "C")?.role).toBe("given");
  });

  it("refuses group names too long for their parts' IDs", () => {
    expect(() => c.perpendicularBisector(twoPoints(), { a: "A", b: "B", group: "bisectorAB12" })).toThrow(/1 to 9/);
    expect(() => c.locusFromPoint(twoPoints(), { point: "A", distance: 2, group: "abcdefghi" })).not.toThrow();
  });
});

describe("left-out labels", () => {
  it("keep a label's text but print it on neither copy", () => {
    const e = c.create();
    e.document.points[0].label.show = "omit";
    const v = c.validate(e);
    expect(c.forView(v, "answer").document.points[0].label).toEqual({ text: "A", show: "omit" });
    for (const view of ["pupil", "answer"] as const) expect(c.renderSvg(v, view)).not.toMatch(/>A</);
    expect(c.renderSvg(v, "pupil")).toMatch(/>B</);
  });
});

describe("loci round a shape, either-or shading and bearings angles (GM8.06, GM8.07, GM8.11, GM8.13)", () => {
  const rectangle = () => {
    const e = c.blank(12, 9);
    e.document.points.push(c.newPoint("P", 4, 3), c.newPoint("Q", 8, 3), c.newPoint("R", 8, 5), c.newPoint("S", 4, 5));
    e.document.objects.push({ id: "pond", type: "polygon", points: ["P", "Q", "R", "S"], dash: false, role: "given" });
    return c.validate(e);
  };
  const lShape = (clockwise = false) => {
    const e = c.blank(16, 14);
    const corners: [string, number, number][] = [["A", 3, 3], ["B", 11, 3], ["C", 11, 6], ["D", 7, 6], ["E", 7, 10], ["F", 3, 10]];
    if (clockwise) corners.reverse();
    for (const [k, x, y] of corners) e.document.points.push(c.newPoint(k, x, y));
    e.document.objects.push({ id: "yard", type: "polygon", points: corners.map((x) => x[0]), dash: false, role: "given" });
    return c.validate(e);
  };
  const piecesOf = (e: c.Envelope, group: string) => {
    const d = e.document;
    return {
      segments: d.objects.filter((o): o is Extract<c.Obj, { type: "segment" }> => o.type === "segment" && o.group === group),
      arcs: d.objects.filter((o): o is Extract<c.Obj, { type: "arc" }> => o.type === "arc" && o.group === group),
    };
  };
  /** Every sampled point of the locus is exactly the distance from the shape's outline. */
  const exactly = (e: c.Envelope, group: string, shape: string, k: number) => {
    const d = e.document;
    const poly = (c.objectById(d, shape) as Extract<c.Obj, { type: "polygon" }>).points.map((x) => at(e, x));
    const { segments, arcs } = piecesOf(e, group);
    for (const s of segments)
      for (const t of [0, 0.3, 0.7, 1]) {
        const a = at(e, s.from),
          b = at(e, s.to);
        expect(c.distanceToOutline({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, poly)).toBeCloseTo(k, 2);
      }
    for (const a of arcs)
      for (const t of [0, 0.5, 1]) {
        const ce = at(e, a.center),
          ang = ((a.start + a.sweep * t) * Math.PI) / 180;
        expect(c.distanceToOutline({ x: ce.x + k * Math.cos(ang), y: ce.y + k * Math.sin(ang) }, poly)).toBeCloseTo(k, 2);
      }
  };

  it("draws the locus outside a rectangle as four parallel lines and four quarter-circle arcs", () => {
    const e = c.locusFromPolygon(rectangle(), { shape: "pond", distance: 1.5 });
    const { segments, arcs } = piecesOf(e, "lg1");
    expect(segments).toHaveLength(4);
    expect(arcs).toHaveLength(4);
    for (const a of arcs) expect(Math.abs(a.sweep)).toBeCloseTo(90, 6);
    exactly(e, "lg1", "pond", 1.5);
    // Saved as an answer, so the pupil copy shows only the pond.
    expect(e.document.objects.filter((o) => o.group === "lg1").every((o) => o.role === "answer")).toBe(true);
  });

  it("follows an L-shaped outline either way round: arcs at convex corners outside, a sharp corner at the reflex one", () => {
    for (const clockwise of [false, true]) {
      const e = c.locusFromPolygon(lShape(clockwise), { shape: "yard", distance: 1 });
      const { segments, arcs } = piecesOf(e, "lg1");
      expect(segments).toHaveLength(6);
      expect(arcs).toHaveLength(5);
      exactly(e, "lg1", "yard", 1);
      const inside = c.locusFromPolygon(lShape(clockwise), { shape: "yard", distance: 1, side: "inside" });
      expect(piecesOf(inside, "lg1").arcs).toHaveLength(1);
      exactly(inside, "lg1", "yard", 1);
    }
  });

  it("refuses a distance too large for the inside of the shape, naming the side", () => {
    expect(() => c.locusFromPolygon(rectangle(), { shape: "pond", distance: 1.2, side: "inside" })).toThrow(/too large/);
    expect(() => c.locusFromPolygon(rectangle(), { shape: "pond", distance: 0.8, side: "both" })).not.toThrow();
    expect(() => c.locusFromPolygon(rectangle(), { shape: "nope", distance: 1 })).toThrow(/not in the drawing/);
  });

  it("shades within a distance of the whole outline, and either of two conditions", () => {
    const e = rectangle();
    e.document.points.push(c.newPoint("T", 10.5, 7.5));
    e.document.objects.push({
      id: "r1",
      type: "region",
      rules: [
        { kind: "either", rules: [{ kind: "distance", from: "pond", distance: 1, side: "within" }, { kind: "distance", from: "T", distance: 1, side: "within" }] },
        { kind: "inside", shape: "pond", side: "beyond" },
      ],
      pattern: "hatch",
      role: "given",
    });
    const v = c.validate(e);
    const hatch = c.layout(v).paths.find((p) => p.width === 0.2)!;
    expect(hatch).toBeTruthy();
    // Hatching reaches round both the pond and the tree T: some strokes near T (x 105 mm), none inside the pond.
    const xs = [...hatch.d.matchAll(/[ML]([\d.-]+) ([\d.-]+)/g)].map((m) => [+m[1], +m[2]]);
    expect(xs.some(([x]) => x > 95)).toBe(true);
    expect(c.references(v.document.objects.find((o) => o.id === "r1")!)).toEqual(["pond", "T", "pond"]);
    // Removing the tree removes the region that measures from it.
    expect(c.remove(v, ["T"]).document.objects.some((o) => o.id === "r1")).toBe(false);
  });

  it("refuses a closer rule against a polygon and an either rule nested in itself", () => {
    const e = rectangle();
    e.document.objects.push({ id: "r1", type: "region", rules: [{ kind: "closer", to: "pond", than: "P" }], pattern: "hatch", role: "given" });
    expect(() => c.validate(e)).toThrow(/point or a segment/);
    const n = rectangle();
    (n.document.objects as unknown[]).push({ id: "r2", type: "region", rules: [{ kind: "either", rules: [{ kind: "either", rules: [] }, { kind: "inside", shape: "pond", side: "within" }] }], pattern: "hatch", role: "given" });
    expect(() => c.validate(n)).toThrow();
  });

  it("measures an angle from the north line at B, the co-interior angle in a bearings question", () => {
    const e = examples.find((x) => x.id === "bearings-parallel")!.make(false);
    expect(c.measureAngle(e, "angleB").document.objects.find((o) => o.id === "angleB")).toMatchObject({ label: { text: "120°" } });
    // The arm must be a north line at the vertex itself.
    const wrong = structuredClone(e);
    (wrong.document.objects.find((o) => o.id === "angleB") as Extract<c.Obj, { type: "angle" }>).from = "northA";
    expect(() => c.validate(wrong)).toThrow(/not at the vertex/);
    // Removing the north line removes the angle drawn from it.
    expect(c.remove(e, ["northB"]).document.objects.some((o) => o.id === "angleB")).toBe(false);
  });

  it("prints Diagram NOT accurately drawn only when asked, and saves only true", () => {
    const e = examples.find((x) => x.id === "bearings-parallel")!.make(false);
    expect(c.renderSvg(e)).toContain(c.NOT_ACCURATE);
    expect(c.renderSvg(twoPoints())).not.toContain(c.NOT_ACCURATE);
    const off = structuredClone(e);
    (off.document as { notAccurate?: boolean }).notAccurate = false;
    expect("notAccurate" in c.validate(off).document && c.validate(off).document.notAccurate).toBeFalsy();
    expect(c.canonical(c.validate(off))).not.toContain("notAccurate");
    // The note sits under the drawing area, inside the printed width.
    const g = c.layout(e);
    expect(g.note!.y).toBeGreaterThan(g.frame.y + g.frame.height);
    expect(g.note!.x + g.note!.width / 2).toBeLessThanOrEqual(g.width);
  });
});
