import { describe, expect, it } from "vitest";
import * as c from "./index";
import * as io from "./interchange";
import { examples } from "./examples";

const ex = (id: string, worked = false) => examples.find((x) => x.id === id)!.make(worked);
const texts = (svg: string) => [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map((m) => m[1].replace(/<[^>]+>/g, ""));
const near = (p: c.P, x: number, y: number) => {
  expect(p.x).toBeCloseTo(x, 6);
  expect(p.y).toBeCloseTo(y, 6);
};

describe("geometry figures", () => {
  it("places points exactly: on circles, along lines, where lines meet, on tangents and at feet", () => {
    const e = c.blank(),
      d = e.document;
    d.circles = [{ id: "c", centre: "o", r: 10, style: "solid" }];
    d.points.push(
      c.point("a", c.on("c", 90)),
      c.point("b", c.on("c", 0)),
      c.point("m", { type: "along", a: "a", b: "b", t: 0.5 }),
      c.point("t", { type: "tangent", at: "b", mm: 5 }),
      c.point("x", { type: "tangents", a: "a", b: "b" }),
      c.point("f", { type: "foot", from: "o", a: "a", b: "b" }),
      c.point("k", { type: "meet", a: "o", b: "x", c: "a", d: "b" }),
    );
    const g = c.resolve(c.validate(e).document).points;
    near(g.get("a")!, 0, 10);
    near(g.get("m")!, 5, 5);
    // Anticlockwise along the tangent at the rightmost point is upwards.
    near(g.get("t")!, 10, 5);
    near(g.get("x")!, 10, 10);
    near(g.get("f")!, 5, 5);
    near(g.get("k")!, 5, 5);
  });

  it("refuses missing points, loops, parallel lines and tangents at points not on a circle, with a reason", () => {
    const loop = c.blank();
    loop.document.points.push(c.point("a", { type: "along", a: "o", b: "b", t: 1 }), c.point("b", { type: "along", a: "o", b: "a", t: 1 }));
    expect(() => c.validate(loop)).toThrow(/placed using itself/);
    const missing = c.blank();
    missing.document.segments = [c.segment("s", "o", "q")];
    expect(() => c.validate(missing)).toThrow(/point q/);
    const parallel = c.blank();
    parallel.document.points.push(c.point("a", c.free(10, 0)), c.point("b", c.free(0, 5)), c.point("e", c.free(10, 5)), c.point("m", { type: "meet", a: "o", b: "a", c: "b", d: "e" }));
    expect(() => c.validate(parallel)).toThrow(/parallel/);
    const tangent = c.blank();
    tangent.document.points.push(c.point("a", c.free(10, 0)), c.point("t", { type: "tangent", at: "a", mm: 5 }));
    expect(() => c.validate(tangent)).toThrow(/on a circle/);
    const given = c.blank();
    given.document.points.push(c.point("a", c.free(10, 0)));
    given.document.segments = [c.segment("s", "o", "a", c.label("", "value"))];
    expect(() => c.validate(given)).toThrow(/no text/);
    const answered = structuredClone(given);
    answered.document.segments[0].label = c.label("4 cm", "value", "5 cm");
    expect(() => c.validate(answered)).toThrow(/cannot hold a saved answer/);
  });

  it("measures each angle anticlockwise from its from-arm to its to-arm", () => {
    const e = c.blank();
    e.document.points.push(c.point("a", c.free(10, 0)), c.point("b", c.free(0, 10)));
    e.document.angles = [c.angle("x", "o", "a", "b"), c.angle("y", "o", "b", "a")];
    const s = c.geometry(c.validate(e).document).slots;
    expect(s.map((x) => Math.round(x.sweep))).toEqual([90, 270]);
  });

  it("prints angle sizes and letters with degree signs, lengths as typed, and keeps blank, answer line, hidden and zero distinct", () => {
    const e = c.blank(),
      d = e.document;
    d.points.push(c.point("a", c.free(40, 0)), c.point("b", c.free(0, 30)), c.point("e", c.free(-40, 0)), c.point("f", c.free(0, -30)));
    d.segments = [c.segment("oa", "o", "a", c.label("9 cm")), c.segment("ob", "o", "b", c.label("", "blank", "7 cm")), c.segment("oe", "o", "e", c.label("", "answer-line")), c.segment("of", "o", "f", c.label("", "hidden", "7 cm"))];
    d.angles = [c.angle("aob", "o", "a", "b", c.label("0")), c.angle("boe", "o", "b", "e", c.label("x", "symbol")), c.angle("eof", "o", "e", "f", c.label("2x + 10"))];
    const v = c.validate(e);
    // Each run of maths text (italic letters, upright numbers) is its own text element, so read them joined.
    const pupil = texts(c.renderSvg(v, "pupil")).join(""),
      answer = texts(c.renderSvg(v, "answer")).join("");
    expect(pupil).toContain("0°");
    expect(pupil).toContain("x°");
    expect(pupil).toContain("(2x + 10)°");
    expect(pupil).toContain("9 cm");
    expect(pupil).toContain("______");
    expect(pupil).not.toContain("7 cm");
    expect(answer.split("7 cm").length - 1).toBe(2);
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

  it("draws every example without overlaps or print problems, at 11 pt or more, in STIX Two", () => {
    for (const x of examples)
      for (const worked of [false, true]) {
        const e = x.make(worked);
        expect(c.layout(e).issues, x.id).toEqual([]);
        expect(c.warnings(e), x.id).toEqual([]);
        const svg = c.renderSvg(e);
        expect(svg).toContain("STIX Two Text");
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
      expect(texts(svg), x.id).toEqual(texts(c.renderSvg(x.make(false), "pupil")));
      expect(svg.match(/aria-label="[^"]*"/)![0]).toBe(c.renderSvg(x.make(false)).match(/aria-label="[^"]*"/)![0]);
    }
  });

  it("notes a right-angle mark drawn far from 90° and repeated names, for the teacher only", () => {
    const e = c.blank();
    e.document.points.push(c.point("a", c.free(10, 0), "A"), c.point("b", c.free(10, 10), "A"));
    e.document.angles = [c.angle("r", "o", "a", "b", c.label(), "right")];
    const notes = c.teacherNotes(c.validate(e).document);
    expect(notes.join(" ")).toContain("drawn at 45°");
    expect(notes.join(" ")).toContain("both named A");
  });

  it("round-trips files and links", () => {
    for (const x of examples) {
      const e = x.make(true);
      expect(c.canonical(c.parseFile(c.canonical(e)))).toBe(c.canonical(e));
      expect(c.canonical(c.decodeLinkHash(c.linkHash(e)))).toBe(c.canonical(e));
    }
    expect(c.editorLink(ex("two-tangents"), "https://mathsdock.co.uk/tools/graph")).toMatch(/^https:\/\/mathsdock\.co\.uk\/tools\/figures#figures=/);
  });

  it("keeps text size and bold lines as overrides that are not saved at their defaults", () => {
    const e = c.blank();
    e.document.fontPt = 11;
    (e.document as { lines?: string }).lines = "normal";
    const v = c.validate(e);
    expect(v.document.fontPt).toBeUndefined();
    expect(v.document.lines).toBeUndefined();
    const bold = c.create();
    bold.document.lines = "bold";
    expect(c.renderSvg(c.validate(bold))).toContain('stroke-width="0.39"');
  });

  it("drags points on their own paths: round a circle, along a line or tangent, freely", () => {
    const e = ex("two-tangents");
    const moved = c.dragTo(e, "a", { x: 0, y: 30 })!;
    expect(moved.document.points.find((p) => p.id === "a")!.place).toMatchObject({ type: "on", deg: 90 });
    // D follows A because it is where the tangents meet.
    expect(c.resolve(moved.document).points.get("d")!.y).not.toBeCloseTo(0, 1);
    const free = c.dragTo(ex("similar-right"), "a", { x: 3.3, y: -2.6 })!;
    expect(free.document.points.find((p) => p.id === "a")!.place).toEqual({ type: "free", x: 3, y: -3 });
    expect(c.dragTo(e, "d", { x: 0, y: 0 })).toBeNull();
  });
});

describe("geometry figure connector adapter", () => {
  it("creates from a spec, defaulting label states, and fills every field", () => {
    const e = io.create({
      spec: {
        points: [{ id: "o", place: { type: "free", x: 0, y: 0 }, name: "O", show: "dot" }, { id: "a", place: { type: "on", circle: "c", deg: 30 }, name: "A" }, { id: "b", place: { type: "on", circle: "c", deg: 150 }, name: "B" }],
        circles: [{ id: "c", centre: "o", r: 20 }],
        segments: [{ id: "oa", a: "o", b: "a", label: { text: "6 cm" } }, { id: "ob", a: "o", b: "b", label: { text: "r", answer: "6 cm" } }],
        angles: [{ id: "aob", at: "o", from: "a", to: "b", label: { text: "120" } }],
      },
    });
    expect(e.document.segments.map((s) => s.label.state)).toEqual(["value", "symbol"]);
    expect(e.document.segments[0]).toMatchObject({ style: "solid", extend: [0, 0], ticks: 0, arrows: 0, side: "auto" });
    expect(e.document.angles[0]).toMatchObject({ mark: "arc", shade: false, label: { state: "value", text: "120" } });
    expect(e.document.circles[0].style).toBe("solid");
  });

  it("revises atomically: a point and the objects using it can arrive in one list, and stale hashes are refused", async () => {
    const e = io.create({ spec: { example: "two-tangents" } });
    const h = await c.hash(e);
    const r = await io.revise({
      envelope: e,
      baseHash: h,
      operations: [
        { op: "set_segment", segment: { id: "ab", a: "a", b: "b2", style: "dashed" } },
        { op: "set_point", point: { id: "b2", place: { type: "on", circle: "c", deg: 120 }, name: "E" } },
        { op: "set_angle", angle: { id: "ado", at: "d", from: "a", to: "o", label: { text: "y" } } },
        { op: "set_segment", segment: { id: "oa", ticks: 1 } },
      ],
    });
    expect(r.document.segments.find((s) => s.id === "oa")).toMatchObject({ ticks: 1, label: { text: "5 cm" } });
    expect(r.document.angles.at(-1)!.label).toMatchObject({ state: "symbol", text: "y" });
    await expect(io.revise({ envelope: e, baseHash: "0".repeat(64), operations: [] })).rejects.toThrow(/stale_hash/);
  });

  it("refuses to remove a point still in use, naming what uses it", async () => {
    const e = io.create({ spec: { example: "two-tangents" } });
    await expect(io.revise({ envelope: e, baseHash: await c.hash(e), operations: [{ op: "remove", what: "point", id: "a" }] })).rejects.toThrow(/segment ad/);
    const r = await io.revise({
      envelope: e,
      baseHash: await c.hash(e),
      operations: [
        { op: "remove", what: "segment", id: "od" },
        { op: "remove", what: "segment", id: "ad" },
        { op: "remove", what: "segment", id: "cd" },
        { op: "remove", what: "point", id: "d" },
      ],
    });
    expect(r.document.points.map((p) => p.id)).not.toContain("d");
  });

  it("makes worked examples only from the example's saved mark-scheme answers", () => {
    const pupil = io.create({ spec: { example: "similar-right" } }),
      worked = io.create({ spec: { example: "similar-right", worked: true } });
    expect(c.hasHidden(pupil)).toBe(false);
    expect(c.hasHidden(worked)).toBe(true);
  });
});
