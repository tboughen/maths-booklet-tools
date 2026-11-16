import { describe, expect, it } from "vitest";
import { create as createGrid } from "../../algebra-grid-core/src/index";
import { example as numberLine } from "../../number-line-core/src/examples";
import { checkWorked, claimedMarks, diagramSvg, lastTerm, layoutWorked, mathsText, mathsWidth, parseWorked, pieces, slices, type WorkedData } from "./index";

const surfaces = [{ id: "a-1", width: 480, height: 200 }, { id: "b-1", width: 480, height: 160 }, { id: "stem-1", width: 480, height: 300 }];

function sample(): WorkedData {
  return parseWorked({
    schemaVersion: 2, questionId: "1MA1_TEST_1F_Q19", questionRevision: "rev-1",
    parts: [
      {
        on: "a-1", parts: ["(a)"], method: "bubble-method", area: { x: 40, y: 30, width: 260, bottom: 175 }, notesX: 310,
        answers: [{ x: 330, y: 192, width: 120 }],
        steps: [
          { kind: "line", lhs: "4x + 3", rhs: "19" },
          { kind: "bubbles", lhs: "-3", rhs: "-3", },
          { kind: "line", lhs: "4x", rhs: "16", mark: { code: "M1", note: "subtracts 3 from both sides", also: "16 ÷ 4 written down" } },
          { kind: "bubbles", lhs: "÷4", rhs: "÷4" },
          { kind: "line", lhs: "x", rhs: "4" },
          { kind: "answer", value: "4", mark: { code: "A1", note: "cao" } },
        ],
      },
      {
        on: "b-1", parts: ["(b)"], area: { x: 40, y: 20, width: 260, bottom: 120 }, notesX: 310, answers: [{ x: 330, y: 145, width: 120 }],
        steps: [
          { kind: "carry", from: "(a)", text: "x = 4" },
          { kind: "text", text: "3 × 4 - 2 = 10", mark: { code: "B1", note: "substitutes x = 4" } },
          { kind: "draw", on: "stem-1", shapes: [{ type: "line", from: [50, 250], to: [250, 50] }] },
          { kind: "answer", value: "10" },
        ],
      },
    ],
  });
}
const question = { id: "1MA1_TEST_1F_Q19", revision: "rev-1", parts: [{ label: "(a)", marks: 2 }, { label: "(b)", marks: 1 }] };

describe("worked-solution maths text", () => {
  it("prints minus and times signs but keeps hyphens in words", () => {
    expect(mathsText("3 * 4 - 2 <= x")).toBe("3 × 4 − 2 ≤ x");
    expect(mathsText("-x and two-way")).toBe("−x and two-way");
  });
  it("splits stacked fractions and powers", () => {
    expect(pieces("x^2 + {3/4}")).toEqual([{ kind: "run", text: "x", sup: false }, { kind: "run", text: "2", sup: true }, { kind: "run", text: " + ", sup: false }, { kind: "fraction", num: "3", den: "4" }]);
    expect(pieces("10^{12}")).toEqual([{ kind: "run", text: "10", sup: false }, { kind: "run", text: "12", sup: true }]);
    expect(mathsWidth("{3/4}")).toBeLessThan(mathsWidth("3/4") + 6);
  });
  it("finds the term a bubble acts on", () => {
    expect(lastTerm("4x + 3")).toBe("+ 3");
    expect(lastTerm("2(x − 1) − 5")).toBe("− 5");
    expect(lastTerm("3(x + 2)")).toBe("3(x + 2)");
    expect(lastTerm("4x")).toBe("4x");
  });
});

