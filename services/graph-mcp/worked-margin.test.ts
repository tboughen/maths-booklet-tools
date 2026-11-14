// @vitest-environment node
// U116: worked notes in the margin grow the answers copy's page, so its print size is that page's.
import { describe, expect, it } from "vitest";
import { FAMILIES, svgSizeMm } from "../../packages/diagram-core/src/registry";
import { diagramPrintInfo, diagramSource } from "./diagram-source";

describe("print information with worked notes in the margin", () => {
  it("reports the answers copy's grown page and leaves the pupil copy's size alone", async () => {
    const f = FAMILIES["ratio-table"];
    const plain = await f.create({});
    const envelope = f.validate({ ...(plain as object), worked: [{ text: "Multiply by 3", x: -30, y: 1, widthMm: 28 }] }, "pupil");
    const pupil = diagramPrintInfo(diagramSource({ kind: "ratio-table", envelope }));
    const answer = diagramPrintInfo(diagramSource({ kind: "ratio-table", envelope, outputView: "answer" }));
    const page = svgSizeMm(f.svg(envelope, "answer"));
    expect(answer.physicalSizeCm.width).toBeCloseTo(page.width / 10, 2);
    expect(answer.physicalSizeCm.width).toBeCloseTo(pupil.physicalSizeCm.width + 3.1, 2);
    expect(answer.physicalSizeCm.height).toBeCloseTo(pupil.physicalSizeCm.height, 2);
  });
});

describe("copy metrics for the graph and ratio-table tools", async () => {
  const { copyMetrics } = await import("./worked-size");
  it("follow a grown answers page and leave other copies alone", () => {
    const m = { width: 400, height: 200, widthCm: 4, heightCm: 2 };
    expect(copyMetrics('<svg width="40mm" height="20mm"><rect/></svg>', m)).toBe(m);
    const grown = copyMetrics('<svg width="71mm" height="20mm"><g data-layer="worked"></g></svg>', m);
    expect(grown).toEqual({ width: 710, height: 200, widthCm: 7.1, heightCm: 2 });
  });
});
