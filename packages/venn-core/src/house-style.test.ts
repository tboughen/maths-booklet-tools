import { describe, expect, it } from "vitest";
import { create, renderSvg, upgrade, validate } from "./index";
import { printFacts } from "./interchange";

describe("Venn house style (U111)", () => {
  it("prints bold lines 1.5 times as thick when the diagram saves bold lines", () => {
    for (const e of [create(2), upgrade(create(2))]) {
      const normal = renderSvg(e);
      e.document.lines = "bold";
      const bold = renderSvg(validate(e));
      expect(normal).toContain('stroke-width=".3"');
      expect(bold).not.toContain('stroke-width=".3"');
      expect(bold).toContain('stroke-width="0.45"');
    }
  });
  it("never accepts text below 10 pt", () => {
    const e = create(2);
    e.document.fontPt = 9;
    expect(() => validate(e)).toThrow();
  });
  it("still reports answer lines and keeps hatching weight on a bold diagram", () => {
    const e = upgrade(create(2));
    e.document.regions[3] = { kind: "text", text: "", visibility: "line", shade: "hatch" };
    const normal = printFacts(validate(e)).referenceFeatures.answerLineLengthsMm;
    e.document.lines = "bold";
    expect(normal.length).toBeGreaterThan(0);
    expect(printFacts(validate(e)).referenceFeatures.answerLineLengthsMm).toEqual(normal);
    expect(renderSvg(validate(e))).toContain('<path d="M-1,1L1,-1M0,2L2,0M1,3L3,1" stroke="#555" stroke-width=".18"/>');
  });
});