describe("worked-solution data", () => {
  it("rejects bad marks, empty working spaces and unknown fields", () => {
    const raw = JSON.parse(JSON.stringify(sample()));
    expect(() => parseWorked({ ...raw, parts: [{ ...raw.parts[0], steps: [{ kind: "answer", value: "4", mark: { code: "X1", note: "no" } }] }] })).toThrow(/code/);
    expect(() => parseWorked({ ...raw, parts: [{ ...raw.parts[0], area: { x: 1, y: 50, width: 10, bottom: 40 } }] })).toThrow(/bottom/);
    expect(() => parseWorked({ ...raw, extra: true })).toThrow();
  });
  it("draws MathsDock diagrams at their printed size", () => {
    const line = diagramSvg("number-line", numberLine(1, true));
    expect(line.width).toBeGreaterThan(300);
    expect(line.svg).toMatch(/^<svg viewBox="[^"]+" overflow="visible">/);
    const grid = diagramSvg("algebra-grid", createGrid(2, 3));
    expect(grid.width).toBeGreaterThan(50);
    expect(grid.height).toBeGreaterThan(50);
    const tree = diagramSvg("factor-tree", { kind: "factor-tree", schemaVersion: 1, rendererVersion: "factor-tree-1", document: {
      trees: [{ id: "t1", nodes: [{ id: "n1", parent: null, value: { text: "12", show: "show" } }, { id: "n2", parent: "n1", value: { text: "2", show: "show" }, circled: true },
        { id: "n3", parent: "n1", value: { text: "6", show: "show" } }, { id: "n4", parent: "n3", value: { text: "2", show: "show" }, circled: true },
        { id: "n5", parent: "n3", value: { text: "3", show: "show" }, circled: true }], product: null }], blankStyle: "dots", levelMm: 13, intentionalError: false } });
    expect(tree.width).toBeGreaterThan(30);
    expect(tree.svg).toContain(">12<");
  });
});

describe("worked-solution layout", () => {
  it("draws each part over its own cut and places marks beside the working", () => {
    const layout = layoutWorked(sample(), surfaces);
    expect(layout.issues).toEqual([]);
    expect(layout.steps).toBe(10);
    const a = layout.overlays.get("a-1")!;
    expect(a.bands).toEqual([]);
    expect(a.svg).toContain(">M1<");
    expect(a.svg).toContain("Also scores: 16 ÷ 4 written down");
    expect(a.svg).toContain("<ellipse");
    expect(a.svg).toContain("MathsDock Hand");
    expect(layout.overlays.get("stem-1")!.svg).toContain('d="M50 250L250 50"');
  });
  it("hides the mark chips for a pupil copy but keeps the words in place", () => {
    const withMarks = layoutWorked(sample(), surfaces).overlays.get("a-1")!.svg;
    const pupil = layoutWorked(sample(), surfaces, { marks: false }).overlays.get("a-1")!.svg;
    expect(pupil).toContain(".wk-mark{display:none}");
    expect(pupil).not.toContain("Also scores");
    const place = (svg: string) => /<text x="([\d.]+)" y="([\d.]+)"[^>]*>subtracts 3 from both sides/.exec(svg)?.slice(1);
    expect(place(pupil)).toEqual(place(withMarks));
    expect(layoutWorked(sample(), surfaces, { marks: false }).overlays.get("a-1")!.bands).toEqual(layoutWorked(sample(), surfaces).overlays.get("a-1")!.bands);
  });
  it("shows steps one at a time, counting through every part", () => {
    const data = sample();
    const two = layoutWorked(data, surfaces, { upTo: 2 });
    expect(two.overlays.get("a-1")!.svg).toContain('data-step="2"');
    expect(two.overlays.get("a-1")!.svg).not.toContain('data-step="3"');
    const bOnly = layoutWorked(data, surfaces, { parts: ["b-1"], upTo: 7 });
    expect(bOnly.overlays.has("a-1")).toBe(false);
    expect(bOnly.overlays.get("b-1")!.svg).toContain('data-step="7"');
    expect(bOnly.shownSteps).toEqual([7, 8, 9, 10]);
  });
  it("adds room instead of shrinking when the working is longer than the space", () => {
    const data = sample();
    data.parts[0].area.bottom = 80;
    const layout = layoutWorked(data, surfaces);
    const a = layout.overlays.get("a-1")!;
    expect(a.bands).toHaveLength(1);
    expect(a.bands[0].at).toBe(80);
    expect(a.svg).toContain(`height="${200 + a.bands[0].size}"`);
    // The answer line is below the working space, so the answer moves down with it.
    expect(a.svg).toContain(`translate(0 ${a.bands[0].size})`);
    expect(slices(a)).toEqual([{ from: 0, to: 80, y: 0 }, { from: 80, to: 200, y: 80 + a.bands[0].size }]);
    expect(layout.issues).toEqual([]);
  });
  it("moves a later part on the same cut down by the room added above it", () => {
    const data = sample();
    data.parts[0].area.bottom = 80;
    data.parts[1] = { ...data.parts[1], on: "a-1", area: { x: 40, y: 150, width: 260, bottom: 205 }, answers: [{ x: 330, y: 222, width: 120 }], steps: data.parts[1].steps.filter(s => s.kind !== "draw") };
    data.parts[0].answers = [{ x: 330, y: 120, width: 120 }];
    const tall = [{ id: "a-1", width: 480, height: 230 }];
    const a = layoutWorked(data, tall).overlays.get("a-1")!;
    expect(a.bands).toHaveLength(1);
    expect(a.svg.split(`translate(0 ${a.bands[0].size})`).length - 1).toBeGreaterThanOrEqual(3);
  });
  it("adds the Total for Question line for a whole question", () => {
    const b = layoutWorked(sample(), [surfaces[2], surfaces[0], surfaces[1]], { total: { question: 19, marks: 3 } }).overlays.get("b-1")!;
    expect(b.footer).toBe(28);
    expect(b.svg).toContain("(Total for Question 19 is 3 marks)");
  });
  it("puts the total under the last cut shown, even with no working on it", () => {
    const layout = layoutWorked(sample(), [...surfaces, { id: "c-1", width: 480, height: 100 }], { total: { question: 19, marks: 3 } });
    expect(layout.overlays.get("c-1")!.svg).toContain("Total for Question 19");
    expect(layout.overlays.get("b-1")!.footer).toBe(0);
  });
  it("keeps style rules inside the overlay", () => {
    const pupil = layoutWorked(sample(), surfaces, { marks: false }).overlays.get("a-1")!.svg;
    expect(pupil).toContain('class="wk"');
    expect(pupil).toContain(".wk .wk-mark{display:none}");
  });
  it("refuses added room that would split a drawing from its graph", () => {
    const data = sample();
    data.parts[1].on = "stem-1";
    data.parts[1].area = { x: 40, y: 60, width: 260, bottom: 80 };
    data.parts[1].answers = [];
    data.parts[1].steps = data.parts[1].steps.filter(s => s.kind !== "answer");
    const issues = layoutWorked(data, surfaces).issues.map(i => i.message);
    expect(issues.some(m => /split this drawing/.test(m))).toBe(true);
  });
  it("reports overlaps, answers too long and missing cuts", () => {
    const data = sample();
    data.parts[0].notesX = 60;
    const answer = data.parts[0].steps[5] as { value: string };
    answer.value = "a very long answer that cannot fit";
    const issues = layoutWorked(data, surfaces.slice(0, 2)).issues.map(i => i.message);
    expect(issues.some(m => /overlap/.test(m))).toBe(true);
    expect(issues.some(m => /longer than its answer line/.test(m))).toBe(true);
    expect(issues.some(m => /no cut called stem-1/.test(m))).toBe(true);
  });
});

