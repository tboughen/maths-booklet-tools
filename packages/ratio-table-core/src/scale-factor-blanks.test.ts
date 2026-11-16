// @vitest-environment node
import { describe, expect, it } from "vitest";
import { applyRatioOperations, createRatioTable, ratioMetrics, ratioPrintFacts, renderRatioSvg } from "./interchange";

// Tim's A7 marking (16 Nov 2026): a hidden scale factor needs room to write "÷ 3" by hand, and a
// step may print on one side of the table only.

const lineWidths = (svg: string) =>
  [...svg.matchAll(/data-hidden="true"><path class="ratio-answer-line" d="M([\d.]+) [\d.]+H([\d.]+)/g)].map((m) => Number(m[2]) - Number(m[1]));

describe("hidden scale-factor blanks", () => {
  it("leaves pupils at least 12 mm to write a hidden operation at standard size", () => {
    const e = createRatioTable({ table: [["6", "9"], ["2", "3"]], steps: ["[÷ 3]"] });
    const widths = lineWidths(renderRatioSvg(e.document));
    expect(widths).toHaveLength(2);
    // 100 units = 1 cm at standard size.
    for (const w of widths) expect(w / 10).toBeGreaterThanOrEqual(12);
    expect(ratioPrintFacts(e.document).referenceFeatures.answerLineLengthsMm[0]).toBeGreaterThanOrEqual(12);
  });

  it("keeps both copies the same size", () => {
    const e = createRatioTable({ table: [["6", "9"], ["2", "3"]], steps: ["[÷ 3]"] });
    const open = (s: string) => s.match(/<svg[^>]*>/)![0];
    expect(open(renderRatioSvg(e.document))).toBe(open(renderRatioSvg(e.document, "answer")));
  });
});

describe("a step on one side only", () => {
  const both = createRatioTable({ table: [["6", "9"], ["2", "3"]], steps: ["÷ 3"] });
  const right = createRatioTable({ table: [["6", "9"], ["2", "3"]], steps: ["right: ÷ 3"] });
  const left = createRatioTable({ table: [["6", "9"], ["2", "3"]], steps: ["Left: [÷ 3]"] });

  it("saves the side on the transition and leaves it out for both sides", () => {
    expect(both.document.transitions[0]).not.toHaveProperty("side");
    expect(right.document.transitions[0]).toMatchObject({ operation: "divide", factor: "3", side: "right" });
    expect(left.document.transitions[0]).toMatchObject({ hidden: true, side: "left" });
  });

  it("prints one arrow and one operation, and the unused side takes no room", () => {
    const svg = renderRatioSvg(right.document);
    expect(svg.match(/ratio-scaling-arrow/g)).toHaveLength(1);
    expect(svg.match(/class="ratio-operation"/g)).toHaveLength(1);
    expect(renderRatioSvg(both.document).match(/ratio-scaling-arrow/g)).toHaveLength(2);
    const m = ratioMetrics(right.document), b = ratioMetrics(both.document);
    expect(m.tableLeft).toBe(15);
    expect(m.width).toBe(b.width - b.gutter);
    // The arrow sits right of the table.
    const x = Number(svg.match(/ratio-scaling-arrow"><path d="M([\d.]+)/)![1]);
    expect(x).toBeGreaterThan(m.tableLeft + m.tableWidth);
    const l = ratioMetrics(left.document);
    expect(l.tableLeft).toBeGreaterThan(15);
    expect(l.width).toBe(l.tableLeft + l.tableWidth + 15);
  });

  it("changes side through set_transition and refuses a side on a three-column table", () => {
    const moved = applyRatioOperations(both, [{ op: "set_transition", transition: { ...both.document.transitions[0], side: "left" } }]);
    expect(moved.document.transitions[0].side).toBe("left");
    expect(() => createRatioTable({ table: [["1", "2", "3"], ["2", "4", "6"]], steps: ["left: × 2"] })).toThrow(/two-column/);
    const wider = applyRatioOperations(right, [{ op: "add_column", heading: { text: "z", italic: true, direction: "none" } }]);
    expect(wider.document.transitions[0]).not.toHaveProperty("side");
  });
});
