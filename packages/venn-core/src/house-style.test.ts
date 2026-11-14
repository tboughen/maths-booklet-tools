import { describe, expect, it } from "vitest";
import { create, renderSvg, upgrade, validate } from "./index";

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
});
