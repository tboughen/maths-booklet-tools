// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  createGraph,
  decodeEnvelope,
  documentFromEnvelope,
  editorLink,
  encodeEnvelope,
  graphHash,
  parseGraphFile,
  reviseGraph,
  validateEnvelope,
} from "./interchange";
import { renderDiagramSvg } from "./svg";
const spec = {
  schemaVersion: 1,
  objects: [
    {
      kind: "line",
      id: "fraction",
      equation: { kind: "slope", slope: "1/2", intercept: -1 },
      equationVisible: true,
    },
    { kind: "line", id: "vertical", equation: { kind: "vertical", x: -2 } },
    {
      kind: "segment",
      id: "segment",
      start: { x: -2, y: 3 },
      end: { x: 2, y: 3 },
      strokeStyle: "dashed",
    },
    { kind: "point", id: "point", position: { x: 0, y: 0 } },
  ],
};
describe("portable graph interchange", () => {
  it("retains exact fractions, verticals, segments, labels and settings through files and links", () => {
    const graph = createGraph(spec);
    const file = parseGraphFile(JSON.stringify(graph));
    const url = new URL(
      editorLink(file, "https://tboughen.github.io/maths-booklet-tools/"),
    );
    const restored = decodeEnvelope(url.hash.slice(7));
    expect(restored).toEqual(graph);
    expect(restored.styleProfile).toBe("portable-v1");
    const svg = renderDiagramSvg(documentFromEnvelope(restored));
    expect(svg).toContain("STIX Two");
    expect(svg).toContain("stroke-dasharray");
    expect(svg).toContain("𝑥");
    expect(svg).toMatch(/width="[0-9.]+cm"/);
  });
  it("hashes equivalent JSON independently of key ordering and selection", async () => {
    const graph = createGraph(spec),
      reordered = structuredClone(graph);
    reordered.document = {
      selectedObjectId: "point",
      objects: graph.document.objects,
      axes: graph.document.axes,
      version: 1,
    };
    expect(await graphHash(reordered)).toBe(await graphHash(graph));
  });
  it("applies revisions atomically and retains every unchanged object", async () => {
    const graph = createGraph(spec),
      before = JSON.stringify(graph);
    const revised = await reviseGraph({
      envelope: graph,
      baseHash: await graphHash(graph),
      operations: [
        { op: "set_label", id: "fraction", visible: false },
        {
          op: "replace_object",
          id: "point",
          object: { kind: "point", position: { x: 4, y: 5 } },
        },
      ],
    });
    expect(revised.document.objects.slice(1, 3)).toEqual(
      graph.document.objects.slice(1, 3),
    );
    expect(revised.document.axes).toEqual(graph.document.axes);
    expect(JSON.stringify(graph)).toBe(before);
    await expect(
      reviseGraph({
        envelope: graph,
        baseHash: await graphHash(graph),
        operations: [
          { op: "remove_object", id: "point" },
          { op: "remove_object", id: "missing" },
        ],
      }),
    ).rejects.toThrow("missing");
    expect(JSON.stringify(graph)).toBe(before);
    await expect(
      reviseGraph({
        envelope: revised,
        baseHash: await graphHash(graph),
        operations: [],
      }),
    ).rejects.toThrow("exact graph");
  });
  it.each([
    { schemaVersion: 1, objects: [{ kind: "curve", expression: "x*x" }] },
    {
      schemaVersion: 1,
      objects: [{ kind: "point", position: { x: Infinity, y: 0 } }],
    },
    {
      schemaVersion: 1,
      objects: [
        { kind: "segment", start: { x: 1, y: 1 }, end: { x: 1, y: 1 } },
      ],
    },
    {
      schemaVersion: 1,
      objects: [
        {
          kind: "line",
          equation: { kind: "slope", slope: "1/0", intercept: 0 },
        },
      ],
    },
    { schemaVersion: 1, objects: [], script: "alert(1)" },
    {
      schemaVersion: 1,
      objects: Array.from({ length: 51 }, () => ({
        kind: "point",
        position: { x: 0, y: 0 },
      })),
    },
    {
      schemaVersion: 1,
      objects: [
        { kind: "point", id: "same", position: { x: 0, y: 0 } },
        { kind: "point", id: "same", position: { x: 0, y: 0 } },
      ],
    },
  ])("rejects unsupported or ambiguous requests %#", (bad) =>
    expect(() => createGraph(bad)).toThrow(),
  );
  it("refuses unknown versions and oversized links/files", () => {
    const graph = createGraph(spec);
    expect(() =>
      validateEnvelope({ ...graph, rendererVersion: "future" }),
    ).toThrow();
    expect(() => parseGraphFile(" ".repeat(1024 * 1024 + 1))).toThrow("1 MiB");
    const big = createGraph({
      schemaVersion: 1,
      objects: Array.from({ length: 50 }, (_, i) => ({
        kind: "line",
        id: "long-name-" + i,
        equation: { kind: "slope", slope: i / 3, intercept: i / 7 },
        equationVisible: true,
      })),
    });
    expect(() => editorLink(big, "https://example.com/")).toThrow("too large");
    expect(decodeEnvelope(encodeEnvelope(big))).toEqual(big);
  });
});
