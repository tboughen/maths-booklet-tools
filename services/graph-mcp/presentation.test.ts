// @vitest-environment node
import { describe, expect, it } from "vitest";
import { Resvg } from "@resvg/resvg-js";
import { resolve } from "node:path";
import {
  cloneDefaultDocument,
  coordinateToSvg,
} from "../../packages/graph-core/src/diagram";
import {
  createGraph,
  documentFromEnvelope,
  graphHash,
  reviseGraph,
} from "../../packages/graph-core/src/interchange";
import {
  getExportMetrics,
  renderDiagramSvg,
} from "../../packages/graph-core/src/svg";
import type { DiagramDocumentV1 } from "../../packages/graph-core/src/types";

const font = {
  loadSystemFonts: false,
  fontFiles: [
    "STIXTwoText-Regular.otf",
    "STIXTwoText-Italic.otf",
    "STIXTwoMath-Regular.otf",
  ].map((name) => resolve("assets/graph-fonts", name)),
  defaultFontFamily: "STIX Two Text",
};
function isolated(svg: string, body: string) {
  const opening = svg
    .match(/<svg\b[^>]*>/)![0]
    .replace(/width="[^"]+"/, 'width="1200"')
    .replace(/height="[^"]+"/, 'height="1200"');
  return new Resvg(opening + body + "</svg>", { font, logLevel: "off" });
}
const cases = [
  { x: [5, 5, 1], y: [5, 5, 1] },
  { x: [2, 8, 0.5], y: [7, 3, 2] },
  { x: [0, 10, 2], y: [0, 10, 0.5] },
  { x: [10, 0, 0.5], y: [10, 0, 2] },
  { x: [9, 9, 0.5], y: [13, 13, 2] },
];
function documentFor(
  c: (typeof cases)[number],
  portable: boolean,
): DiagramDocumentV1 {
  const document = cloneDefaultDocument();
  if (portable) document.styleProfile = "portable-v1";
  for (const axis of ["x", "y"] as const) {
    const [negativeSquares, positiveSquares, scale] = c[axis];
    document.axes[axis] = {
      negativeSquares,
      positiveSquares,
      unitsPerSquare: scale as 0.5 | 1 | 2,
    };
  }
  return document;
}
describe("native axis presentation", () => {
  it("rasterizes an upward y arrow and a rightward x arrow", () => {
    const document = documentFor(cases[0], true);
    const svg = renderDiagramSvg(document);
    const metrics = getExportMetrics(document);
    const origin = coordinateToSvg({ x: 0, y: 0 }, metrics.layout);
    const defs = svg.match(/<defs>\s*<marker[^]*?<\/defs>/)![0];
    const axes = svg.match(/<g class="graph-axes"[^]*?<\/g>/)![0];
    const opening = svg
      .match(/<svg\b[^>]*>/)![0]
      .replace(/width="[^"]+"/, `width="${metrics.width}"`)
      .replace(/height="[^"]+"/, `height="${metrics.height}"`);
    const raster = new Resvg(opening + defs + axes + "</svg>", {
      font,
    }).render();
    const alphaAt = (x: number, y: number) =>
      raster.pixels[(Math.round(y) * raster.width + Math.round(x)) * 4 + 3];
    // Off-shaft pixels distinguish the triangle direction from its vertical stem.
    expect(alphaAt(origin.x - 8, metrics.layout.plotTop - 7)).toBeGreaterThan(
      240,
    );
    expect(alphaAt(origin.x + 8, metrics.layout.plotTop - 7)).toBeGreaterThan(
      240,
    );
    expect(alphaAt(metrics.layout.plotRight + 7, origin.y - 8)).toBeGreaterThan(
      240,
    );
    expect(alphaAt(metrics.layout.plotRight + 7, origin.y + 8)).toBeGreaterThan(
      240,
    );
  });
  it.each(cases)(
    "centres the upward and rightward arrowheads after native SVG conversion: %j",
    (c) => {
      for (const portable of [false, true]) {
        const document = documentFor(c, portable);
        const svg = renderDiagramSvg(document),
          { layout } = getExportMetrics(document);
        const origin = coordinateToSvg({ x: 0, y: 0 }, layout);
        const defs = svg.match(/<defs>\s*<marker[^]*?<\/defs>/)![0];
        const axes = svg.match(/<g class="graph-axes"[^]*?<\/g>/)![0];
        const lines = [...axes.matchAll(/<line[^>]*\/>/g)].map(
          (match) => match[0],
        );
        const attributes = axes.slice(0, axes.indexOf(">") + 1);
        const xBox = isolated(
          svg,
          defs + attributes + lines[0] + "</g>",
        ).getBBox()!;
        const yBox = isolated(
          svg,
          defs + attributes + lines[1] + "</g>",
        ).getBBox()!;
        // These are actual transformed arrow bounds, not source marker strings.
        expect(yBox.x + yBox.width / 2).toBeCloseTo(origin.x, 2);
        expect(yBox.width).toBeCloseTo(25, 2);
        expect(yBox.y).toBeLessThan(layout.plotTop - 25);
        expect(xBox.y + xBox.height / 2).toBeCloseTo(origin.y, 2);
        expect(xBox.height).toBeCloseTo(25, 2);
        expect(xBox.x + xBox.width).toBeGreaterThan(layout.plotRight + 25);
      }
    },
  );
  it.each(cases)(
    "keeps portable axis names inside the export and clear of the arrow: %j",
    (c) => {
      const document = documentFor(c, true);
      const svg = renderDiagramSvg(document),
        metrics = getExportMetrics(document);
      const origin = coordinateToSvg({ x: 0, y: 0 }, metrics.layout);
      const labels = svg.match(/<g class="axis-labels"[^>]*>/)![0];
      const name = (axis: "x" | "y") =>
        svg.match(
          new RegExp(
            '<text class="axis-name axis-name-' + axis + '"[^]*?<\\/text>',
          ),
        )![0];
      const x = isolated(svg, labels + name("x") + "</g>").getBBox()!;
      const y = isolated(svg, labels + name("y") + "</g>").getBBox()!;
      expect(metrics.width - (x.x + x.width)).toBeGreaterThanOrEqual(18);
      expect(y.y).toBeGreaterThanOrEqual(18);
      expect(origin.x - 12.5 - (y.x + y.width)).toBeGreaterThanOrEqual(8);
      expect(metrics.layout.square).toBe(100);
    },
  );
});
it("hides newly plotted equations by default and removes only a requested label", async () => {
  const spec = {
    schemaVersion: 1,
    objects: [
      {
        kind: "line",
        id: "main",
        equation: { kind: "slope", slope: 2, intercept: 1 },
      },
    ],
  };
  const plain = createGraph(spec);
  expect(renderDiagramSvg(documentFromEnvelope(plain))).not.toContain(
    "y = 2x + 1",
  );
  const labelled = createGraph({
    ...spec,
    objects: [{ ...spec.objects[0], equationVisible: true }],
  });
  expect(renderDiagramSvg(documentFromEnvelope(labelled))).toContain(
    "y = 2x + 1",
  );
  const hidden = await reviseGraph({
    envelope: labelled,
    baseHash: await graphHash(labelled),
    operations: [{ op: "set_label", id: "main", visible: false }],
  });
  expect(hidden).toEqual(plain);
});