describe("worked-solution written answers", () => {
  it("starts words at the left of a full-width line and centres a value", () => {
    const raw = sample();
    const at = (align: "left" | "centre") => {
      const data = parseWorked({ ...raw, parts: [{ ...raw.parts[0], steps: [{ kind: "answer", value: "4", align, mark: { code: "A1", note: "cao" } }] }, raw.parts[1]] });
      return Number(/<g data-step="1">.*?<text x="([\d.]+)"/s.exec(layoutWorked(data, surfaces).overlays.get("a-1")!.svg)?.[1]);
    };
    expect(at("left")).toBeCloseTo(336, 0);
    expect(at("centre")).toBeGreaterThan(380);
  });
  it("adds room so guidance beside the last line never reaches the answer", () => {
    const raw = sample();
    const data = parseWorked({ ...raw, parts: [{ ...raw.parts[0], area: { x: 40, y: 150, width: 260, bottom: 175 }, steps: [
      { kind: "text", text: "3 × 4 = 12", note: "A long piece of guidance that wraps onto a second and then a third line of the column." },
      { kind: "answer", value: "12", mark: { code: "A1", note: "cao" } },
    ] }, raw.parts[1]] });
    const layout = layoutWorked(data, surfaces);
    expect(layout.issues).toEqual([]);
    expect(layout.overlays.get("a-1")!.bands[0].size).toBeGreaterThan(20);
  });
  it("shows an answer's Also scores line under its chip, keeping its room without the mark notes", () => {
    const raw = sample();
    const steps = [{ kind: "answer", value: "4", mark: { code: "B2", note: "cao", also: "(B1) for three correct" } }];
    const data = parseWorked({ ...raw, parts: [{ ...raw.parts[0], steps }, raw.parts[1]] });
    const svg = layoutWorked(data, surfaces).overlays.get("a-1")!.svg;
    expect(svg).toContain("Also scores: (B1) for three correct");
    const chipAt = (s: string) => /<text x="[\d.]+" y="([\d.]+)"[^>]*>cao</.exec(s)?.[1];
    expect(chipAt(layoutWorked(data, surfaces, { marks: false }).overlays.get("a-1")!.svg)).toBe(chipAt(svg));
    expect(layoutWorked(data, surfaces, { marks: false }).overlays.get("a-1")!.svg).not.toContain("Also scores");
  });
  it("holds each run of maths to its measured width so a power lands where it was laid out", () => {
    const raw = sample();
    const data = parseWorked({ ...raw, parts: [{ ...raw.parts[0], steps: [{ kind: "text", text: "Rectangle: 6 × 36 = 216 cm^2" }, { kind: "answer", value: "216" }] }, raw.parts[1]] });
    const svg = layoutWorked(data, surfaces).overlays.get("a-1")!.svg;
    const run = /<text x="40" [^>]*textLength="([\d.]+)"[^>]*>Rectangle/.exec(svg);
    expect(Number(run?.[1])).toBeCloseTo(mathsWidth("Rectangle: 6 × 36 = 216 cm"), 1);
  });
});

