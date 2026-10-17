import { describe, expect, it } from "vitest";
import { answerBelow, canonical, example, setCell, warnings } from "./index";

describe("answer below preserves the pupil scaffold", () => {
  it.each(["double", "factor", "common"])(
    "calculates %s without changing any cell",
    (name) => {
      const original = example(name),
        before = canonical(original);
      const result = answerBelow(original);
      expect(result.document.rows).toEqual(original.document.rows);
      expect(result.document.columns).toEqual(original.document.columns);
      expect(result.document.answerVisible).toBe(true);
      expect(result.document.answer).not.toBe("");
      expect(warnings(result)).toEqual([]);
      expect(canonical(original)).toBe(before);
      if (name === "double") expect(result.document.answer).toBe("x^2+5x+6");
      expect(warnings(setCell(result, 1, 1, "7x"))).toContain(
        "The saved final answer belongs to earlier entries. Hide it or calculate a new answer.",
      );
    },
  );
  it("rejects incorrect products and mismatched printed questions", () => {
    expect(() => answerBelow(setCell(example(), 1, 1, "8x"))).toThrow(
      "Correct the grid",
    );
    const mismatch = example();
    mismatch.document.questionVisible = true;
    mismatch.document.expression = "(x+1)(x+1)";
    expect(() => answerBelow(mismatch)).toThrow("Correct the grid");
  });
});
