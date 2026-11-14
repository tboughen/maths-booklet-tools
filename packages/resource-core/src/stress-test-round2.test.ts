// @vitest-environment node
// Faults found by building SP7 (probability trees) and A8 (grid method) worksheets through the live
// connector, round 2 of the worksheet stress test (14 November 2026). Each test pins one fix.
import { describe, expect, it } from "vitest";
import { drawDiagram, FAMILIES } from "../../diagram-core/src/registry";
import { create as createTriangle } from "../../triangle-core/src/interchange";
import { create as createTree } from "../../probability-tree-core/src/interchange";
import { create as createFrequencyTree } from "../../frequency-tree-core/src/interchange";
import { create as createGrid } from "../../algebra-grid-core/src/interchange";
import { treeDiagrams } from "./fixtures";
import { renderResource, validate, type Resource } from "./index";
import { writeWorksheetDocx, type DocxOptions } from "./docx";
import { packAnswerLines } from "./text";

const ANSWER = "#b0125b";
const font = (seed: number) => Uint8Array.from({ length: 64 }, (_, i) => (i * 7 + seed) % 256);
const wordOptions = (view: "pupil" | "answers"): DocxOptions => ({
  view,
  fonts: { regular: font(1), semiBold: font(2), italic: font(3) },
  picture: (svg) => ({ svg, png: new Uint8Array([137, 80, 78, 71]) }),
});

const mathsSheet = (items: unknown[]): Resource => {
  const doc = structuredClone(treeDiagrams) as unknown as {
    document: { notation: string; sides: { columns: { cards: { items: unknown[] }[] }[] }[] };
  };
  doc.document.notation = "maths";
  doc.document.sides[0].columns[0].cards[0].items = items;
  return validate(doc);
};
const messages = (r: Resource) => renderResource(r).issues.map((i) => i.message);

