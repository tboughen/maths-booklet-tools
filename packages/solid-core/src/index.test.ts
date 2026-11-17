import { describe, expect, it } from "vitest";
import * as c from "./index";
import * as io from "./interchange";
import { examples } from "./examples";

const ex = (id: string) => examples.find((x) => x.id === id)!.make();
const texts = (svg: string) => [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map((m) => m[1].replace(/<[^>]+>/g, ""));
const joined = (svg: string) => texts(svg).join("");
/** The hidden straight edges as pairs of point IDs. */
function hiddenEdges(e: c.Envelope) {
  const g = c.geometry(e.document);
  const idAt = (p: c.P) => [...g.screen].find(([, q]) => Math.hypot(q.x - p.x, q.y - p.y) < 1e-6)?.[0];
  return g.pieces
    .filter((p) => p.hidden && p.pts.length === 2)
    .map((p) => [idAt(p.pts[0]), idAt(p.pts[1])].sort().join("-"))
    .sort();
}

describe("3D solids", () => {
  it("dashes the three hidden edges of a cuboid, meeting at the back corner out of sight", () => {
    // Oblique depth going up and right: the back bottom left corner is hidden.
    expect(hiddenEdges(c.create())).toEqual(["p1-pb1", "pb1-pb2", "pb1-pb4"]);
    // Depth going up and left hides the back bottom right corner instead.
    const e = c.create();
    e.document.view = { type: "oblique", angle: 150, scale: 0.5 };
    expect(hiddenEdges(c.validate(e))).toEqual(["p2-pb2", "pb1-pb2", "pb2-pb3"]);
  });

  it("dashes the right edges of an L-shaped prism, whose middle lies outside it", () => {
    const e = c.blank();
    e.document.solids = [{ id: "p", type: "prism", at: { x: 0, y: 0, z: 0 }, section: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 30 }, { x: 0, y: 30 }], length: 30, axis: "z" }];
    expect(hiddenEdges(c.validate(e))).toEqual(["p1-pb1", "pb1-pb2", "pb1-pb6"]);
  });

  it("hides a pyramid's back edges and names its corners after the solid", () => {
    const e = ex("square-pyramid");
    expect(c.solidPointIds(e.document.solids[0])).toEqual(["p1", "p2", "p3", "p4", "pt"]);
    expect(hiddenEdges(e)).toEqual(["p1-p4", "p3-p4", "p4-pt"]);
  });

  it("draws a cylinder's top rim whole and dashes the back of its base, with two straight sides", () => {
    const g = c.geometry(ex("cylinder-tank").document);
    const curves = g.pieces.filter((p) => p.pts.length > 2);
    expect(curves.filter((p) => p.hidden)).toHaveLength(1);
    expect(curves.filter((p) => !p.hidden)).toHaveLength(2);
    const sides = g.pieces.filter((p) => p.pts.length === 2);
    expect(sides).toHaveLength(2);
    for (const s of sides) expect(Math.abs(s.pts[0].x - s.pts[1].x)).toBeLessThan(1e-6);
  });

  it("draws a rim two solids share once: a cone on a hemisphere of the same size has its back half dashed", () => {
    const g = c.geometry(ex("cone-hemisphere").document);
    expect(g.pieces.filter((p) => p.hidden)).toHaveLength(1);
    // A narrow cone on a wide hemisphere: the hemisphere's flat face shows whole, the cone's base rim has a dashed back.
    const s = c.geometry(ex("cone-sculpture").document);
    expect(s.pieces.filter((p) => p.hidden)).toHaveLength(1);
  });

  it("leaves hidden edges out when asked", () => {
    const e = c.create();
    e.document.hidden = "none";
    expect(c.renderSvg(c.validate(e))).not.toContain("stroke-dasharray");
    expect(c.renderSvg(c.create())).toContain("stroke-dasharray");
  });

  it("prints angle sizes with degree signs and keeps blank, answer line, hidden and zero distinct", () => {
    expect(c.printed(c.label("35"), "pupil", true).text).toBe("35°");
    expect(c.printed(c.label("x", "symbol"), "pupil", true).text).toBe("x°");
    expect(c.printed(c.label("0"), "pupil").text).toBe("0");
    expect(c.printed(c.label(), "pupil").text).toBe("");
    expect(c.printed(c.label("", "answer-line"), "pupil").text).toBe("______");
    expect(c.printed(c.label("", "hidden", "7 cm"), "pupil").text).toBe("");
    expect(c.printed(c.label("", "hidden", "7 cm"), "answer")).toEqual({ text: "7 cm", answer: true });
  });

  it("draws every example without overlaps or print problems, at 11 pt or more, in STIX Two", () => {
    for (const x of examples) {
      const e = x.make();
      expect(c.warnings(e), x.id).toEqual([]);
      const svg = c.renderSvg(e);
      expect(svg).toContain("STIX Two");
      for (const m of svg.matchAll(/font-size="([\d.]+)"/g)) expect(Number(m[1]) * (72 / 25.4)).toBeGreaterThanOrEqual(9.99);
    }
    expect(joined(c.renderSvg(ex("triangular-prism")))).toContain("35°");
  });

  it("never prints a saved answer or its colour on a pupil copy, nor in the alt text, and gives both copies one size", () => {
    const e = c.create();
    e.document.dims[0].label = c.label("", "hidden", "12 cm");
    const v = c.validate(e);
    const pupil = c.renderSvg(v, "pupil"),
      answer = c.renderSvg(v, "answer");
    expect(pupil).not.toContain("12 cm");
    expect(pupil).not.toContain(c.ANSWER_COLOUR);
    expect(answer).toContain("12 cm");
    expect(answer).toContain(c.ANSWER_COLOUR);
    expect(c.altText(v)).not.toContain("12");
    expect(pupil.match(/width="[\d.]+mm" height="[\d.]+mm"/)![0]).toBe(answer.match(/width="[\d.]+mm" height="[\d.]+mm"/)![0]);
  });

  it("refuses clashing IDs, missing points, flat bases and points on a rim that is not there, with a reason", () => {
    const e = c.create();
    e.document.points = [{ id: "p1", place: { type: "at", x: 0, y: 0, z: 0 }, show: "none" }];
    expect(() => c.validate(e)).toThrow(/Two things are called p1/);
    const f = c.create();
    f.document.dims.push(c.dim("q", "p1", "zz", c.label("3 cm")));
    expect(() => c.validate(f)).toThrow(/point zz/);
    const g = c.create();
    g.document.points = [{ id: "m", place: { type: "rim", solid: "p", end: "base", deg: 0 }, show: "none" }];
    expect(() => c.validate(g)).toThrow(/not a cylinder/);
    const h = c.blank();
    h.document.solids = [{ id: "p", type: "prism", at: { x: 0, y: 0, z: 0 }, section: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }], length: 10, axis: "z" }];
    expect(() => c.validate(h)).toThrow(/almost no area/);
  });

  it("notes a right-angle mark on an angle that is not square in the solid, for the teacher only", () => {
    const e = ex("triangular-prism");
    expect(c.teacherNotes(e.document)).toEqual([]);
    e.document.angles[0].mark = "right";
    expect(c.teacherNotes(c.validate(e).document)[0]).toMatch(/right-angle mark/);
  });

  it("round-trips files and links", () => {
    for (const x of examples) {
      const e = x.make();
      expect(c.canonical(c.parseFile(c.canonical(e)))).toBe(c.canonical(e));
      expect(c.canonical(c.decodeLinkHash(c.linkHash(e)))).toBe(c.canonical(e));
    }
    expect(c.editorLink(c.create(), "https://mathsdock.co.uk/tools")).toMatch(/\/tools\/solids#solids=/);
  });
});

