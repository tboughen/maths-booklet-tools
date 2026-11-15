import { describe, expect, it } from "vitest";
import * as c from "./index";
import * as io from "./interchange";
import { examples } from "./examples";

const ex = (id: string, worked = false) => examples.find((x) => x.id === id)!.make(worked);
const texts = (svg: string) => [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map((m) => m[1].replace(/<[^>]+>/g, ""));

describe("angle diagrams", () => {
  it("makes the angles of each figure, in a fixed order", () => {
    const ids = (figure: c.Figure) => c.slotsOf(c.blank(figure).document).map((s) => [s.id, Math.round(s.sweep)]);
    expect(ids({ type: "straight-line", rays: [115, 48] })).toEqual([["s1", 48], ["s2", 67], ["s3", 65]]);
    expect(ids({ type: "point", rays: [10, 105, 200, 285] })).toEqual([["s1", 95], ["s2", 95], ["s3", 85], ["s4", 85]]);
    expect(ids({ type: "crossing", lines: [20, 75] })).toEqual([["s1", 55], ["s2", 125], ["s3", 55], ["s4", 125]]);
    const parallel = ids({ type: "parallel", count: 2, gapMm: 24, crossDeg: 60, arrows: 1 });
    expect(parallel).toEqual([["p1-ur", 60], ["p1-ul", 120], ["p1-ll", 60], ["p1-lr", 120], ["p2-ur", 60], ["p2-ul", 120], ["p2-ll", 60], ["p2-lr", 120]]);
    const hexagon = ids({ type: "polygon", sides: 6, corners: null, exterior: [2], diagonals: false, ticks: [1, 1, 1, 1, 1, 1] });
    expect(hexagon.filter(([id]) => String(id).startsWith("i")).every(([, s]) => s === 120)).toBe(true);
    expect(hexagon).toContainEqual(["e2", 60]);
  });

  it("prints sizes with degree signs, letters as typed and stacked algebra in brackets", () => {
    expect(c.degrees("62")).toBe("62°");
    expect(c.degrees("3x")).toBe("3x°");
    expect(c.degrees("2x + 10")).toBe("(2x + 10)°");
    expect(c.degrees("x - 5")).toBe("(x - 5)°");
    expect(c.degrees("45°")).toBe("45°");
    const svg = c.renderSvg(ex("algebra-line"));
    expect(texts(svg)).toContain("(3x + 5)°");
    expect(svg).toMatch(/<tspan font-style="italic">x<\/tspan>/);
  });

  it("keeps blank, answer-line, hidden and zero distinct, and shows saved answers only on the answers copy", () => {
    const e = c.blank({ type: "point", rays: [0, 90, 180, 270] });
    e.document.angles = [
      c.angle("s1", c.label("0", "value")),
      c.angle("s2", c.label("", "blank", "90")),
      c.angle("s3", c.label("", "answer-line")),
      c.angle("s4", c.label("", "hidden", "90")),
    ];
    const v = c.validate(e);
    const pupil = texts(c.renderSvg(v, "pupil")),
      answer = texts(c.renderSvg(v, "answer"));
    expect(pupil).toContain("0°");
    expect(pupil.filter((t) => t === "90°")).toHaveLength(0);
    expect(pupil).toContain("______°");
    expect(answer.filter((t) => t === "90°")).toHaveLength(2);
    expect(c.renderSvg(v, "pupil")).not.toContain(c.ANSWER_COLOUR);
    expect(c.renderSvg(v, "answer")).toContain(c.ANSWER_COLOUR);
  });

  it("gives both copies one size", () => {
    for (const x of examples) {
      const e = x.make(true);
      const size = (svg: string) => svg.match(/width="([\d.]+)mm" height="([\d.]+)mm"/)!.slice(1);
      expect(size(c.renderSvg(e, "pupil"))).toEqual(size(c.renderSvg(e, "answer")));
    }
  });

  it("draws every example without overlaps or print problems, at 11 pt or more", () => {
    for (const x of examples)
      for (const worked of [false, true]) {
        const e = x.make(worked);
        expect(c.layout(e).issues, x.id).toEqual([]);
        expect(c.warnings(e), x.id).toEqual([]);
        // Labels print at 11 pt; "Diagram NOT accurately drawn" at the 10 pt house minimum, as small as papers print it.
        const svg = c.renderSvg(e);
        const sizes = [...svg.matchAll(/<text\b[^>]*font-size="([\d.]+)"[^>]*>([^<]*)/g)].map((m) => ({ pt: (Number(m[1]) * 72) / 25.4, caption: m[2].startsWith("Diagram NOT") }));
        expect(Math.min(...sizes.filter((s) => !s.caption).map((s) => s.pt))).toBeGreaterThanOrEqual(10.99);
        expect(Math.min(...sizes.map((s) => s.pt))).toBeGreaterThanOrEqual(9.99);
      }
  });

  it("never prints a saved answer or its colour on a pupil copy, nor in the alt text", () => {
    for (const x of examples) {
      const e = x.make(true),
        svg = c.renderSvg(e, "pupil");
      expect(svg).not.toContain(c.ANSWER_COLOUR);
      // The same printed text as the file with no answers saved (positions may differ: one layout fits both copies).
      expect(texts(svg), x.id).toEqual(texts(c.renderSvg(x.make(false), "pupil")));
      expect(svg.match(/aria-label="[^"]*"/)![0]).toBe(c.renderSvg(x.make(false)).match(/aria-label="[^"]*"/)![0]);
    }
  });

  it("raises teacher notes for sizes that cannot all be right, and stays quiet otherwise", () => {
    const line = c.blank({ type: "straight-line", rays: [60] });
    line.document.angles = [c.angle("s1", c.label("60")), c.angle("s2", c.label("100"))];
    expect(c.sizeNotes(c.validate(line).document)).toEqual(["The angles on the straight line add to 160°, not 180°."]);
    const cross = c.blank({ type: "crossing", lines: [20, 75] });
    cross.document.angles = [c.angle("s1", c.label("55")), c.angle("s3", c.label("60"))];
    expect(c.sizeNotes(c.validate(cross).document).join(" ")).toContain("should be equal");
    const parallel = c.blank({ type: "parallel", count: 2, gapMm: 24, crossDeg: 60, arrows: 1 });
    parallel.document.angles = [c.angle("p1-ur", c.label("60")), c.angle("p2-ur", c.label("65"))];
    expect(c.sizeNotes(c.validate(parallel).document).join(" ")).toContain("Corresponding angles");
    // Algebra and letters are never checked: nothing is calculated.
    expect(c.sizeNotes(ex("algebra-line").document)).toEqual([]);
    expect(c.sizeNotes(ex("polygon-sum", true).document)).toEqual([]);
  });

  it("refuses unknown angles and points, crowded rays and concave polygons with a reason", () => {
    const e = c.blank({ type: "straight-line", rays: [60] });
    e.document.angles = [c.angle("s9")];
    expect(() => c.validate(e)).toThrow(/no angle s9/);
    const named = c.blank();
    named.document.names = [{ id: "v1", text: "A" }];
    expect(() => c.validate(named)).toThrow(/no point v1/);
    expect(() => c.validate(c.blank({ type: "point", rays: [10, 12, 200] }))).toThrow(/5 degrees apart/);
    const concave: c.Figure = { type: "polygon", sides: 4, corners: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 20 }], exterior: [], diagonals: false, ticks: [0, 0, 0, 0] };
    expect(() => c.validate(c.blank(concave))).toThrow(/convex/);
    const given = c.blank();
    given.document.angles = [c.angle("s1", c.label("", "value"))];
    expect(() => c.validate(given)).toThrow(/no text/);
  });

  it("round-trips files and links", () => {
    for (const x of examples) {
      const e = x.make(true);
      expect(c.canonical(c.parseFile(c.canonical(e)))).toBe(c.canonical(e));
      expect(c.canonical(c.decodeLinkHash(c.linkHash(e)))).toBe(c.canonical(e));
    }
    expect(c.editorLink(ex("parallel"), "https://mathsdock.co.uk/tools/graph")).toMatch(/^https:\/\/mathsdock\.co\.uk\/tools\/angles#angles=/);
  });

  it("keeps text size and bold lines as overrides that are not saved at their defaults", () => {
    const e = c.blank();
    e.document.fontPt = 11;
    (e.document as { lines?: string }).lines = "normal";
    const v = c.validate(e);
    expect("fontPt" in v.document && v.document.fontPt !== undefined).toBe(false);
    expect(v.document.lines).toBeUndefined();
    const bold = c.blank();
    bold.document.lines = "bold";
    expect(c.renderSvg(c.validate(bold))).toContain('stroke-width="0.6"');
  });
});

