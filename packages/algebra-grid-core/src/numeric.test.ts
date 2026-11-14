import { describe, expect, it } from "vitest";
import {
  collectAnswer,
  create,
  example,
  fillProducts,
  layout,
  renderSvg,
  setCell,
  validate,
  warnings,
  workedCopy,
} from "./index";
import { placeValueParts, parseNumber, numberText, sum } from "./numeric";
import { create as aiCreate } from "./interchange";

describe("numeric grid method (U105)", () => {
  it("keeps decimals exact", () => {
    expect(numberText(sum(["0.1", "0.2"]))).toBe("0.3");
    expect(numberText(parseNumber("1,200.50"))).toBe("1200.5");
    expect(numberText(parseNumber(".5"))).toBe("0.5");
    expect(placeValueParts(parseNumber("47"))).toEqual(["40", "7"]);
    expect(placeValueParts(parseNumber("2.05"))).toEqual(["2", "0.05"]);
    expect(placeValueParts(parseNumber("306"))).toEqual(["300", "6"]);
    expect(() => parseNumber("2x")).toThrow(/number/);
  });
  it("prints the question and leaves pupil products blank", () => {
    const e = example("numeric");
    e.document.questionVisible = true;
    expect(e.document.mode).toBe("multiply");
    expect(layout(e).question).toBe("Work out 23 × 47");
    expect(e.document.rows[1].cells[1].value).toBeNull();
    expect(e.document.answer).toBe("");
    expect(renderSvg(e)).toContain('aria-label="Grid method multiplication"');
  });
  it("fills products and adds them only when asked", () => {
    const filled = fillProducts(example("numeric"));
    expect(
      filled.document.rows
        .slice(1)
        .map((r) => r.cells.slice(1).map((c) => c.value)),
    ).toEqual([
      ["800", "120"],
      ["140", "21"],
    ]);
    expect(collectAnswer(filled).document.answer).toBe("1081");
    const decimal = workedCopy(example("decimal"));
    expect(decimal.document.answer).toBe("8.84");
    expect(decimal.document.rows[2].cells[2].value).toBe("0.24");
  });
  it("splits blank headings by place value in the worked copy", () => {
    let e = create(3, 3);
    e.document.mode = "multiply";
    e.document.expression = "23 x 47";
    e = validate(e);
    const w = workedCopy(e);
    expect(w.document.rows[0].cells.slice(1).map((c) => c.value)).toEqual([
      "20",
      "3",
    ]);
    expect(w.document.rows.slice(1).map((r) => r.cells[0].value)).toEqual([
      "40",
      "7",
    ]);
    expect(w.document.answer).toBe("1081");
    // The source draft is untouched.
    expect(e.document.rows[0].cells[1].value).toBeNull();
    e.document.expression = "123 × 47";
    expect(() => workedCopy(e)).toThrow(/needs 3 columns and 2 rows/);
  });
  it("warns when headings do not split the multiplication or a product is wrong", () => {
    let e = example("numeric");
    e = setCell(e, 0, 1, "30");
    expect(warnings(e).join(" ")).toMatch(/add to 33 across and 47 down/);
    e = setCell(fillProducts(example("numeric")), 1, 1, "80");
    expect(warnings(e)).toContain(
      "Row 2, column 2 does not equal its headings' product.",
    );
  });
  it("refuses algebra in a numeric grid and a non-multiplication question", () => {
    const e = example("numeric");
    expect(() => setCell(e, 1, 1, "x")).toThrow(/number/);
    e.document.expression = "23 + 47";
    expect(() => validate(e)).toThrow(/multiplication of two numbers/);
  });
  it("is reachable from the connector", () => {
    const e = aiCreate({ spec: { example: "decimal" } });
    expect(e.document.expression).toBe("3.4 × 2.6");
  });
});
