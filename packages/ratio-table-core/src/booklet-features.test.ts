// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  applyRatioOperations,
  createRatioTable,
  describeRatio,
  parseRatioFile,
  ratioHash,
  ratioMetrics,
  ratioPrintFacts,
  ratioWarnings,
  renderRatioSvg,
  RATIO_ANSWER_COLOUR,
} from "./interchange";
import { drawDiagram } from "../../diagram-core/src/registry";

// Hidden answers, the down arrow and the compact form, which booklets need to use ratio tables
// in place of plain tables (Tim, 11 Nov 2026).

const gradient = () =>
  createRatioTable({
    columns: ["x →", "y ↓"],
    table: [
      ["2", "6"],
      ["1", "[3]"],
    ],
    steps: ["[÷ 2]"],
  });

describe("hidden answers", () => {
  it("leaves a hidden cell blank for pupils and prints it in the answer colour in the answers copy", () => {
    const e = createRatioTable({ table: [["4", "8"], ["1", "[2]"]] });
    expect(e.document.rows[1].cells[1]).toEqual({ kind: "hidden", value: "2" });
    const pupil = renderRatioSvg(e.document),
      answer = renderRatioSvg(e.document, "answer");
    expect(pupil).not.toContain(">2<");
    expect(pupil).not.toContain(RATIO_ANSWER_COLOUR);
    expect(answer).toContain(`fill="${RATIO_ANSWER_COLOUR}" x=`);
    expect(answer).toMatch(/ratio-hidden-answer[^]*>2</);
    // Both copies share one layout.
    expect(pupil.match(/<svg[^>]*>/)![0]).toBe(answer.match(/<svg[^>]*>/)![0]);
  });

  it("draws an answer line under a hidden answer when asked", () => {
    const e = createRatioTable({ table: [["4", "8"], ["1", "[2]_"]] });
    expect(e.document.rows[1].cells[1]).toEqual({ kind: "hidden", value: "2", line: true });
    expect(renderRatioSvg(e.document)).toContain("ratio-answer-line");
    expect(ratioPrintFacts(e.document)).toBeTruthy();
  });

  it("hides a scaling operation: an answer line for pupils, the label in the answers copy", () => {
    const e = gradient();
    expect(e.document.mode).toBe("annotated");
    expect(e.document.transitions).toEqual([{ from: "row-1", to: "row-2", operation: "divide", factor: "2", hidden: true }]);
    const pupil = renderRatioSvg(e.document),
      answer = renderRatioSvg(e.document, "answer");
    expect(pupil).toContain("ratio-scaling-arrow");
    expect(pupil).not.toContain("÷");
    expect(pupil).toMatch(/data-hidden="true"><path class="ratio-answer-line"/);
    expect(answer).toContain("÷");
    expect(pupil.match(/<svg[^>]*>/)![0]).toBe(answer.match(/<svg[^>]*>/)![0]);
    expect(describeRatio(e)).toContain("Hidden operations print only in the answers copy.");
  });

  it("reserves a full answer line for a hidden operation, never a shorter one", () => {
    const shown = createRatioTable({ table: [["2", "6"], ["1", "3"]], steps: ["÷ 2"] }),
      hidden = gradient();
    expect(ratioMetrics(hidden.document).gutter).toBeGreaterThan(ratioMetrics(shown.document).gutter);
    const [line] = ratioPrintFacts(hidden.document).referenceFeatures.answerLineLengthsMm;
    expect(line).toBeGreaterThanOrEqual(6);
  });

  it("checks hidden answers against the ratio without changing them", () => {
    const wrong = createRatioTable({ table: [["4", "8"], ["1", "[3]"]] });
    expect(ratioWarnings(wrong).join(" ")).toContain("different ratio");
    expect(wrong.document.rows[1].cells[1]).toEqual({ kind: "hidden", value: "3" });
  });

  it("asks before fill_next_row replaces a hidden answer", () => {
    const e = createRatioTable({ table: [["4", "8"], ["1", "[2]"]], steps: ["÷ 4"] });
    expect(() => applyRatioOperations(e, [{ op: "fill_next_row", from: "row-1" }])).toThrow(/Confirm/);
  });

  it("gives the booklet both copies through the shared diagram registry", () => {
    const e = gradient(),
      pupil = drawDiagram("ratio-table", e, "pupil"),
      answer = drawDiagram("ratio-table", e, "answer");
    expect(pupil.svg).not.toContain(">3<");
    expect(answer.svg).toContain(">3<");
    expect([pupil.widthMm, pupil.heightMm]).toEqual([answer.widthMm, answer.heightMm]);
  });

  it("saves one form per state and round-trips through the editable file", async () => {
    const e = createRatioTable({
      rows: [
        { cells: [{ kind: "number", value: "2" }, { kind: "number", value: "6" }] },
        { cells: [{ kind: "number", value: "1" }, { kind: "hidden", value: "3", line: false }] },
      ],
      transitions: [{ from: "row-1", to: "row-2", operation: "divide", factor: "2", hidden: false }],
    });
    expect(e.document.rows[1].cells[1]).toEqual({ kind: "hidden", value: "3" });
    expect(e.document.transitions[0]).not.toHaveProperty("hidden");
    const again = parseRatioFile(JSON.stringify(gradient()));
    expect(await ratioHash(again)).toBe(await ratioHash(gradient()));
  });
});