describe("angle diagram connector adapter", () => {
  it("creates from a spec with sensible label states", () => {
    const e = io.create({ spec: { figure: { type: "polygon", sides: 5, exterior: [3] }, angles: [{ id: "e3", text: "e" }, { id: "i1", text: "108" }, { id: "i2" }] } });
    expect(e.document.figure).toMatchObject({ type: "polygon", sides: 5, corners: null, exterior: [3], ticks: [1, 1, 1, 1, 1] });
    expect(e.document.angles.map((a) => a.label.state)).toEqual(["symbol", "value", "blank"]);
  });

  it("revises against the exact hash and keeps what it was not asked to change", async () => {
    const e = ex("parallel");
    const baseHash = await c.hash(e);
    const r = await io.revise({ envelope: e, baseHash, operations: [{ op: "set_angle", angle: { id: "p1-ur", shade: true } }, { op: "set_settings", settings: { fontPt: 12 } }] });
    expect(r.document.angles[0]).toMatchObject({ id: "p1-ur", shade: true, label: { state: "value", text: "58" } });
    expect(r.document.fontPt).toBe(12);
    await expect(io.revise({ envelope: e, baseHash: "0".repeat(64), operations: [] })).rejects.toThrow(/stale_hash/);
  });

  it("makes a worked example only when asked", () => {
    const pupil = io.create({ spec: { example: "parallel" } }),
      worked = io.create({ spec: { example: "parallel", worked: true } });
    expect(pupil.document.angles.every((a) => !a.label.answer)).toBe(true);
    expect(worked.document.angles.some((a) => a.label.answer)).toBe(true);
  });
});