describe("worksheet stress test, round 2", () => {
  it("puts inline answer lines that do not fit side by side on rows of their own, instead of overlapping", async () => {
    const lines = [
      { type: "answerLine", prefix: "P(heads and 6) = 1/2 × 1/6 =", answer: "1/12", inline: true },
      { type: "answerLine", prefix: "P(tails and 3) = 1/2 ×", answer: "1/6 = 1/12", inline: true },
      { type: "answerLine", prefix: "P(heads and even) =", answer: "1/2 × 1/2 = 1/4", inline: true },
    ];
    const sheet = mathsSheet([{ type: "text", text: "Complete each calculation." }, ...lines]);
    expect(messages(sheet).filter((m) => /shorter than 18 mm|wider than its answer line/.test(m))).toEqual([]);
    // Word follows the same rows.
    const { issues } = await writeWorksheetDocx(sheet, wordOptions("answers"));
    expect(issues.filter((i) => /shorter than 18 mm/.test(i.message))).toEqual([]);
  });

  it("keeps short inline answer lines together on one row, exactly as before", () => {
    const need = (w: number) => () => w;
    expect(packAnswerLines([1, 2, 3], 130, need(30))).toEqual([[1, 2, 3]]);
    expect(packAnswerLines([1, 2, 3], 130, need(50))).toEqual([[1, 2], [3]]);
    expect(packAnswerLines([1, 2, 3], 130, need(90))).toEqual([[1], [2], [3]]);
  });

  it("gives a part's answer its own row when the saved answer would run past a short line", () => {
    const sheet = mathsSheet([
      { type: "part", text: "Describe two events that would give this tree.", items: [{ type: "answerLine", answer: "e.g. roll a dice, then flip a coin", inline: false }] },
    ]);
    expect(messages(sheet).some((m) => /wider than its answer line/.test(m))).toBe(false);
  });

  it("prints a grid's hidden products on the answers copy, in the answer colour, and never on the pupil copy", () => {
    const e = createGrid({
      spec: {
        rowCount: 3,
        columnCount: 3,
        cells: [
          { rowId: "r0", columnId: "c1", value: "x" },
          { rowId: "r0", columnId: "c2", value: "+3" },
          { rowId: "r1", columnId: "c0", value: "x" },
          { rowId: "r2", columnId: "c0", value: "+2" },
          { rowId: "r1", columnId: "c1", value: "x^2", hidden: true },
          { rowId: "r2", columnId: "c2", value: "+6", hidden: true },
        ],
      },
    });
    const pupil = drawDiagram("algebra-grid", e, "pupil").svg;
    const answer = drawDiagram("algebra-grid", e, "answer").svg;
    expect(pupil).not.toContain(">6<");
    expect(answer).toContain(">+6<");
    expect(answer).toContain(`fill="${ANSWER}"`);
    expect(FAMILIES["algebra-grid"].answerView).toBe(true);
  });

  it("prints a triangle's saved hidden answer on the answers copy, in the answer colour", () => {
    const e = createTriangle({
      spec: {
        shape: "right",
        widthCm: 8,
        labels: [{ ref: "e:BC", label: { state: "symbol", text: "x" } }],
        operations: [{ op: "set_saved_answer", ref: "e:BC", answer: "13", overwrite: false }],
      },
    });
    const pupil = drawDiagram("triangle", e, "pupil").svg;
    const answer = drawDiagram("triangle", e, "answer").svg;
    expect(pupil).not.toContain(">13<");
    expect(answer).toContain("13");
    expect(answer).toContain(`fill="${ANSWER}"`);
  });

  it("colours a probability tree's revealed answers, and leaves given labels black", () => {
    const e = createTree({ spec: { stages: [{ outcomes: ["H", "T"], probabilities: ["1/2", "1/2"] }], hide: "probabilities" } });
    const answer = drawDiagram("probability-tree", e, "answer").svg;
    expect(answer).toContain(`fill="${ANSWER}"`);
    expect(drawDiagram("probability-tree", e, "pupil").svg).not.toContain(ANSWER);
    const shown = createTree({ spec: { stages: [{ outcomes: ["H", "T"], probabilities: ["1/2", "1/2"] }] } });
    expect(drawDiagram("probability-tree", shown, "answer").svg).not.toContain(ANSWER);
  });

  it("colours a frequency tree's revealed answers", () => {
    const e = createFrequencyTree({ spec: { total: "40", groups: [{ name: "Girls", count: "18", children: [{ name: "Hot", count: "10" }, { name: "Cold", count: "8" }] }, { name: "Boys", count: "22", children: [{ name: "Hot", count: "12" }, { name: "Cold", count: "10" }] }], hide: "counts" } });
    expect(drawDiagram("frequency-tree", e, "answer").svg).toContain(`fill="${ANSWER}"`);
  });

  it("does not reject a tree for crowded end probabilities when only the outcome column is drawn", () => {
    const branches = [
      { id: "b1", parent: null, outcome: "H", probability: "1/2" },
      { id: "b2", parent: null, outcome: "T", probability: "1/2" },
      { id: "b3", parent: "b1", outcome: "H", probability: "1/2" },
      { id: "b4", parent: "b1", outcome: "T", probability: "1/2" },
      { id: "b5", parent: "b2", outcome: "H", probability: "1/2" },
      { id: "b6", parent: "b2", outcome: "T", probability: "1/2" },
    ];
    const e = createTree({ spec: { branches, settings: { endColumn: "outcome", gapMm: 10 } } });
    for (const b of e.document.branches) b.endProbability.text = "1/4";
    expect(() => FAMILIES["probability-tree"].validate(e, "pupil")).not.toThrow();
  });
});

describe("probability tree spec, round 2", () => {
  it("takes path-end answers in the spec, so an end column can hold saved answers without a second call", () => {
    const e = createTree({
      spec: {
        branches: [
          { id: "b1", parent: null, outcome: "H", probability: "1/2" },
          { id: "b2", parent: null, outcome: "T", probability: "1/2" },
          { id: "b3", parent: "b1", outcome: "H", probability: "1/2", endOutcome: "HH", endProbability: "1/4", hidden: ["endProbability"] },
          { id: "b4", parent: "b1", outcome: "T", probability: "1/2", endOutcome: "HT", endProbability: "1/4" },
          { id: "b5", parent: "b2", outcome: "H", probability: "1/2", endOutcome: "TH" },
          { id: "b6", parent: "b2", outcome: "T", probability: "1/2", endOutcome: "TT" },
        ],
        settings: { endColumn: "both", branchMm: 26 },
      },
    });
    const b3 = e.document.branches.find((b) => b.id === "b3")!;
    expect(b3.endProbability).toEqual({ text: "1/4", show: "hidden" });
    expect(drawDiagram("probability-tree", e, "pupil").svg).toContain(">HH<");
    expect(() =>
      createTree({ spec: { branches: [{ id: "b1", parent: null, outcome: "H", endOutcome: "H" }, { id: "b2", parent: null, outcome: "T" }, { id: "b3", parent: "b1", outcome: "H" }, { id: "b4", parent: "b1", outcome: "T" }] } }),
    ).toThrow(/last branch of a path/);
  });
});
