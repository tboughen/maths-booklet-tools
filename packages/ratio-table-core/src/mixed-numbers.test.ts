// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  applyRatioOperations,
  canonicalNumber,
  canonicalRatioNumber,
  createRatioTable,
  numberWidth,
  parseNumber,
  parseRatioNumber,
  renderRatioSvg,
  RATIO_ANSWER_COLOUR,
} from "./interchange";

// Mixed numbers in ratio-table cells (Tim, 14 Nov 2026): the school writes gradients as mixed
// numbers, and fractions always print stacked, including the fraction of a mixed number.

describe("reading mixed numbers", () => {
  it("accepts typed and Unicode mixed numbers and saves them as whole, space, fraction", () => {
    expect(canonicalRatioNumber("2 1/2")).toBe("2 1/2");
    expect(canonicalRatioNumber(" 2  1 / 2 ")).toBe("2 1/2");
    expect(canonicalRatioNumber("2½")).toBe("2 1/2");
    expect(canonicalRatioNumber("2 ½")).toBe("2 1/2");
    expect(canonicalRatioNumber("−1¾")).toBe("-1 3/4");
    expect(canonicalRatioNumber("+3 2/4")).toBe("3 1/2");
    expect(canonicalRatioNumber("12⅔")).toBe("12 2/3");
    expect(canonicalRatioNumber("½")).toBe("1/2");
    expect(parseRatioNumber("2 1/2")).toEqual({ n: 5n, d: 2n });
    expect(parseRatioNumber("-1 3/4")).toEqual({ n: -7n, d: 4n });
  });

  it("keeps every existing input and saved form exactly as before", () => {
    for (const input of ["3", "-1/2", "5/2", " +000.2500 ", "-2/-6", "−0.000", "0.1", "1000000"])
      expect(canonicalRatioNumber(input)).toBe(canonicalNumber(input));
  });

  it("rejects a mixed number whose fraction is not proper, with a specific message", () => {
    expect(() => parseRatioNumber("2 5/4")).toThrow(/fraction must be less than 1/);
    expect(() => parseRatioNumber("2 0/3")).toThrow(/fraction must be less than 1/);
    expect(() => parseRatioNumber("2 1/0")).toThrow(/zero denominator/);
    expect(() => parseRatioNumber("2 -1/2")).toThrow(/mixed number such as 2 1\/2/);
    expect(() => parseRatioNumber("2.5 1/2")).toThrow(/mixed number/);
  });

  it("leaves the shared parser for other tools unchanged", () => {
    expect(() => parseNumber("2 1/2")).toThrow(/fraction such as 2\/3/);
  });
});

describe("mixed numbers in tables", () => {
  const table = () =>
    createRatioTable({
      columns: ["x →", "y ↑"],
      table: [
        ["2", "5"],
        ["1", "[2½]_"],
      ],
      steps: ["÷ 2"],
    });

  it("saves given, hidden and factor values as mixed numbers", () => {
    const e = createRatioTable({ table: [["1", "2½"], ["2", "[5]"]], steps: ["× 1 1/2"] });
    expect(e.document.rows[0].cells[1]).toEqual({ kind: "number", value: "2 1/2" });
    expect(e.document.transitions[0].factor).toBe("1 1/2");
    expect(table().document.rows[1].cells[1]).toEqual({ kind: "hidden", value: "2 1/2", line: true });
  });

  it("prints the whole number beside a stacked fraction, in both copies, at one size", () => {
    const e = createRatioTable({ table: [["1", "-2 1/2"], ["2", "-5"]] });
    const svg = renderRatioSvg(e.document);
    const cell = svg.match(/data-row="row-1" data-column="1"[^>]*>(.*?)<\/g>/)![1];
    // Whole part at full size, fraction parts smaller with a bar between them.
    expect(cell).toMatch(/>−2</);
    expect(cell).toMatch(/>1<\/text><path d="M[\d.]+ 165H[\d.]+" stroke-width="2"\/><text[^>]*>2</);
    expect(cell).not.toContain("1/2");
    const sizes = [...cell.matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(sizes[0]).toBeGreaterThan(sizes[1]);
    expect(sizes[1]).toBe(sizes[2]);
    // The group is centred in the column: whole part to the left of centre, fraction to the right.
    const xs = [...cell.matchAll(/ x="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(xs[0]).toBeLessThan(240);
    expect(xs[1]).toBeGreaterThan(240);

    const t = table();
    const pupil = renderRatioSvg(t.document),
      answer = renderRatioSvg(t.document, "answer");
    expect(pupil).not.toContain(RATIO_ANSWER_COLOUR);
    expect(answer).toMatch(/ratio-hidden-answer[^]*>2<[^]*>1<[^]*>2</);
    expect(pupil.match(/<svg[^>]*>/)![0]).toBe(answer.match(/<svg[^>]*>/)![0]);
    // A stacked fraction never sits on the answer line in the answers copy.
    expect(answer.match(/ratio-answer-line/g)?.length ?? 0).toBeLessThan(pupil.match(/ratio-answer-line/g)!.length + 1);
  });

  it("measures a mixed number wider than its fraction alone", () => {
    expect(numberWidth("2 1/2")).toBeGreaterThan(numberWidth("1/2"));
    expect(numberWidth("-2 1/2")).toBeGreaterThan(numberWidth("2 1/2"));
  });

  it("fills the next row in mixed numbers when the table uses them, only when asked", () => {
    const e = createRatioTable({ table: [["1", "2 1/2"], ["", ""]], steps: ["× 3"] });
    const filled = applyRatioOperations(e, [{ op: "fill_next_row", from: "row-1" }]);
    expect(filled.document.rows[1].cells).toEqual([
      { kind: "number", value: "3" },
      { kind: "number", value: "7 1/2" },
    ]);
    const plain = createRatioTable({ table: [["1", "5/2"], ["", ""]], steps: ["× 3"] });
    expect(applyRatioOperations(plain, [{ op: "fill_next_row", from: "row-1" }]).document.rows[1].cells[1]).toEqual({ kind: "number", value: "15/2" });
  });
});

describe("headings with units", () => {
  it("accepts a slash in a heading, such as m/s, and measures it from the font", () => {
    const e = createRatioTable({ columns: ["t →", "m/s ↑"], table: [["1", "4"], ["2", "[8]"]] });
    expect(e.document.headings[1]).toEqual({ text: "m/s", italic: false, direction: "up" });
    expect(renderRatioSvg(e.document)).toContain(">m/s<");
    expect(() => createRatioTable({ columns: ["x", "m\\s"], table: [["1", "2"]] })).toThrow(/Invalid ratio table/);
  });
});