describe("down arrow headings", () => {
  it("draws y ↓ with the arrow head at the bottom", () => {
    const e = gradient();
    expect(e.document.headings).toEqual([
      { text: "x", italic: true, direction: "right" },
      { text: "y", italic: true, direction: "down" },
    ]);
    expect(renderRatioSvg(e.document)).toMatch(/l-5 -8h10Z/);
    expect(describeRatio(e)).toContain("y ↓");
  });
});

describe("compact form", () => {
  it("builds the same envelope as the full spec", async () => {
    const compact = createRatioTable({ columns: ["x →", "y ↑"], table: [["2", "4"], ["1", "_"], ["", "-1/2"]], steps: ["÷ 2", "x 3"] });
    const full = createRatioTable({
      headings: [
        { text: "x", italic: true, direction: "right" },
        { text: "y", italic: true, direction: "up" },
      ],
      rows: [
        { id: "row-1", cells: [{ kind: "number", value: "2" }, { kind: "number", value: "4" }] },
        { id: "row-2", cells: [{ kind: "number", value: "1" }, { kind: "answer-line" }] },
        { id: "row-3", cells: [{ kind: "empty" }, { kind: "number", value: "-1/2" }] },
      ],
      transitions: [
        { from: "row-1", to: "row-2", operation: "divide", factor: "2" },
        { from: "row-2", to: "row-3", operation: "multiply", factor: "3" },
      ],
      mode: "annotated",
    });
    expect(compact).toEqual(full);
    expect(await ratioHash(compact)).toBe(await ratioHash(full));
  });

  it("is a fraction of the full spec's size", () => {
    const compact = { columns: ["x →", "y ↑"], table: [["2", "4"], ["1", "[2]"]], steps: ["÷ 2"] };
    const full = {
      headings: [
        { text: "x", italic: true, direction: "right" },
        { text: "y", italic: true, direction: "up" },
      ],
      rows: [
        { cells: [{ kind: "number", value: "2" }, { kind: "number", value: "4" }] },
        { cells: [{ kind: "number", value: "1" }, { kind: "hidden", value: "2" }] },
      ],
      transitions: [{ from: "row-1", to: "row-2", operation: "divide", factor: "2" }],
      mode: "annotated",
    };
    expect(createRatioTable(compact)).toEqual(createRatioTable(full));
    expect(JSON.stringify(compact).length * 3).toBeLessThan(JSON.stringify(full).length);
  });

  it("keeps plain words upright and a single letter italic", () => {
    const e = createRatioTable({ columns: ["kg", "Cost"], table: [["1", "3"], ["2", "_"]] });
    expect(e.document.headings).toEqual([
      { text: "kg", italic: false, direction: "none" },
      { text: "Cost", italic: false, direction: "none" },
    ]);
  });

  it("explains a compact cell or step it cannot read", () => {
    expect(() => createRatioTable({ table: [["2", "?"]] })).toThrow();
    expect(() => createRatioTable({ table: [["2", "4_"]] })).toThrow(/answer line/);
    expect(() => createRatioTable({ table: [["2", "4"], ["1", "2"]], steps: ["half"] })).toThrow(/× 2/);
    expect(() => createRatioTable({ table: [["2", "4"]], steps: ["÷ 2"] })).toThrow(/one step for each gap/);
    expect(() => createRatioTable({ table: [["2", "4"]], rows: [{ cells: [{ kind: "empty" }] }] })).toThrow(/not both/);
    expect(() => createRatioTable({ steps: ["÷ 2"] })).toThrow(/steps go with table/);
  });
});
