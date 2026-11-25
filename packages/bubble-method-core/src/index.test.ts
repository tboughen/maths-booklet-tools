import { describe, expect, it } from "vitest";
import * as bm from "./index";
import * as io from "./interchange";
import { examples } from "./examples";
import { piecesOf, termSpans, terms, typesetOp, typesetSide } from "./maths";

const hiddenText = (e: bm.Envelope) => bm.values(e.document).filter((v) => v.show === "hidden").map((v) => v.text);

describe("bubble method", () => {
  it("starts from 2x + 3 = 11 with one empty step, and keeps blanks distinct from hidden answers", () => {
    const e = bm.create();
    expect(e.document.first).toEqual(bm.line("2x + 3", "11"));
    expect(e.document.steps).toHaveLength(1);
    expect(() => bm.setSlot(e, "step:0:left", { show: "hidden" })).toThrow(/blank cannot hold a hidden answer/);
    const hidden = bm.setSlot(e, "step:0:left", { text: "−3", show: "hidden" });
    expect(bm.renderSvg(hidden)).not.toContain("−3");
    expect(bm.renderSvg(bm.forView(hidden, "answer", true))).toContain(bm.ANSWER_COLOUR);
    expect(bm.renderSvg(bm.forView(hidden, "answer"))).not.toContain(bm.ANSWER_COLOUR);
  });

  it("saves house-style bubbles, never saves plain, and keeps the same layout either way", async () => {
    const e = io.create({ spec: { example: "subject-two-steps", worked: true } });
    const house = io.create({ spec: { example: "subject-two-steps", worked: true, bubbles: "house" } });
    expect(house.document.bubbles).toBe("house");
    expect(bm.parseFile(bm.canonical(house)).document.bubbles).toBe("house");
    expect(bm.decodeLinkHash(bm.linkHash(house)).document.bubbles).toBe("house");
    const plain = bm.validate({ ...structuredClone(e), document: { ...structuredClone(e.document), bubbles: "plain" } });
    expect(bm.canonical(plain)).toBe(bm.canonical(e));
    expect(await bm.hash(plain)).toBe(await bm.hash(e));
    const svg = bm.renderSvg(house);
    expect(svg).toContain(`stroke="${bm.HOUSE_NAVY}"`);
    expect(svg).not.toContain("<ellipse");
    expect(bm.renderSvg(e)).not.toContain(bm.HOUSE_NAVY);
    expect(JSON.stringify(bm.layout(house))).toBe(JSON.stringify(bm.layout(e)));
    const back = await io.revise({ envelope: house, baseHash: await bm.hash(house), operations: [{ op: "set_settings", settings: { bubbles: "plain" } }] });
    expect(back.document.bubbles).toBeUndefined();
    const again = await io.revise({ envelope: back, baseHash: await bm.hash(back), operations: [{ op: "set_settings", settings: { bubbles: "house" } }] });
    expect(again.document.bubbles).toBe("house");
  });

  it("prints keyboard signs as a paper prints them and stacks fractions", () => {
    expect(typesetSide("3x+2")).toBe("3x + 2");
    expect(typesetSide("y-2")).toBe("y − 2");
    expect(typesetSide("-3x")).toBe("−3x");
    expect(typesetSide("x^2 - 4")).toBe("x² − 4");
    expect(typesetOp("-2")).toBe("−2");
    expect(typesetOp("x3")).toBe("×3");
    expect(typesetOp("/ 3")).toBe("÷3");
    expect(typesetOp("+ 3x")).toBe("+3x");
    expect(piecesOf(typesetSide("(y-2)/3"))).toEqual([expect.objectContaining({ kind: "fraction", num: "y − 2", den: "3" })]);
    expect(piecesOf("x/2 + 1").map((p) => p.kind)).toEqual(["fraction", "text"]);
    expect(piecesOf("1/2").map((p) => p.kind)).toEqual(["fraction"]);
    expect(piecesOf("x/−2")).toEqual([expect.objectContaining({ kind: "fraction", num: "x", den: "−2" })]);
    expect(piecesOf("−6/−2")).toEqual([expect.objectContaining({ kind: "fraction", num: "−6", den: "−2" })]);
    expect(piecesOf("x − 6/2").map((p) => (p.kind === "text" ? p.text : `${p.num}/${p.den}`))).toEqual(["x", " − ", "6/2"]);
  });

  it("splits a side into its terms outside brackets and fractions", () => {
    expect(terms("3x + 2").map((t) => t.text)).toEqual(["3x", "+ 2"]);
    expect(terms("u + at").map((t) => t.text)).toEqual(["u", "+ at"]);
    expect(terms("2(x + 1) − 5").map((t) => t.text)).toEqual(["2(x + 1)", "− 5"]);
    expect(terms("(y − 2)/3").map((t) => t.text)).toEqual(["(y − 2)/3"]);
    expect(terms("−4").map((t) => t.text)).toEqual(["−4"]);
    const [a, b] = termSpans("3x + 2");
    expect(b.cx).toBeGreaterThan(a.cx);
  });

  it("puts a + or − bubble under the last term, others under the whole side, and obeys an explicit term", () => {
    const e = io.create({ spec: { start: "y = 3x + 2", steps: [{ bubble: "−2", line: "y − 2 = 3x" }, { bubble: "÷3", line: "(y − 2)/3 = x" }] } });
    const g = bm.layout(e);
    const hit = (slot: string) => g.hits.find((h) => h.slot === slot)!;
    const centre = (slot: string) => hit(slot).x + hit(slot).width / 2;
    const rhs = hit("first:rhs");
    // The −2 sits over the right-hand end (+ 2), not the middle of 3x + 2.
    expect(centre("step:0:right")).toBeGreaterThan(rhs.x + rhs.width / 2);
    // ÷3 sits under the whole of y − 2.
    const lhs = hit("step:0:lhs");
    expect(Math.abs(centre("step:1:left") - (lhs.x + lhs.width / 2))).toBeLessThan(0.6);
    // Under term 0 (u) the bubble moves left of where "auto" puts it (+ at).
    const f = io.create({ spec: { start: "v = u + at", steps: [{ bubble: "−u", line: "v − u = at" }] } });
    const auto = bm.layout(f).hits.find((h) => h.slot === "step:0:right")!;
    const first = bm.layout(bm.setUnder(f, 0, "right", 0)).hits.find((h) => h.slot === "step:0:right")!;
    expect(first.x).toBeLessThan(auto.x);
  });

  it("keeps bubbles on their own side of the sign and pupil and answer copies the same size", () => {
    for (const x of examples) {
      const e = x.make(false);
      const pupil = bm.layout(e),
        answer = bm.layout(bm.forView(e, "answer"));
      expect([answer.width, answer.height]).toEqual([pupil.width, pupil.height]);
      for (const r of pupil.rows)
        if (r.kind === "bubbles") {
          const [l, rr] = r.items;
          expect(l.cx + l.rx).toBeLessThan(pupil.sign);
          expect(rr.cx - rr.rx).toBeGreaterThan(pupil.sign);
        }
      expect(pupil.issues).toEqual([]);
    }
  });

  it("gives a blank line handwriting room and an empty bubble room to write in", () => {
    const g = bm.layout(bm.create());
    const blank = g.hits.find((h) => h.slot === "step:0:lhs")!,
      bubble = g.hits.find((h) => h.slot === "step:0:left")!;
    expect(blank.height).toBeGreaterThanOrEqual(12);
    expect(blank.width).toBeGreaterThanOrEqual(26);
    expect(bubble.width).toBeGreaterThanOrEqual(13);
    expect(bubble.height).toBeGreaterThanOrEqual(7.2);
    expect(bm.renderSvg(bm.create())).toContain("stroke-dasharray");
  });

  it("adds and removes steps, with the sign of the line above", () => {
    let e = io.create({ spec: { start: "2x − 5 < 9", steps: [] } });
    expect(e.document.steps).toHaveLength(0);
    e = bm.addStep(e, undefined, "+5");
    expect(e.document.steps[0].line.rel).toBe("<");
    expect(e.document.steps[0].left.op.text).toBe("+5");
    e = bm.addStep(e);
    e = bm.setRelation(e, 1, ">");
    expect(e.document.steps[1].line.rel).toBe(">");
    e = bm.removeStep(e, 0);
    expect(e.document.steps).toHaveLength(1);
    expect(() => bm.removeStep(e, 4)).toThrow(/no step 5/);
    for (let i = 0; i < bm.MAX_STEPS - 1; i++) e = bm.addStep(e);
    expect(() => bm.addStep(e)).toThrow(/at most 8 steps/);
  });

  it("raises teacher notes for bubbles that differ, never for an empty bubble, and not on a deliberate error", () => {
    const e = io.create({ spec: { start: "4x + 3 = 23", steps: [{ left: "−3", right: "+3", line: "4x = 20" }, { left: "÷4", right: "", line: "" }, { bubble: "half", line: "" }] } });
    const notes = bm.warnings(e);
    expect(notes).toContain("Step 1: the bubbles differ (−3 and +3). Balancing does the same to both sides.");
    expect(notes.some((n) => n.startsWith("Step 2"))).toBe(false);
    expect(notes).toContain('Step 3: "half" is not an operation for a bubble, such as −2, ÷3 or ×4.');
    expect(bm.warnings(bm.validate({ ...e, document: { ...e.document, intentionalError: true } }))).toEqual([]);
  });

  it("reads lines in the connector spec, with hidden answers and blank lines", () => {
    const e = io.create({ spec: { start: "y = x + 7", steps: [{ bubble: { text: "−7", hidden: true }, line: { text: "y − 7 = x", hidden: true } }] } });
    expect(hiddenText(e)).toEqual(["−7", "−7", "y − 7", "x"]);
    expect(io.create({ spec: { start: "x/2 >= 3" } }).document.first.rel).toBe("≥");
    expect(() => io.create({ spec: { start: "y = 3 = x" } })).toThrow(/one sign/);
    expect(() => io.create({ spec: { start: "y = x", steps: [{ bubble: { text: "", hidden: true } }] } })).toThrow(/blank cannot hold/);
    expect(() => io.create({ spec: { example: "inequality", start: "x = 1" } })).toThrow(/Examples/);
    const worked = io.create({ spec: { example: "solve-equation", worked: true } });
    expect(hiddenText(worked)).toEqual([]);
  });

  it("revises with the exact hash and keeps unchanged items", async () => {
    const e = io.create({ spec: { start: "4x + 3 = 23" } });
    const r = await io.revise({
      envelope: e,
      baseHash: await bm.hash(e),
      operations: [
        { op: "set_bubbles", step: 0, text: "−3" },
        { op: "set_item", slot: "step:0:lhs", text: "4x", show: "hidden" },
        { op: "add_step", bubble: "÷4" },
        { op: "set_settings", settings: { lines: "bold" } },
      ],
    });
    expect(r.document.first).toEqual(e.document.first);
    expect(r.document.steps[0].left.op.text).toBe("−3");
    expect(r.document.steps[0].line.lhs).toEqual({ text: "4x", show: "hidden" });
    expect(r.document.steps[1].right.op.text).toBe("÷4");
    expect(r.document.lines).toBe("bold");
    await expect(io.revise({ envelope: e, baseHash: "0".repeat(64), operations: [] })).rejects.toThrow(/stale_hash/);
    await expect(io.revise({ envelope: e, baseHash: await bm.hash(e), operations: [{ op: "set_item", slot: "step:0:left", text: "−1234567890123" }] })).rejects.toThrow(/12 characters in each bubble/);
  });

  it("round-trips files and links, and refuses what is not a bubble method file", () => {
    for (const x of examples)
      for (const worked of [false, true]) {
        const e = x.make(worked);
        expect(bm.parseFile(bm.canonical(e))).toEqual(e);
        expect(bm.decodeLinkHash(bm.linkHash(e))).toEqual(e);
      }
    expect(bm.editorLink(bm.create(), "https://mathsdock.co.uk/tools/graph")).toMatch(/^https:\/\/mathsdock\.co\.uk\/tools\/bubble-method#bubble-method=/);
    expect(() => bm.parseFile('{"kind":"function-machine"}')).toThrow(/not a supported bubble method file/);
    expect(() => bm.decodeLinkHash("#bubble-method=@@")).toThrow(/not a supported/);
    const long = bm.create();
    long.document.first.lhs.text = "x".repeat(41);
    expect(() => bm.validate(long)).toThrow(/40 characters on each side/);
    const wrongType = structuredClone(bm.create()) as unknown as { document: { first: { lhs: { text: unknown } } } };
    wrongType.document.first.lhs.text = 5;
    expect(() => bm.validate(wrongType)).toThrow(/not a supported bubble method file/);
    expect(bm.renderSvg(io.create({ spec: { start: "y = x/3", steps: [{ bubble: "x3", line: "3y = x" }] } }))).toContain('aria-label="Bubble method: y = x/3; bubbles ×3 and ×3; 3y = x"');
  });

  it("keeps hidden answers out of the pupil copy and prints them in pink on the answers copy", () => {
    for (const x of examples) {
      const e = x.make(false);
      const pupil = bm.renderSvg(e),
        answers = bm.renderSvg(bm.forView(e, "answer", true));
      expect(pupil).not.toContain(bm.ANSWER_COLOUR);
      if (bm.hasHidden(e)) expect(answers).toContain(bm.ANSWER_COLOUR);
      expect(io.printFacts(e).referenceFeatures.textSizesPt.map(Math.round)).toEqual([11]);
    }
  });
  it("leaves out an item in both copies, with no dotted line, and keeps a blank left out", () => {
    let e = bm.setSlot(bm.create(), "first:rhs", { show: "omit" });
    expect(bm.renderSvg(bm.forView(e, "answer", true))).not.toMatch(/>11</);
    e = bm.setSlot(e, "first:rhs", { text: "" });
    expect(e.document.first.rhs).toEqual({ text: "", show: "omit" });
    const dots = (svg: string) => (svg.match(/stroke-dasharray/g) ?? []).length;
    expect(dots(bm.renderSvg(e))).toBe(dots(bm.renderSvg(bm.setSlot(e, "first:rhs", { show: "show" }))) - 1);
    const bubbles = (svg: string) => (svg.match(/<ellipse/g) ?? []).length;
    const left = bm.setSlot(e, "step:0:left", { show: "omit" });
    expect(bubbles(bm.renderSvg(bm.forView(left, "answer")))).toBe(bubbles(bm.renderSvg(e)) - 1);
  });
});
