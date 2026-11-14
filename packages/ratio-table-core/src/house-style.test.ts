import { describe, expect, it } from "vitest";
import { createRatioTable, reviseRatioTable, ratioHash, canonicalRatio } from "./interchange";
import { renderRatioSvg, ratioPrintFacts } from "./svg";

describe("ratio table house style (U111)", () => {
  it("bold lines multiply strokes and normal lines are never saved", async () => {
    const plain = createRatioTable({});
    const bold = createRatioTable({ lines: "bold" });
    expect(bold.document.lines).toBe("bold");
    expect(renderRatioSvg(plain.document)).toContain('stroke-width="2"');
    expect(renderRatioSvg(bold.document)).toContain('stroke-width="3"');
    const back = await reviseRatioTable({ envelope: bold, baseHash: await ratioHash(bold), operations: [{ op: "set_lines", lines: "normal" }] });
    expect(back.document.lines).toBeUndefined();
    expect(canonicalRatio(back)).not.toContain('"lines"');
  });
  it("standard-size text is never below 10 pt", () => {
    const e = createRatioTable({ mode: "annotated", table: [["3", "1/2"], ["12", ""]], steps: ["× 4"] });
    const sizes = ratioPrintFacts(e.document).referenceFeatures.textSizesPt;
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(10 - 1e-6);
  });
});
