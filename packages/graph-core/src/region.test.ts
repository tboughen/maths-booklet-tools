// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  createGraph,
  describeGraph,
  graphHash,
  graphWarnings,
  parseGraphFile,
  reviseGraph,
} from "./interchange";
import { renderDiagramSvg } from "./svg";
import { documentFromEnvelope } from "./interchange";
import {
  parseInequality,
  regionHalfPlanes,
  regionPolygon,
  polygonArea,
} from "./region";
import { isDiagramDocument } from "./legacy-validation";

const bounds = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
const region = (extra: Record<string, unknown> = {}) =>
  createGraph({
    objects: [
      {
        kind: "region",
        id: "r",
        inequalities: ["y > 2x − 1", "x ≤ 3", "y >= 0"],
        name: "R",
        ...extra,
      },
    ],
  });

describe("inequality regions (U73)", () => {
  it("reads the forms exam questions use", () => {
    expect(parseInequality("y > 2x − 1")).toEqual([
      { a: -2, b: 1, c: 1, strict: true },
    ]);
    expect(parseInequality("x ≤ 3")).toEqual([
      { a: -1, b: 0, c: 3, strict: false },
    ]);
    expect(parseInequality("x + y < 6")[0]).toMatchObject({
      a: -1,
      b: -1,
      c: 6,
      strict: true,
    });
    expect(parseInequality("y >= 1/2x + 1")[0].a).toBe(-0.5);
    expect(parseInequality("y < x/2")[0].a).toBe(0.5);
    expect(parseInequality("-2 < x <= 3")).toHaveLength(2);
    for (const bad of [
      "y = 2x",
      "2 < 3",
      "y > 2z",
      "y >",
      "1 < x > 2",
      "y > > x",
    ])
      expect(() => parseInequality(bad), bad).toThrow();
  });
  it("clips the grid to the wanted region exactly", () => {
    const polygon = regionPolygon(
      regionHalfPlanes({ inequalities: ["y >= 0", "x >= 0", "x + y <= 4"] }),
      bounds,
    );
    expect(polygonArea(polygon)).toBeCloseTo(8);
    expect(
      regionPolygon(regionHalfPlanes({ inequalities: ["y > 6"] }), bounds),
    ).toEqual([]);
  });
  it("shades under the grid, dashes strict boundaries and prints the name upright", () => {
    const svg = renderDiagramSvg(documentFromEnvelope(region()));
    expect(svg.indexOf('class="graph-region"')).toBeGreaterThan(-1);
    expect(svg.indexOf('class="graph-region"')).toBeLessThan(
      svg.indexOf("<line"),
    );
    expect(svg).toContain('fill="#d4d4d4"');
    const boundaries = svg.match(/<line class="region-boundary"[^>]*>/g)!;
    expect(boundaries).toHaveLength(3);
    expect(
      boundaries.filter((b) => b.includes("stroke-dasharray")),
    ).toHaveLength(1);
    expect(svg).toMatch(/object-name-region[^>]*>.*>R</s);
  });
  it("shades the unwanted side with even-odd, leaving the region clear", () => {
    const svg = renderDiagramSvg(
      documentFromEnvelope(region({ shade: "unwanted" })),
    );
    const d = svg.match(/class="graph-region"[^>]* d="([^"]+)"/)![1];
    expect(d.match(/M /g)).toHaveLength(2);
  });
  it("keeps the pupil copy unshaded for a hidden answer", () => {
    const doc = documentFromEnvelope(region({ answerOnly: true }));
    expect(renderDiagramSvg(doc, "pupil")).not.toContain("graph-region");
    const answers = renderDiagramSvg(doc, "answer");
    expect(answers).toContain("graph-region-answer");
    expect(answers).toContain('fill-opacity="0.22"');
  });
  it("draws no boundaries when the lines are separate objects", () => {
    expect(
      renderDiagramSvg(documentFromEnvelope(region({ boundaries: false }))),
    ).not.toContain("region-boundary");
  });
  it("round-trips through files, hashes and revisions, and refuses bad inequalities", async () => {
    const graph = region();
    const file = parseGraphFile(JSON.stringify(graph));
    expect(await graphHash(file)).toBe(await graphHash(graph));
    expect(isDiagramDocument(documentFromEnvelope(graph))).toBe(true);
    const revised = await reviseGraph({
      envelope: graph,
      baseHash: await graphHash(graph),
      operations: [
        {
          op: "replace_object",
          id: "r",
          object: {
            kind: "region",
            inequalities: ["y < 3"],
            shade: "unwanted",
          },
        },
      ],
    });
    expect(revised.document.objects[0]).toMatchObject({
      kind: "region",
      inequalities: ["y < 3"],
      shade: "unwanted",
      boundaries: true,
    });
    expect(() => region({ inequalities: ["y = 2x"] })).toThrow(
      /inequality sign/,
    );
    const broken = structuredClone(graph);
    (broken.document.objects[0] as { inequalities: string[] }).inequalities = [
      "y > 2z",
    ];
    expect(() => parseGraphFile(JSON.stringify(broken))).toThrow();
  });
  it("warns about an empty region and describes it", () => {
    const empty = region({ inequalities: ["y > 4", "y < 3"] });
    expect(graphWarnings(empty).join(" ")).toMatch(
      /no part of the grid satisfies/,
    );
    expect(describeGraph(region())).toMatch(
      /region y > 2x − 1, x ≤ 3, y >= 0 named R, region shaded/,
    );
  });
});