describe("worked-solution checks", () => {
  it("passes a complete solution", () => {
    expect(claimedMarks(sample().parts[0])).toBe(2);
    expect(checkWorked(sample(), question, surfaces)).toEqual([]);
  });
  it("catches marks that do not add up, empty answer lines and house-rule slips", () => {
    const data = sample();
    data.parts[1].steps = [
      { kind: "text", text: "Put x = 4, so 3/4 of it" },
      { kind: "note", text: "y ↓ by 2", watch: false },
    ];
    const problems = checkWorked(data, { ...question, revision: "rev-2" }, surfaces);
    expect(problems).toEqual(expect.arrayContaining([
      "The file was written for a different revision of the question.",
      "The notes for (b) give 0 marks; the part is worth 1.",
      "Answer line 1 of (b) is left empty.",
      '"Put x = 4, so 3/4 of it" uses a slash or a small fraction; fractions are stacked: write {3/4}.',
      '"Put x = 4, so 3/4 of it" says "put"; the school says "substitute".',
    ]));
    expect(problems.some(p => p.includes("y ↓"))).toBe(true);
  });
  it("catches a carried value that differs from the earlier answer", () => {
    const data = sample();
    (data.parts[1].steps[0] as { text: string }).text = "x = 5";
    expect(checkWorked(data, question, surfaces)).toContain('"x = 5" does not match the answer to (a).');
  });
  it("finds the part a carried value names as printed, such as (a) for part 19a", () => {
    const data = sample();
    data.parts[0].parts = ["19a"]; data.parts[1].parts = ["19b"];
    const labelled = { ...question, parts: [{ label: "19a", marks: 2 }, { label: "19b", marks: 1 }] };
    expect(checkWorked(data, labelled, surfaces)).toEqual([]);
    (data.parts[1].steps[0] as { text: string }).text = "x = 5";
    expect(checkWorked(data, labelled, surfaces)).toContain('"x = 5" does not match the answer to (a).');
    // Another question's number, a bare letter and the part's own label never match.
    for (const from of ["18a", "a", "(b)"]) {
      Object.assign(data.parts[1].steps[0], { from, text: "x = 4" });
      expect(checkWorked(data, labelled, surfaces)).toContain(`"x = 4" is carried from ${from}, which has no working.`);
    }
  });
  it("catches parts with no working or answered twice", () => {
    const data = sample();
    data.parts[1].parts = ["(a)"];
    const problems = checkWorked(data, question, surfaces);
    expect(problems).toContain("Part (a) is answered 2 times.");
    expect(problems).toContain("Part (b) has no working.");
  });
});
