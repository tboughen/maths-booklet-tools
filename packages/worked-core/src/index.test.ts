import { describe, expect, it } from "vitest";
import { create as createGrid } from "../../algebra-grid-core/src/index";
import { example as numberLine } from "../../number-line-core/src/examples";
import { checkWorked, claimedMarks, diagramSvg, guideWidth, NOTE_SIZE, noteWidth, lastTerm, layoutWorked, mathsText, mathsWidth, noteMarkup, noteText, parseWorked, pieces, slices, type WorkedData } from "./index";

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
    expect(pieces("x^2 + {3/4}")).toEqual([{ kind: "run", text: "x", sup: false }, { kind: "run", text: "2", sup: true }, { kind: "run", text: " + ", sup: false }, { kind: "fraction", num: [{ kind: "run", text: "3", sup: false }], den: [{ kind: "run", text: "4", sup: false }] }]);
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

describe("worked-solution guidance placement", () => {
  const chipX = (svg: string, words: string) => Number(new RegExp(`<rect x="([\\d.]+)"[^>]*/><text[^>]*>[A-Z]\\d</text></g><text[^>]*>${words}`).exec(svg)?.[1]);
  it("puts a mark just after the working that earns it", () => {
    const raw = sample();
    const data = parseWorked({ ...raw, parts: [{ ...raw.parts[0], notesX: 330, steps: [{ kind: "text", text: "3 × 4 = 12", mark: { code: "M1", note: "multiplies" } }, { kind: "answer", value: "12" }] }, raw.parts[1]] });
    const layout = layoutWorked(data, surfaces);
    expect(layout.issues).toEqual([]);
    expect(chipX(layout.overlays.get("a-1")!.svg, "multiplies")).toBeCloseTo(40 + mathsWidth("3 × 4 = 12") + 16, 0);
  });
  it("moves the next working down for a close Also scores line only if it would reach under it", () => {
    const raw = sample();
    const steps = (also?: string, rhs = "16") => [
      { kind: "line", lhs: "4x", rhs, mark: { code: "M1", note: "subtracts 3", ...(also ? { also } : {}) } },
      { kind: "bubbles", lhs: "÷4", rhs: "÷4" }, { kind: "line", lhs: "x", rhs: "4" }, { kind: "answer", value: "4" }];
    const cy = (s: unknown[]) => /<ellipse cx="[\d.]+" cy="([\d.]+)"/.exec(layoutWorked(parseWorked({ ...raw, parts: [{ ...raw.parts[0], steps: s }, raw.parts[1]] }), surfaces).overlays.get("a-1")!.svg)?.[1];
    expect(cy(steps("16 ÷ 4", "4 × 4"))).toBe(cy(steps(undefined, "4 × 4")));
  });
  it("keeps a mark whose Also scores line is too long for one line in the guidance column", () => {
    const raw = sample();
    const also = "a long other route the scheme accepts, written out in full so it runs well past one line";
    const data = parseWorked({ ...raw, parts: [{ ...raw.parts[0], notesX: 330, steps: [{ kind: "text", text: "3 × 4 = 12", mark: { code: "M1", note: "multiplies", also } }, { kind: "answer", value: "12" }] }, raw.parts[1]] });
    expect(chipX(layoutWorked(data, surfaces).overlays.get("a-1")!.svg, "multiplies")).toBe(330);
  });
  it("keeps long guidance, and guidance that has moved down, in the guidance column", () => {
    const raw = sample();
    const long = "describes the whole method in many words, so it cannot sit on one line beside the working";
    const data = parseWorked({ ...raw, parts: [{ ...raw.parts[0], notesX: 330, steps: [{ kind: "text", text: "3 × 4 = 12", mark: { code: "M1", note: long } }, { kind: "answer", value: "12" }] }, raw.parts[1]] });
    expect(chipX(layoutWorked(data, surfaces).overlays.get("a-1")!.svg, long.split(" ").slice(0, 3).join(" "))).toBe(330);
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

describe("worked-solution drawings on printed grids", () => {
  // stem-1 prints x from 0 at 50 pt to 10 at 250 pt, and y from 0 at 250 pt to 10 at 50 pt.
  const grid = { id: "g", on: "stem-1", x: [{ at: 50, value: 0 }, { at: 250, value: 10 }], y: [{ at: 250, value: 0 }, { at: 50, value: 10 }] };
  const withDraw = (draw: object, grids: object[] = [grid]) => {
    const raw = JSON.parse(JSON.stringify(sample()));
    raw.grids = grids;
    raw.parts[1].steps[2] = { kind: "draw", on: "stem-1", ...draw };
    return parseWorked(raw);
  };
  const stem = (data: WorkedData) => layoutWorked(data, surfaces).overlays.get("stem-1")!.svg;

  it("draws in the grid's own units", () => {
    const svg = stem(withDraw({ grid: "g", shapes: [{ type: "line", from: [0, 1], to: [5, 11 / 2] }] }));
    expect(svg).toContain('d="M50 230L150 140"');
  });
  it("rejects a grid that is missing, on another cut or calibrated on one gridline", () => {
    expect(() => withDraw({ grid: "h", shapes: [{ type: "cross", at: [1, 1] }] })).toThrow(/no grid called h/);
    expect(() => withDraw({ grid: "g", shapes: [{ type: "cross", at: [1, 1] }] }, [{ ...grid, on: "a-1" }])).toThrow(/is on a-1/);
    expect(() => withDraw({ grid: "g", shapes: [{ type: "cross", at: [1, 1] }] }, [{ ...grid, x: [grid.x[0], grid.x[0]] }])).toThrow(/two different gridlines/);
  });
  it("reports a drawing that leaves the cut", () => {
    const issues = layoutWorked(withDraw({ grid: "g", shapes: [{ type: "line", from: [0, 0], to: [30, 0] }] }), surfaces).issues;
    expect(issues.map(i => i.message)).toContain("Step 9: the drawing goes outside the cut.");
  });
  it("draws arcs, regions, reading lines, vectors, angles and ticks", () => {
    const svg = stem(withDraw({ shapes: [
      { type: "arc", centre: [100, 150], radius: 40, from: 0, to: 90 },
      { type: "region", points: [[60, 60], [120, 60], [60, 120]] },
      { type: "reading", points: [[60, 280], [60, 200], [20, 200]] },
      { type: "vector", from: [200, 200], to: [260, 200] },
      { type: "angle", at: [300, 250], from: [400, 250], to: [300, 150], label: "90°", right: true },
      { type: "angle", at: [300, 100], from: [400, 100], to: [380, 40], label: "x" },
      { type: "ticks", from: [400, 280], to: [460, 280], count: 2 },
      { type: "curve", points: [[50, 50], [100, 120], [150, 50]], dashed: true },
    ] }));
    // Anticlockwise from the right on paper: the arc ends straight above its centre.
    expect(svg).toMatch(/M140 150L[^"]*L100 110"/);
    expect(svg).toContain('fill-opacity="0.15"');
    expect(svg.match(/stroke-dasharray="4 3"/g)).toHaveLength(2);
    expect(svg).toContain("M307 250l0 -7l-7 0");
    expect(svg).toContain("C");
    expect(svg).toContain(">90°<");
  });
  it("puts a drawing's mark beside it when noteAt is given, and in the column otherwise", () => {
    const mark = { code: "B1", note: "line through (0, 1) and (5, 5.5)" };
    const beside = layoutWorked(withDraw({ grid: "g", noteAt: [6, 8], shapes: [{ type: "line", from: [0, 1], to: [5, 5.5] }], mark }), surfaces);
    expect(beside.overlays.get("stem-1")!.svg).toContain('<rect x="170" y="81"');
    expect(beside.overlays.get("b-1")!.svg).not.toContain("line through");
    const column = layoutWorked(withDraw({ grid: "g", shapes: [{ type: "line", from: [0, 1], to: [5, 5.5] }], mark }), surfaces);
    expect(column.overlays.get("b-1")!.svg).toContain("line through");
  });
});

describe("worked-solution recurring decimals and fraction powers", () => {
  it("puts a dot over each recurring digit", () => {
    expect(pieces("0.2dot{4}dot{6}")).toEqual([{ kind: "run", text: "0.2", sup: false }, { kind: "run", text: "4", sup: false, dot: true }, { kind: "run", text: "6", sup: false, dot: true }]);
    const raw = JSON.parse(JSON.stringify(sample()));
    raw.parts[0].steps = [{ kind: "answer", value: "0.dot{3}", mark: { code: "B1", note: "cao" } }];
    expect(layoutWorked(parseWorked(raw), surfaces).overlays.get("a-1")!.svg).toMatch(/<circle [^>]*r="[\d.]+"/);
  });
  it("lays out a stacked fraction's numerator and denominator as maths", () => {
    const run = (text: string, sup = false) => ({ kind: "run", text, sup });
    expect(pieces("x = {4/x^{2}} + 1")).toEqual([run("x = "), { kind: "fraction", num: [run("4")], den: [run("x"), run("2", true)] }, run(" + 1")]);
    expect(pieces("{a^3/2}")).toEqual([{ kind: "fraction", num: [run("a"), run("3", true)], den: [run("2")] }]);
    expect(pieces("{3 × 10^{−5}/x^{n+1}}")).toEqual([{ kind: "fraction", num: [run("3 × 10"), run("−5", true)], den: [run("x"), run("n+1", true)] }]);
    // A fraction inside a fraction stays inline.
    expect(pieces("{a/{1/2} + 1}")).toEqual([{ kind: "fraction", num: [run("a")], den: [run("1/2 + 1")] }]);
    const raw = JSON.parse(JSON.stringify(sample()));
    raw.parts[0].steps = [{ kind: "text", text: "y = {3 * 10^{-5}/x^{n+1}}" }, { kind: "answer", value: "4", mark: { code: "B1", note: "cao" } }];
    const svg = layoutWorked(parseWorked(raw), surfaces).overlays.get("a-1")!.svg;
    // The powers are raised and smaller than the figures they belong to.
    expect(svg).toMatch(/font-size="8.4"[^>]*>−5<\/text>/);
    expect(svg).toMatch(/font-size="8.4"[^>]*>n\+1<\/text>/);
    expect(mathsWidth("{3 × 10^{−5}/7}")).toBeCloseTo(mathsWidth("3 × 10^{−5}") + 12 * 0.4, 5);
  });
});

describe("worked-solution vectors", () => {
  it("reads underlined vectors, arrows over and column vectors", () => {
    expect(pieces("2_{a} + vec{AB}")).toEqual([{ kind: "run", text: "2", sup: false }, { kind: "run", text: "a", sup: false, under: true }, { kind: "run", text: " + ", sup: false }, { kind: "run", text: "AB", sup: false, arrow: true }]);
    expect(pieces("[3;−2]")).toEqual([{ kind: "column", top: "3", bottom: "−2" }]);
    expect(pieces("[3 marks]")).toEqual([{ kind: "run", text: "[3 marks]", sup: false }]);
  });
  it("gives a column vector a two-line row like a fraction", () => {
    const raw = JSON.parse(JSON.stringify(sample()));
    raw.parts[0].steps = [{ kind: "line", lhs: "_{p} + _{q}", rhs: "[3;-2] + [1;4]" }, { kind: "answer", value: "[4;2]", mark: { code: "B2", note: "correct vector" } }];
    const svg = layoutWorked(parseWorked(raw), surfaces).overlays.get("a-1")!.svg;
    expect(svg).toMatch(/Q[\d.]+ [\d.]+ [\d.]+ [\d.]+M/);
    expect(svg).toContain('stroke-width="0.8"');
  });
});

describe("worked-solution drawing review fixes", () => {
  const base = () => JSON.parse(JSON.stringify(sample()));
  it("keeps a compass arc circular on a grid with unequal scales", () => {
    const raw = base();
    raw.grids = [{ id: "g", on: "stem-1", x: [{ at: 0, value: 0 }, { at: 100, value: 1 }], y: [{ at: 200, value: 0 }, { at: 190, value: 1 }] }];
    raw.parts[1].steps[2] = { kind: "draw", on: "stem-1", grid: "g", shapes: [{ type: "arc", centre: [2, 5], radius: 1, from: 0, to: 90 }] };
    const svg = layoutWorked(parseWorked(raw), surfaces).overlays.get("stem-1")!.svg;
    expect(svg).toMatch(/M300 150L[^"]*L200 50"/);
  });
  it("moves guidance beside a drawing with it, and reports room that would split them", () => {
    const raw = base();
    raw.parts[0].area.bottom = 60;
    raw.parts[1].steps[2] = { kind: "draw", on: "a-1", noteAt: [250, 45], note: "guide", shapes: [{ type: "line", from: [250, 120], to: [280, 150] }] };
    const issues = layoutWorked(parseWorked(raw), surfaces).issues.map(i => i.message);
    expect(issues.some(m => /would split this drawing/.test(m))).toBe(true);
  });
  it("puts a straight angle's label above its arc", () => {
    const raw = base();
    raw.parts[1].steps[2] = { kind: "draw", on: "stem-1", shapes: [{ type: "angle", at: [200, 200], from: [300, 200], to: [100, 200], label: "180°" }] };
    const svg = layoutWorked(parseWorked(raw), surfaces).overlays.get("stem-1")!.svg;
    const y = Number(/<text x="[\d.]+" y="([\d.]+)"[^>]*>180°/.exec(svg)?.[1] ?? /y="([\d.]+)"[^>]*>180/.exec(svg)![1]);
    expect(y).toBeLessThan(190);
  });
  it("flags a vector inside a fraction or power", () => {
    const raw = base();
    raw.parts[1].steps[1] = { ...raw.parts[1].steps[1], text: "{_{a}/2}" };
    expect(checkWorked(parseWorked(raw), question, surfaces).some(p => /vector inside a fraction/.test(p))).toBe(true);
  });
});

describe("guidance typesetting", () => {
  it("raises squares and cubes and turns a hyphen used as minus into a minus sign", () => {
    expect(noteText("x^2 - 4 = -3, b = -42 and 2^3")).toBe("x² − 4 = −3, b = −42 and 2³");
    expect(noteText("well-drawn line, 1-1 match")).toBe("well-drawn line, 1-1 match");
    expect(noteText("10^2.5")).toBe("10^2.5");
    expect(noteText("Watch out - M1 - method; 2n - 1 and (x + 2) - 3")).toBe("Watch out - M1 - method; 2n − 1 and (x + 2) − 3");
    expect(noteMarkup("4.5 × 10^24 & 10^-3")).toBe("4.5 × 10<tspan dy=\"-3.5\" font-size=\"7\">24</tspan><tspan dy=\"3.5\">\u200b</tspan> &amp; 10<tspan dy=\"-3.5\" font-size=\"7\">−3</tspan><tspan dy=\"3.5\">\u200b</tspan>");
  });
  it("lifts a numerator whose letters hang below the line clear of the bar", () => {
    const gap = (rhs: string) => {
      const raw = JSON.parse(JSON.stringify(sample()));
      raw.parts[0].steps = [{ kind: "line", lhs: "q", rhs }];
      const svg = layoutWorked(parseWorked(raw), surfaces).overlays.get("a-1")!.svg;
      const bar = Number(/<path d="M[\d.]+ ([\d.]+)H/.exec(svg)![1]);
      const num = Math.max(...[...svg.matchAll(/<text[^>]* y="([\d.]+)"[^>]*>[^<]*(?:p − 7|3|\))</g)].map(m => Number(m[1])).filter(y => y < bar));
      return bar - num;
    };
    expect(gap("{p - 7/6}")).toBeGreaterThan(gap("{3/6}") + 1);
    expect(gap("{3(x - 7)/6}")).toBeGreaterThan(gap("{3/6}") + 1);
  });
  it("stacks fractions in guidance and gives their line extra room", () => {
    expect(noteText("Gradient of L is -{1/2}")).toBe("Gradient of L is −{1/2}");
    expect(noteText("6 - {1/2}x and {-1/2}")).toBe("6 − {1/2}x and {−1/2}");
    expect(noteMarkup("f^{-1}(x)")).toBe("f<tspan dy=\"-3.5\" font-size=\"7\">−1</tspan><tspan dy=\"3.5\">\u200b</tspan>(x)");
    expect(guideWidth("is {1/2}", NOTE_SIZE)).toBeLessThan(noteWidth("is {1/2}", NOTE_SIZE));
    // A fractional power is raised, not stacked.
    expect(guideWidth("x^{1/2}", NOTE_SIZE)).toBe(noteWidth("x^{1/2}", NOTE_SIZE));
    expect(noteMarkup("x^{-1/2}")).toContain(">−1/2</tspan>");
    const raw = JSON.parse(JSON.stringify(sample()));
    raw.parts[0].steps = [{ kind: "line", lhs: "y", rhs: "6 - {1/2}x", note: "Gradient of L is -{1/2}." }];
    const svg = layoutWorked(parseWorked(raw), surfaces).overlays.get("a-1")!.svg;
    expect(svg).not.toContain("{1/2}");
    expect(svg).toMatch(/text-anchor="middle">1<\/text><path [^>]*\/><text [^>]*text-anchor="middle">2<\/text>/);
  });
});

describe("worked-solution fractional powers and nth roots", () => {
  const run = (text: string, sup = false) => ({ kind: "run", text, sup });
  it("reads a fractional power as a small stacked fraction, with its sign", () => {
    expect(pieces("64^{1/3} = 4")).toEqual([run("64"), { kind: "power", sign: "", num: "1", den: "3" }, run(" = 4")]);
    expect(pieces("64^{-2/3}")).toEqual([run("64"), { kind: "power", sign: "−", num: "2", den: "3" }]);
    expect(pieces("x^{2}")).toEqual([run("x"), run("2", true)]);
  });
  it("reads cube and fourth roots, and root{n}{...}, with a small index", () => {
    expect(pieces("∛64")).toEqual([{ kind: "root", body: [run("64")], index: "3" }]);
    expect(pieces("∜(81)")).toEqual([{ kind: "root", body: [run("81")], index: "4" }]);
    expect(pieces("root{5}{x + 1}")).toEqual([{ kind: "root", body: [run("x + 1")], index: "5" }]);
  });
  it("draws the power's fraction raised and the root's index, and gives the line room", () => {
    const raw = JSON.parse(JSON.stringify(sample()));
    raw.parts[0].steps = [{ kind: "line", lhs: "64^{-2/3}", rhs: "{1/16}" }, { kind: "line", lhs: "∛64", rhs: "4" }];
    const svg = layoutWorked(parseWorked(raw), surfaces).overlays.get("a-1")!.svg;
    expect(svg).not.toContain("2/3");
    expect(svg).toMatch(/>−<\/text><text [^>]*text-anchor="middle">2<\/text><path [^>]*\/><text [^>]*text-anchor="middle">3<\/text>/);
    expect(svg).toMatch(/class="wk-root"[^>]*\/><text [^>]*>3<\/text>/);
    expect(mathsWidth("∛64")).toBeGreaterThan(mathsWidth("√64"));
  });
});

describe("worked-solution square roots", () => {
  const run = (text: string, sup = false) => ({ kind: "run", text, sup });
  it("reads sqrt{...} and a root sign before a number, letters or a bracket", () => {
    expect(pieces("sqrt{a + b}")).toEqual([{ kind: "root", body: [run("a + b")] }]);
    expect(pieces("3√2 + √x = √36")).toEqual([run("3"), { kind: "root", body: [run("2")] }, run(" + "), { kind: "root", body: [run("x")] }, run(" = "), { kind: "root", body: [run("36")] }]);
    // The overbar replaces the brackets.
    expect(pieces("√(x^2 + 4)")).toEqual([{ kind: "root", body: [run("x"), run("2", true), run(" + 4")] }]);
    expect(pieces("√({1.1/1.05^{3}})")).toEqual([{ kind: "root", body: [{ kind: "fraction", num: [run("1.1")], den: [run("1.05"), run("3", true)] }] }]);
    expect(pieces("√{2/3}")).toEqual([{ kind: "root", body: [{ kind: "fraction", num: [run("2")], den: [run("3")] }] }]);
    expect(pieces("{1/√3}")).toEqual([{ kind: "fraction", num: [run("1")], den: [{ kind: "root", body: [run("3")] }] }]);
    // A braced group that is not a fraction loses its braces under the overbar.
    expect(pieces("√{x+1}")).toEqual([{ kind: "root", body: [run("x+1")] }]);
    // A fraction splits at its own slash, not one inside a nested group.
    expect(pieces("{√{a/b}/c}")).toEqual([{ kind: "fraction", num: [{ kind: "root", body: [run("a/b")] }], den: [run("c")] }]);
    // A root sign with nothing to cover stays as typed.
    expect(pieces("√ and √(")).toEqual([run("√ and √(")]);
    expect(mathsWidth("√36")).toBeGreaterThan(mathsWidth("36") + 4);
  });
  it("draws the radical and an overbar, and gives a root over a fraction a fraction's room", () => {
    const raw = JSON.parse(JSON.stringify(sample()));
    raw.parts[0].steps = [{ kind: "text", text: "√36 = 6" }, { kind: "text", text: "r = √({1.1/1.05^{3}}) - 1" }, { kind: "answer", value: "4√2", mark: { code: "B1", note: "cao" } }];
    const svg = layoutWorked(parseWorked(raw), surfaces).overlays.get("a-1")!.svg;
    const roots = [...svg.matchAll(/<path class="wk-root" d="M([\d.]+) ([\d.]+)L([\d.]+) ([\d.]+)L([\d.]+) ([\d.]+)L([\d.]+) ([\d.]+)H([\d.]+)" stroke="#111111" stroke-width="0.9"/g)].map(m => m.slice(1).map(Number));
    expect(roots).toHaveLength(3);
    expect(svg).not.toContain("√");
    for (const [, tickY, , peakY, , footY, headX, topY, end] of roots) {
      expect(peakY).toBeLessThan(tickY); // the small tick rises
      expect(footY).toBeGreaterThan(tickY); // then the stroke falls to the foot
      expect(topY).toBeLessThan(peakY); // and the long stroke rises to the overbar
      expect(end).toBeGreaterThan(headX + 6); // the overbar spans the contents
    }
    // The root over a fraction is taller than the plain root and reaches past the fraction's bar both ways.
    const height = (r: number[]) => r[5] - r[7];
    expect(height(roots[1])).toBeGreaterThan(height(roots[0]) * 1.8);
    expect(svg).toMatch(/font-size="8.4"[^>]*>3<\/text>/);
    const plain = JSON.parse(JSON.stringify(raw));
    plain.parts[0].steps = [{ kind: "text", text: "√36 = 6" }, { kind: "text", text: "r = √(1.1) - 1" }, plain.parts[0].steps[2]];
    const short = layoutWorked(parseWorked(plain), surfaces).overlays.get("a-1")!.svg;
    const baseline = (s: string, t: string) => Number(new RegExp(`y="([\\d.]+)"[^>]*>${t}`).exec(s)?.[1]);
    expect(baseline(svg, "r = ") - baseline(svg, "36")).toBeGreaterThan(baseline(short, "r = ") - baseline(short, "36") + 8);
  });
});
