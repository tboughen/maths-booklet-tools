import { describe, expect, it } from "vitest";
import {
  addTerm,
  canonical,
  collect,
  create,
  decodeLinkHash,
  editorLink,
  forView,
  layout,
  linkHash,
  moveTerm,
  parseExpression,
  parseFile,
  removeTerm,
  renderSvg,
  setItem,
  setLetters,
  setTerm,
  setTiles,
  simplified,
  tileSize,
  validate,
  warnings,
  writeExpression,
  ANSWER_COLOUR,
  LONG,
  SHORT,
  UNIT,
} from "./index";
import { examples } from "./examples";
import * as io from "./interchange";

const ab = { long: "a", short: "b" };

describe("algebra tiles", () => {
  it("reads expressions as written, without collecting", () => {
    expect(parseExpression("3a + 2b - a + 4", ab)).toEqual([
      { count: 3, long: 1, short: 0 },
      { count: 2, long: 0, short: 1 },
      { count: -1, long: 1, short: 0 },
      { count: 4, long: 0, short: 0 },
    ]);
    expect(parseExpression("3a^2b − ab²", ab)).toEqual([
      { count: 3, long: 2, short: 1 },
      { count: -1, long: 1, short: 2 },
    ]);
    // ba is the same tile as ab.
    expect(parseExpression("ba", ab)).toEqual([{ count: 1, long: 1, short: 1 }]);
    expect(parseExpression("3c", ab)).toBeNull();
    expect(parseExpression("3a +", ab)).toBeNull();
  });

  it("gives every kind of term its own shape", () => {
    expect(tileSize({ long: 0, short: 0 })).toEqual({ w: UNIT, h: UNIT, depth: 0 });
    expect(tileSize({ long: 1, short: 0 })).toEqual({ w: UNIT, h: LONG, depth: 0 });
    expect(tileSize({ long: 0, short: 1 })).toEqual({ w: UNIT, h: SHORT, depth: 0 });
    expect(tileSize({ long: 2, short: 0 })).toEqual({ w: LONG, h: LONG, depth: 0 });
    expect(tileSize({ long: 1, short: 1 })).toEqual({ w: LONG, h: SHORT, depth: 0 });
    const a2b = tileSize({ long: 2, short: 1 }),
      ab2 = tileSize({ long: 1, short: 2 });
    expect(a2b.h).toBe(LONG);
    expect(ab2.h).toBe(SHORT);
    expect(a2b.depth).toBeGreaterThan(0);
    expect(a2b).not.toEqual(ab2);
  });

  it("names the letters from the expression, the first alphabetically long", () => {
    const e = create("2b + a", { long: "x", short: "y" });
    expect(e.document.letters).toEqual(ab);
    expect(e.document.terms.map((t) => [t.count, t.long, t.short])).toEqual([
      [2, 0, 1],
      [1, 1, 0],
    ]);
    // A letter the diagram already has keeps its tiles: y stays the short letter beside x.
    expect(create("3y + 2").document.letters).toEqual({ long: "x", short: "y" });
    expect(create("3p + 2").document.letters).toEqual({ long: "p", short: "y" });
    expect(() => create("a + b + c")).toThrow(/two letters/);
    expect(() => create("4o")).toThrow(/l and o/);
  });

  it("collects and writes only when asked, and never overwrites", () => {
    const e = create("2a²b + ab² − a²b + 2ab²", ab);
    expect(e.document.answer).toBeNull();
    expect(simplified(e.document)).toBe("a²b + 3ab²");
    const c = collect(e).envelope;
    expect(c.document.answer).toEqual({ text: "a²b + 3ab²", show: "hidden" });
    const w = writeExpression(c, false).envelope;
    expect(w.document.expression).toEqual({ text: "2a²b + ab² − a²b + 2ab²", show: "show" });
    const kept = setItem(w, "answer", { text: "4ab" });
    expect(collect(kept).filled).toBe(false);
    expect(simplified(create("a − a").document)).toBe("0");
  });

  it("notes an expression or answer that does not match, unless the error is deliberate", () => {
    let e = setItem(create("3a + 2b + a", ab), "answer", { text: "4ab" });
    expect(warnings(e)[0]).toMatch(/does not match/);
    e = setItem(e, "answer", { text: "3a + a + 2b" });
    expect(warnings(e)[0]).toMatch(/like terms to collect/);
    e = setItem(e, "answer", { text: "2b + 4a" });
    expect(warnings(e)).toEqual([]);
    e = setItem(e, "answer", { text: "6ab" });
    e = validate({ ...e, document: { ...e.document, intentionalError: true } });
    expect(warnings(e)).toEqual([]);
  });

  it("keeps blank, hidden and shown distinct", () => {
    const e = setItem(create("x + 1"), "answer", {});
    expect(e.document.answer).toEqual({ text: "", show: "show" });
    expect(() => setItem(e, "answer", { show: "hidden" })).toThrow(/blank cannot hold/);
    const hidden = setTerm(e, "t1", { show: "hidden" });
    const pupil = renderSvg(hidden),
      answer = renderSvg(forView(hidden, "answer", true));
    expect(pupil).not.toContain(">x<");
    expect(answer).toContain(ANSWER_COLOUR);
    // Both copies are the same size.
    expect(layout(hidden).width).toBe(layout(forView(hidden, "answer")).width);
    expect(layout(hidden).height).toBe(layout(forView(hidden, "answer")).height);
  });

  it("hidden answers take the same room on both copies", () => {
    const e = collect(setItem(create("3a + 2b + a − b", ab), "expression", { text: "3a + 2b + a − b" })).envelope;
    const p = layout(e),
      a = layout(forView(e, "answer"));
    expect(p.width).toBe(a.width);
    expect(p.height).toBe(a.height);
    expect(renderSvg(e)).not.toContain(">4<");
    expect(renderSvg(forView(e, "answer"))).toContain(">4<");
  });

  it("edits terms, letters and order as one validated document", () => {
    let e = create("3a + 2b", ab);
    e = addTerm(e, { count: -1, long: 2, short: 1 }, "t1");
    expect(e.document.terms.map((t) => t.id)).toEqual(["t1", "t3", "t2"]);
    e = moveTerm(e, "t3", 1);
    expect(e.document.terms.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
    e = setTerm(e, "t2", { term: "ab²", count: -4 });
    expect(e.document.terms[1]).toMatchObject({ count: -4, long: 1, short: 2 });
    e = removeTerm(e, "t1");
    expect(e.document.terms).toHaveLength(2);
    e = setLetters(e, { long: "x", short: "y" });
    expect(renderSvg(e)).toContain("xy");
    expect(() => setLetters(e, { long: "x", short: "x" })).toThrow(/different/);
    expect(() => setTerm(e, "t2", { count: 0 })).toThrow(/at least one tile/);
    expect(() => setTiles(e, "a⁴")).toThrow();
    expect(() => setTiles(e, "a²b²")).toThrow(/three letters/);
    expect(() => setTiles(e, "12a + 12b + 12a + 12b + 12a + 12b")).toThrow(/60 tiles/);
  });

  it("refuses zero-pair rings and labels it cannot print, and warns about rings that need grouping", () => {
    const e = create("2x + 3 − x − 1");
    const ringed = validate({ ...e, document: { ...e.document, zeroPairs: "show" } });
    expect(warnings(ringed)).toContain("Zero pairs are ringed only when the tiles are grouped.");
    const grouped = validate({ ...ringed, document: { ...ringed.document, arrangement: "grouped" } });
    expect(layout(grouped).pairs).toHaveLength(2);
    expect(renderSvg(grouped)).toContain('stroke-dasharray="1.6 0.8"');
  });

  it("keeps wide expressions inside the print width", () => {
    const e = create("12a² + 12ab + 12b² + 12a + 12b", ab);
    expect(layout(e).width).toBeLessThanOrEqual(180);
    expect(layout(e).issues).toEqual([]);
  });

  it("round-trips files and links", () => {
    for (const x of examples) {
      const e = x.make(false);
      expect(parseFile(canonical(e))).toEqual(e);
      expect(decodeLinkHash(linkHash(e))).toEqual(e);
      expect(warnings(e)).toEqual([]);
      expect(layout(e).issues).toEqual([]);
      expect(renderSvg(e)).toMatch(/^<svg[^>]+width="[\d.]+mm"/);
    }
    expect(editorLink(create(), "https://mathsdock.co.uk/tools/graph")).toMatch(/^https:\/\/mathsdock\.co\.uk\/tools\/algebra-tiles#algebra-tiles=/);
  });

  it("creates and revises through the connector adapter", async () => {
    const e = io.create({ spec: { tiles: "3a + 2b − a", answer: "", collect: true } });
    expect(e.document.answer).toEqual({ text: "2a + 2b", show: "hidden" });
    const hidden = io.create({ spec: { terms: [{ term: "a²b", count: 2 }, { term: "ab²", count: -1, hidden: true }], frame: true } });
    expect(hidden.document.terms[1].show).toBe("hidden");
    expect(hidden.document.letters).toEqual(ab);
    const { hash } = await import("./index");
    const r = await io.revise({
      envelope: hidden,
      baseHash: await hash(hidden),
      operations: [{ op: "add_term", term: "1", count: 3 }, { op: "set_settings", settings: { arrangement: "grouped" } }, { op: "write_expression" }],
    });
    expect(r.document.terms).toHaveLength(3);
    expect(r.document.expression).toEqual({ text: "2a²b − ab² + 3", show: "hidden" });
    await expect(io.revise({ envelope: hidden, baseHash: "0".repeat(64), operations: [] })).rejects.toThrow(/stale_hash/);
    expect(() => io.create({ spec: { example: "a2b-ab2", tiles: "a" } })).toThrow(/Examples/);
  });

  it("review fixes: hidden rings never reach the pupil copy; frames still wrap; 0 is simplified; odd input", () => {
    const base = create("3x + 2 − x − 2");
    const hidden = validate({ ...base, document: { ...base.document, arrangement: "grouped", zeroPairs: "hidden" } });
    expect(renderSvg(hidden)).not.toContain('stroke-dasharray="1.6 0.8"');
    expect(renderSvg(forView(hidden, "answer", true))).toContain(`stroke="${ANSWER_COLOUR}" stroke-width="0.4" stroke-dasharray="1.6 0.8"`);
    for (const [tiles, arrangement] of [["x² + 11x³ − 6 + 12x²y + x", "as-written"], ["x² + 11x³ − 6 + 12x²y + x", "grouped"], ["12y² − xy", "grouped"]] as const) {
      const e = create(tiles);
      const framed = validate({ ...e, document: { ...e.document, frame: true, arrangement } });
      expect(layout(framed).width, tiles).toBeLessThanOrEqual(180);
    }
    const zero = collect(create("x − x")).envelope;
    expect(zero.document.answer?.text).toBe("0");
    expect(warnings(zero)).toEqual([]);
    expect(parseExpression("2 3", ab)).toBeNull();
    expect(parseExpression("2 × 3", ab)).toBeNull();
    expect(parseExpression("a ^ 2", ab)).toEqual([{ count: 1, long: 2, short: 0 }]);
    expect(parseExpression("3A + 2", ab)).toEqual([{ count: 3, long: 1, short: 0 }, { count: 2, long: 0, short: 0 }]);
    const long = io.create({ spec: { tiles: "3a²b − 2ab² + ab + 4 + 2a − b + a²b − 3 + 2ab", writeExpression: true } });
    expect(long.document.expression?.text).toBe("3a²b − 2ab² + ab + 4 + 2a − b + a²b − 3 + 2ab");
  });
});
