import { describe, expect, it } from "vitest";
import { apply as applyOperations, canonical, create, renderSvg } from "./index";

describe("number line house style (U111)", () => {
  it("bold lines multiply strokes and normal lines are never saved", () => {
    const plain = create();
    const bold = create({ lines: "bold" });
    expect(bold.document.lines).toBe("bold");
    expect(renderSvg(plain)).toContain('stroke-width=".2"');
    expect(renderSvg(bold)).toContain('stroke-width="0.3"');
    const back = applyOperations(bold, [{ op: "set_print", lines: "normal" }]);
    expect(back.document.lines).toBeUndefined();
    expect(canonical(back)).not.toContain('"lines"');
    expect(canonical(create({ lines: "normal" }))).not.toContain('"lines"');
    expect(() => applyOperations(plain, [{ op: "set_print" }])).toThrow(/widthCm or lines/);
  });
});
