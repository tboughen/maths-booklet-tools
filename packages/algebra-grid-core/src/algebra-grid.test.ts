import { describe, expect, it } from "vitest";
import {
  canonical,
  collectAnswer,
  collected,
  create,
  example,
  expandedExpression,
  exportIssue,
  factors,
  fillProducts,
  layout,
  normalTerm,
  parseFile,
  polynomial,
  polynomialText,
  renderSvg,
  resize,
  setCell,
  setSize,
  term,
  warnings,
  workedCopy,
} from "./index";

describe("departmental multiplication grids", () => {
  it("keeps the requested handwritten examples usable at the compact size", () => {
    for (const text of ["x^2", "-12x", "+24"]) {
      const e = setCell(setSize(create(), 12), 0, 1, text);
      expect(layout(e).issues).toEqual([]);
    }
  });
  it("checks printed bracket questions and flags saved answers after content edits", () => {
    expect(polynomialText(expandedExpression("(5x+2)(2x-3)"))).toBe(
      "10x^2-11x-6",
    );
    expect(() => expandedExpression("(x+2")).toThrow();
    let e = example("single");
    e.document.questionVisible = true;
    e = setCell(e, 1, 0, "4");
    expect(warnings(e)).toContain(
      "These headings do not match the printed question expression.",
    );
    e = setCell(example("single", true), 1, 1, "4x");
    expect(warnings(e).join(" ")).toContain("saved final answer");
  });
  for (const size of [12, 15, 18])
    for (const [rows, cols] of [
      [2, 3],
      [3, 3],
      [3, 4],
    ]) {
      it(`${rows} × ${cols} at ${size} mm preserves every writing cell and uses internal lines only`, () => {
        const e = setSize(create(rows, cols), size),
          svg = renderSvg(e),
          g = layout(e);
        expect([g.width, g.height]).toEqual([cols * size, rows * size]);
        expect(svg).toContain(
          `width="${cols * size}mm" height="${rows * size}mm"`,
        );
        expect(svg.match(/<line /g)).toHaveLength(rows + cols - 2);
        expect(svg).not.toMatch(/<rect[^>]*stroke=/);
        expect(svg).not.toContain("placeholder");
        expect(svg.match(/<text /g)).toHaveLength(1);
      });
    }
  for (const [name, result] of [
    ["single", "3x+12"],
    ["double", "x^2+5x+6"],
    ["signed", "x^2-x-6"],
    ["cubic", "x^3+6x^2+11x+12"],
    ["factor", "x^2+5x+6"],
    ["negative", "x^2+3x-10"],
    ["common", "x^2+4x"],
    ["source-expand", "10x^2-11x-6"],
    ["source-factor", "x^2+4x+3"],
  ]) {
    it(`checks the full ${name} worked grid independently of its scaffold`, () => {
      const scaffold = example(name),
        original = canonical(scaffold),
        answer = workedCopy(scaffold);
      expect(collected(answer)).toBe(result);
      expect(warnings(answer)).toEqual([]);
      expect(canonical(scaffold)).toBe(original);
      expect(parseFile(canonical(answer))).toEqual(answer);
    });
  }
  it("keeps signs and powers exact, normalises common keyboard notation, and rejects expressions in cells", () => {
    expect(normalTerm(" −12x² ")).toBe("-12x^2");
    expect(normalTerm("+24")).toBe("+24");
    expect(normalTerm("1x^0")).toBe("1");
    expect(() => term("x+3")).toThrow();
    expect(() => term("1/2x")).toThrow();
    expect(() => term("x^7")).toThrow();
    expect(() => term("y")).toThrow();
    expect(polynomialText(polynomial("x^2-3x+2x-6"))).toBe("x^2-x-6");
    for (const bad of ["x++2", "x--2", "x^2+", "", "alert(1)"])
      expect(() => polynomial(bad)).toThrow();
  });
  it("distinguishes empty, hidden and zero through round trips and resizing", () => {
    let e = setCell(example(), 1, 1, "0");
    e = setCell(e, 1, 2, "+3x", true);
    const saved = parseFile(
      canonical(resize(resize(e, "row", true), "column", true)),
    );
    expect(saved.document.rows[1].cells.slice(1, 4)).toEqual([
      { value: "0", hidden: false },
      { value: "+3x", hidden: true },
      { value: null, hidden: false },
    ]);
    expect((renderSvg(saved, true).match(/<text /g) ?? []).length).toBe(
      (renderSvg(saved).match(/<text /g) ?? []).length + 1,
    );
    expect(setCell(saved, 1, 2, null).document.rows[1].cells[2]).toEqual({
      value: null,
      hidden: false,
    });
  });
  it("preserves products when a heading changes and reports mismatches without fixing them", () => {
    const e = setCell(example("single", true), 1, 0, "4");
    expect(e.document.rows[1].cells[1].value).toBe("3x");
    expect(warnings(e).length).toBeGreaterThan(0);
    expect(exportIssue(e)).toMatch(/product/);
    e.document.intentionalError = true;
    expect(exportIssue(e)).toBe("");
  });
  it("keeps scaffold givens valid until headings exist, but checks the entire factorisation", () => {
    let e = example("factor");
    expect(warnings(e)).toEqual([]);
    expect(() => fillProducts(e)).toThrow(/headings/);
    e = setCell(setCell(e, 0, 2, "+1"), 2, 0, "+6");
    expect(warnings(e)).toContain(
      "These headings do not reproduce the whole target expression.",
    );
    expect(() => collectAnswer(e)).toThrow();
  });
  it("accepts swapped factor orientations, repeated roots, negative roots and zero constant", () => {
    const e = setCell(setCell(example("factor"), 0, 2, "+2"), 2, 0, "+3");
    expect(warnings(fillProducts(e))).toEqual([]);
    expect(factors(fillProducts(e))).toBe("(x+3)(x+2)");
    for (const [input, result] of [
      ["x^2-6x+9", "(x-3)(x-3)"],
      ["x^2-9", "(x-3)(x+3)"],
      ["x^2+3x", "(x+0)(x+3)"],
    ]) {
      const n = example("factor");
      n.document.expression = input;
      const answer = workedCopy(n);
      expect(polynomialText(polynomial(collected(answer)))).toBe(
        polynomialText(polynomial(input)),
      );
      expect(answer.document.answer).toBe(result);
    }
    const n = example("factor");
    n.document.expression = "x^2+x+1";
    expect(() => workedCopy(n)).toThrow(/integer/);
  });
  it("does not round large integer products or permit out-of-range products", () => {
    let e = create(2, 2);
    e = setCell(setCell(e, 0, 1, "999999"), 1, 0, "999999");
    expect(fillProducts(e).document.rows[1].cells[1].value).toBe(
      "999998000001",
    );
    e = setCell(e, 0, 1, "999999999999");
    expect(() => fillProducts(e)).toThrow(/coefficient/);
    e = setCell(setCell(create(2, 2), 0, 1, "x^4"), 1, 0, "x^3");
    expect(() => fillProducts(e)).toThrow(/power/);
  });
  it("supports common factors with negative and non-monic coefficients", () => {
    const e = example("common");
    e.document.expression = "6x^3-12x^2";
    const n = workedCopy(e);
    expect(n.document.answer).toBe("6x^2(x-2)");
    expect(collected(n)).toBe("6x^3-12x^2");
  });
  it("keeps paper and writing-space composition independent from cell sizes", () => {
    const e = example("cubic"),
      before = layout(e);
    e.document.paper = "A3";
    e.document.orientation = "landscape";
    expect(layout(e)).toEqual(before);
    e.document.columns[2].widthMm = 20;
    expect(layout(e).gridWidth).toBe(59);
    expect(layout(e).gridHeight).toBe(39);
    e.document.gridVisible = false;
    expect(renderSvg(e)).not.toContain("<text");
    expect(layout(e).gridWidth).toBe(59);
    e.document.questionVisible = true;
    e.document.answerLines = 2;
    expect(layout(e).height).toBe(68);
  });
  it("guards crowded labels, structural bounds, malformed documents and hidden blank data", () => {
    const e = setCell(create(), 0, 1, "999999999999x^6");
    expect(exportIssue(e)).toMatch(/crowded/);
    expect(() => resize(create(2, 2), "row", false)).toThrow();
    expect(() => resize(create(7, 7), "column", true)).toThrow();
    const n = create();
    n.document.rows[1].cells[1].hidden = true;
    expect(() => parseFile(JSON.stringify(n))).toThrow();
    expect(() => parseFile(" ".repeat(64001))).toThrow();
    expect(() => parseFile('{"kind":"wrong"}')).toThrow();
  });
});