describe("angle diagram review fixes", () => {
  it("keeps labels and point names with their rays when rays are added or removed", () => {
    const before = c.blank({ type: "straight-line", rays: [40, 120] });
    before.document.angles = [c.angle("s1", c.label("40")), c.angle("s2", c.label("x", "symbol")), c.angle("s3", c.label("60"))];
    before.document.names = [{ id: "r2", text: "C" }];
    const after = structuredClone(before);
    after.document.figure = { type: "straight-line", rays: [40, 90, 120] };
    const r = c.remapRays(before.document, after.document);
    expect(r.angles.map((a) => [a.id, a.label.text])).toEqual([["s1", "40"], ["s2", "x"], ["s4", "60"]]);
    expect(r.names).toEqual([{ id: "r3", text: "C" }]);
  });

  it("runs parallel lines past every crossing, however steep the transversal", () => {
    const e = c.blank({ type: "parallel", count: 3, gapMm: 24, crossDeg: 20, arrows: 1 });
    const g = c.geometry(c.validate(e).document);
    const line = g.segments[0];
    for (const k of [1, 2, 3]) expect(Math.abs(g.points[`x${k}`].at.x)).toBeLessThan(Math.max(line.a.x, line.b.x));
  });

  it("refuses a saved answer on a given size, and names corners out of range", () => {
    const e = c.blank();
    e.document.angles = [c.angle("s1", c.label("62", "value", "62"))];
    expect(() => c.validate(e)).toThrow(/cannot hold a saved answer/);
    const far: c.Figure = { type: "polygon", sides: 3, corners: [{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 0, y: 20 }], exterior: [], diagonals: false, ticks: [0, 0, 0] };
    expect(() => c.validate(c.blank(far))).toThrow(/200 mm/);
  });
});