describe("3D solids connector adapter", () => {
  it("creates from a spec, defaulting label states", () => {
    const e = io.create({
      spec: {
        solids: [{ id: "c", type: "cylinder", at: { x: 0, y: 0, z: 0 }, r: 15, h: 40, axis: "y" }],
        points: [{ id: "r", place: { type: "rim", solid: "c", end: "base", deg: 0 } }],
        dims: [
          { id: "rad", a: "co", b: "r", label: { text: "5 cm" } },
          { id: "ht", a: "co", b: "ct", kind: "arrow", offset: 20, label: { answer: "12 cm" } },
        ],
        settings: { view: { type: "turned", turn: 0, tilt: 15 } },
      },
    });
    expect(e.document.dims.map((m) => m.label.state)).toEqual(["value", "hidden"]);
    expect(c.warnings(e)).toEqual([]);
    expect(() => io.create({ spec: { example: "cylinder-tank", dims: [] } })).toThrow(/revise the result/);
  });

  it("revises with set operations first and refuses to remove what is still used", async () => {
    const e = io.create({ spec: { example: "square-pyramid" } });
    await expect(io.revise({ envelope: e, baseHash: await c.hash(e), operations: [{ op: "remove", what: "point", id: "m" }] })).rejects.toThrow(/line vm, length s/);
    const r = await io.revise({
      envelope: e,
      baseHash: await c.hash(e),
      operations: [
        { op: "remove", what: "point", id: "m" },
        { op: "remove", what: "line", id: "vm" },
        { op: "remove", what: "dim", id: "s" },
        { op: "set_name", name: { id: "p1", text: "P" } },
      ],
    });
    expect(r.document.points.map((p) => p.id)).toEqual(["o"]);
    expect(r.document.names.find((x) => x.id === "p1")!.text).toBe("P");
    await expect(io.revise({ envelope: e, baseHash: "0".repeat(64), operations: [] })).rejects.toThrow(/stale_hash/);
    // Saving an answer alone keeps an answer line an answer line.
    const f = c.create();
    f.document.dims[0].label = c.label("", "answer-line");
    const g = c.validate(f);
    const h = await io.revise({ envelope: g, baseHash: await c.hash(g), operations: [{ op: "set_dim", dim: { id: "w", label: { answer: "8 cm" } } }] });
    expect(h.document.dims[0].label).toEqual({ state: "answer-line", text: "", answer: "8 cm" });
  });
});
