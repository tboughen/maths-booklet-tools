import { describe, expect, it } from "vitest";
import { plainShapes } from "./plain";
import { renderSvg } from "./index";

describe("plain shapes", () => {
  it("each makes a valid solid that draws, with given lengths only", () => {
    for (const shape of plainShapes) {
      const e = shape.make();
      expect(renderSvg(e), shape.id).toContain("<svg");
      expect(e.document.dims.every((d) => d.label.state === "value"), shape.id).toBe(true);
      expect(e.document.angles, shape.id).toEqual([]);
    }
  });
  it("has a triangular prism with a three-cornered cross-section", () => {
    const prism = plainShapes.find((s) => s.id === "triangular-prism")!.make().document.solids[0];
    expect(prism.type === "prism" && prism.section.length).toBe(3);
  });
});
