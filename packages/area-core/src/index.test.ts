import { describe, expect, it } from "vitest";
import * as core from "./index";
import * as io from "./interchange";
import { examples } from "./examples";

const lShape = () => core.starter("l-shape");

describe("area and perimeter diagrams", () => {
  it("draws every preset and example without a label issue, on both copies", () => {
    for (const p of core.PRESETS) {
      const e = core.starter(p);
      expect(core.layout(e).issues, p).toEqual([]);
      expect(core.renderSvg(e)).toContain("Diagram NOT accurately drawn");
    }
    for (const x of examples) {
      for (const worked of [false, true]) {
        const e = x.make(worked);
        expect(core.layout(e).issues, x.id).toEqual([]);
        expect(core.layout(e).notes, x.id).toEqual([]);
      }
    }
  });

  it("prints saved answers only on the answers copy, in the answer colour", () => {
    const e = examples.find((x) => x.id === "circle")!.make(true);
    const pupil = core.renderSvg(e, "pupil"),
      answer = core.renderSvg(e, "answer");
    expect(pupil).not.toContain(core.ANSWER_COLOUR);
    expect(pupil).not.toContain("36π");
    expect(answer).toContain(core.ANSWER_COLOUR);
    expect(answer).toContain("36π");
    // Both copies share one layout, so they print at one size.
    expect(pupil.match(/width="[\d.]+mm"/)![0]).toBe(answer.match(/width="[\d.]+mm"/)![0]);
  });

  it("keeps blank, hidden and answer-line labels distinct", () => {
    const e = lShape();
    e.document.labels = [core.label("e3"), core.label("e4", "", "hidden", "5 cm"), core.label("area", "", "answer-line")];
    const v = core.validate(e);
    const pupil = core.renderSvg(v);
    expect(pupil).toContain("______");
    expect(pupil).not.toContain("5 cm<");
    expect(core.renderSvg(v, "answer")).toContain("5 cm");
    expect(() => core.validate({ ...v, document: { ...v.document, labels: [core.label("e1", "8 cm", "value", "8 cm")] } })).toThrow("cannot hold a saved answer");
  });

  it("warns about rectilinear lengths that cannot fit, without changing them", () => {
    const e = lShape();
    e.document.labels = [core.label("e1", "12 cm"), core.label("e3", "7 cm"), core.label("e5", "8 cm")];
    expect(core.layout(e).notes.join(" ")).toContain("do not match");
    expect(e.document.labels.map((l) => l.text)).toEqual(["12 cm", "7 cm", "8 cm"]);
    e.document.labels = [core.label("e1", "4 cm"), core.label("e5", "6 cm")];
    expect(core.layout(e).notes.join(" ")).toContain("cannot fit");
    const c = core.starter("circle");
    c.document.shape = { ...c.document.shape, line: "diameter" } as core.Shape;
    c.document.labels = [core.label("d", "10 cm"), core.label("area", "", "hidden", "")];
    expect(core.layout(core.validate(c)).notes).toEqual([]);
  });

  it("refuses outlines that cross, run clockwise or put the hole outside", () => {
    const e = core.blank("rectangle");
    const poly = e.document.shape as core.Polygon;
    expect(() => core.validate({ ...e, document: { ...e.document, shape: { ...poly, corners: [...poly.corners].reverse() } } })).toThrow("anticlockwise");
    expect(() => core.validate({ ...e, document: { ...e.document, shape: { ...poly, corners: [poly.corners[0], poly.corners[2], poly.corners[1], poly.corners[3]] } } })).toThrow("cross");
    expect(() => core.validate({ ...e, document: { ...e.document, hole: { type: "circle", x: 55, y: 10, r: 10 } } })).toThrow("inside the shape");
    expect(() => core.validate({ ...e, document: { ...e.document, shaded: "hole" } })).toThrow("no hole");
  });

  it("draws semicircles added outside and cut inside the outline", () => {
    const added = core.layout(core.starter("rectangle-semicircle"));
    const xs = added.geometry.outline.map((p) => p.x);
    expect(Math.max(...xs)).toBeCloseTo(50 + 17, 1);
    const cut = core.layout(core.starter("rectangle-cut"));
    const ys = cut.geometry.outline.map((p) => p.y);
    expect(Math.max(...ys)).toBeCloseTo(40, 6);
    expect(Math.min(...ys.filter((y) => y > 0))).toBeCloseTo(40 - 16, 1);
  });

  it("prints fractions stacked, units upright and letters italic", () => {
    expect(core.runs("1/2 × 8 cm")).toEqual([{ top: "1", bottom: "2" }, { text: " × 8 cm", italic: false }]);
    expect(core.runs("2x + 1")).toEqual([{ text: "2", italic: false }, { text: "x", italic: true }, { text: " + 1", italic: false }]);
    expect(core.runs("5 m")).toEqual([{ text: "5 m", italic: false }]);
    expect(core.runs("25pi cm^2")).toEqual([{ text: "25π cm²", italic: false }]);
  });

  it("keeps a grid at true 1 cm squares lined up with the corners", () => {
    const e = examples.find((x) => x.id === "grid")!.make(false);
    const g = core.layout(e);
    expect(g.grid).not.toBeNull();
    expect((g.grid!.maxX - g.grid!.minX) % core.GRID_MM).toBe(0);
    expect(core.renderSvg(e)).toContain('stroke="#a6a6a6"');
  });

  it("round-trips files and links", () => {
    for (const x of examples) {
      const e = x.make(true);
      expect(core.canonical(core.parseFile(core.canonical(e)))).toBe(core.canonical(e));
      expect(core.canonical(core.decodeLinkHash(core.linkHash(e)))).toBe(core.canonical(e));
    }
    expect(core.editorLink(lShape(), "https://mathsdock.co.uk/tools/graph")).toMatch(/^https:\/\/mathsdock\.co\.uk\/tools\/area#area=/);
  });

  it("keeps labels on their sides when the shape is stretched, and drops the ones a new shape lacks", () => {
    const e = lShape();
    const wide = core.validate({ ...e, document: core.stretch(e.document, 1.5, 1) });
    expect(wide.document.labels).toEqual(e.document.labels);
    expect(core.extent(wide.document.shape as core.Polygon).width).toBeCloseTo(90, 6);
    const n = structuredClone(e);
    Object.assign(n.document, core.presetShape("rectangle"));
    expect(core.prune(n).document.labels.map((l) => l.id)).toEqual(["e1", "e2", "e3"]);
  });
});

describe("area and perimeter connector adapter", () => {
  it("builds a rectilinear shape from outline moves and checks it closes", () => {
    const e = io.create({
      spec: {
        shape: { type: "polygon", outline: [{ dir: "right", length: 60 }, { dir: "up", length: 20 }, { dir: "left", length: 30 }, { dir: "up", length: 20 }, { dir: "left", length: 30 }, { dir: "down", length: 40 }] },
        labels: [{ id: "e1", text: "12 cm" }, { id: "e3", text: "x" }, { id: "area", answer: "48 cm²" }],
      },
    });
    const d = e.document;
    expect((d.shape as core.Polygon).corners).toHaveLength(6);
    expect(d.labels.map((l) => [l.id, l.state])).toEqual([
      ["e1", "value"],
      ["e3", "symbol"],
      ["area", "hidden"],
    ]);
    expect(() => io.create({ spec: { shape: { type: "polygon", outline: [{ dir: "right", length: 60 }, { dir: "up", length: 20 }, { dir: "left", length: 50 }] } } })).toThrow("does not close");
  });

  it("revises atomically and refuses to drop labels unless asked", async () => {
    const e = io.create({ spec: { example: "l-shape", worked: true } });
    const baseHash = await core.hash(e);
    await expect(io.revise({ envelope: e, baseHash, operations: [{ op: "set_shape", preset: "circle" }] })).rejects.toThrow("dropMissing");
    const r = await io.revise({ envelope: e, baseHash, operations: [{ op: "set_shape", preset: "circle", dropMissing: true }, { op: "set_label", label: { id: "r", text: "5 cm" } }] });
    expect(r.document.shape.type).toBe("circle");
    expect(r.document.labels.map((l) => l.id)).toEqual(["area", "r"]);
    await expect(io.revise({ envelope: e, baseHash: "0".repeat(64), operations: [] })).rejects.toThrow("stale_hash");
    const shaded = await io.revise({ envelope: e, baseHash, operations: [{ op: "set_settings", settings: { shaded: "shape", fontPt: 11 } }] });
    expect(shaded.document.shaded).toBe("shape");
    expect(shaded.document.fontPt).toBeUndefined();
  });

  it("keeps an existing label's state when only its answer or text changes", async () => {
    const e = io.create({ spec: { preset: "l-shape", labels: [{ id: "e3", state: "answer-line" }] } });
    const r = await io.revise({ envelope: e, baseHash: await core.hash(e), operations: [{ op: "set_label", label: { id: "e3", answer: "7 cm" } }] });
    expect(r.document.labels[0]).toEqual({ id: "e3", state: "answer-line", text: "", answer: "7 cm" });
  });

  it("keeps outline shapes on the centimetre grid", () => {
    const e = io.create({ spec: { shape: { type: "polygon", outline: [{ dir: "right", length: 25 }, { dir: "up", length: 20 }, { dir: "left", length: 25 }, { dir: "down", length: 20 }] }, settings: { grid: true } } });
    expect(core.layout(e).notes).toEqual([]);
  });
});

describe("review fixes", () => {
  it("refuses a semicircle side that crosses another side", () => {
    const e = core.starter("rectangle-cut");
    expect(() => core.validate({ ...e, document: core.stretch(e.document, 1, 0.25) })).toThrow("crosses another side");
  });
  it("prints a letter at the centre angle with a degree sign, and short algebra italic", () => {
    expect(core.printed(core.label("angle", "x", "symbol"), "pupil").text).toBe("x°");
    expect(core.runs("ab cm")).toEqual([{ text: "ab", italic: true }, { text: " cm", italic: false }]);
    expect(core.runs("Area")).toEqual([{ text: "Area", italic: false }]);
  });
});

