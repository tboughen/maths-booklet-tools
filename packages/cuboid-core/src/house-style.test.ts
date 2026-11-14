import { describe, expect, it } from "vitest";
import { createCuboid, reviseCuboid, hash } from "./interchange";
import { canonical, renderSvg } from "./index";

describe("cuboid house style (U111)", () => {
  it("bold lines multiply strokes and normal lines are never saved", async () => {
    const plain = createCuboid({});
    const bold = createCuboid({ spec: { lines: "bold" } });
    expect(bold.document.lines).toBe("bold");
    expect(renderSvg(plain)).toContain('stroke-width="0.25"');
    expect(renderSvg(bold)).toContain('stroke-width="0.375"');
    const back = await reviseCuboid({ envelope: bold, baseHash: await hash(bold), operations: [{ op: "set_print", lines: "normal" }] });
    expect(back.document.lines).toBeUndefined();
    expect(canonical(back)).not.toContain('"lines"');
    await expect(reviseCuboid({ envelope: plain, baseHash: await hash(plain), operations: [{ op: "set_print" }] })).rejects.toThrow(/widthCm or lines/);
  });
});
