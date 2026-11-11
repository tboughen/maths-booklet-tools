// @vitest-environment node
// Edexcel-style graphs: object names, axis titles, free scales, times of day, fine grids and an
// italic O at the origin. Saved graphs without these settings keep their hashes and artwork
// (checked byte for byte by src/gates/goldens.test.ts).
import { describe, expect, it } from "vitest";
import { TIME_GAP, axisTicks, formatTime } from "./axes";
import { getBounds, snapCoordinate } from "./diagram";
import {
  canonicalEnvelope,
  createGraph,
  decodeEnvelope,
  documentFromEnvelope,
  editorLink,
  graphHash,
  parseGraphFile,
  reviseGraph,
  describeGraph,
} from "./interchange";
import { isDiagramDocument } from "./legacy-validation";
import { renderedTextSizesPt } from "./print-guidance";
import { graphPrintFacts, renderDiagramSvg } from "./svg";

const travel = {
  axes: {
    x: { negativeSquares: 0, positiveSquares: 15, unitsPerSquare: 10, origin: 720, labelEvery: 3, format: "time", title: "Time of day" },
    y: { negativeSquares: 0, positiveSquares: 6, unitsPerSquare: 5, labelEvery: 2, title: "Distance from home (km)" },
  },
  grid: "2mm",
  objects: [
    { kind: "segment", id: "out", start: { x: 720, y: 0 }, end: { x: 765, y: 25 } },
    { kind: "segment", id: "stay", start: { x: 765, y: 25 }, end: { x: 810, y: 25 } },
    { kind: "segment", id: "home", start: { x: 810, y: 25 }, end: { x: 840, y: 0 } },
  ],
};
const named = {
  originLabel: "O",
  axes: {
    x: { negativeSquares: 1, positiveSquares: 5, unitsPerSquare: 1 },
    y: { negativeSquares: 7, positiveSquares: 2, unitsPerSquare: 1 },
  },
  objects: [
    { kind: "line", id: "l", equation: { kind: "slope", slope: 3, intercept: -6 }, name: "L1" },
    { kind: "point", id: "a", position: { x: 1, y: -3 }, name: "A'" },
  ],
};
const doc = (spec: unknown) => documentFromEnvelope(createGraph(spec));
const texts = (svg: string) => [...svg.matchAll(/<(?:text|tspan)\b[^>]*>([^<]+)</g)].map((m) => m[1]);

describe("Edexcel-style graphs", () => {
  it("numbers a travel graph with times of day from its own origin", () => {
    const d = doc(travel);
    expect(getBounds(d)).toEqual({ xMin: 720, xMax: 870, yMin: 0, yMax: 30 });
    expect(axisTicks(d, "x").map((t) => t.label)).toEqual(["12 00", "12 30", "13 00", "13 30", "14 00", "14 30"].map((t) => t.replace(" ", TIME_GAP)));
    expect(axisTicks(d, "y").map((t) => t.label)).toEqual(["0", "10", "20", "30"]);
    expect(formatTime(9 * 60 + 5)).toBe(`09${TIME_GAP}05`);
    const svg = renderDiagramSvg(d);
    // Titles replace the italic axis letters; both corner numbers print and never touch.
    expect(texts(svg)).toEqual(expect.arrayContaining(["Time of day", "Distance from", "home (km)", `12${TIME_GAP}00`, "0"]));
    expect(svg).not.toContain("axis-name");
    expect(svg).toContain("A 2 mm fine grid with heavier 1 cm lines");
  });

  it("draws a fine grid inside heavier 1 cm lines and reports both pitches", () => {
    const d = doc(travel);
    const svg = renderDiagramSvg(d);
    const fine = svg.match(/<g class="grid-lines grid-lines-fine"[^>]*>(.*?)<\/g>/)![1];
    // 15 x 6 squares of 1 cm, each split into five 2 mm squares.
    expect(fine.match(/<line/g)).toHaveLength(15 * 4 + 6 * 4);
    expect(graphPrintFacts(d).referenceFeatures.gridPitchMm).toEqual([2, 10]);
    expect(graphPrintFacts(doc({ ...travel, grid: "5mm" })).referenceFeatures.gridPitchMm).toEqual([5, 10]);
    expect(snapCoordinate({ x: 731, y: 3.4 }, 10, 5, 5, { x: 720, y: 0 })).toEqual({ x: 732, y: 3 });
  });

  it("prints bold line names, italic point names and an italic O", () => {
    const e = createGraph(named);
    const d = documentFromEnvelope(e);
    expect(d.objects.map((o) => o.name)).toEqual(["L1", "A′"]);
    const svg = renderDiagramSvg(d);
    const words = texts(svg);
    expect(words).toContain("𝐋");
    expect(words).toContain("𝟏");
    expect(words).toContain("𝐴′");
    expect(words).toContain("𝑂");
    expect(words).not.toContain("0");
    // Names sit inside the plot and print at 12 pt; subscripts at the 10 pt minimum.
    const facts = graphPrintFacts(d);
    expect(facts.referenceFeatures.textSizesPt).toEqual([10, 12]);
    const ptPerUnit = 72 / 2.54 / 100;
    expect(new Set(renderedTextSizesPt(svg, ptPerUnit).map((v) => Math.round(v)))).toEqual(new Set([10, 12]));
    expect(describeGraph(e)).toContain("named L₁");
  });

  it("accepts plain and subscript spellings of names and refuses anything else", () => {
    expect(doc({ objects: [{ kind: "point", position: { x: 1, y: 1 }, name: "L₂" }] }).objects[0].name).toBe("L2");
    for (const bad of ["a", "AB", "L123", "x1", ""])
      expect(() => createGraph({ objects: [{ kind: "point", position: { x: 1, y: 1 }, name: bad }] })).toThrow();
    expect(() => createGraph({ axes: { x: { negativeSquares: 0, positiveSquares: 5, unitsPerSquare: -1 }, y: { negativeSquares: 0, positiveSquares: 5, unitsPerSquare: 1 } }, objects: [] })).toThrow();
    expect(() => createGraph({ axes: { x: { negativeSquares: 0, positiveSquares: 5, unitsPerSquare: 1, title: " padded" }, y: { negativeSquares: 0, positiveSquares: 5, unitsPerSquare: 1 } }, objects: [] })).toThrow();
  });

  it("keeps every new setting through files, links, hashes and revisions", async () => {
    const e = createGraph({ ...travel, originLabel: "O", objects: [...travel.objects, { kind: "point", id: "p", position: { x: 765, y: 25 }, name: "P" }] });
    expect(parseGraphFile(JSON.stringify(e))).toEqual(e);
    const link = editorLink(e, "https://mathsdock.co.uk/");
    expect(decodeEnvelope(new URL(link).hash.slice("#graph=".length))).toEqual(JSON.parse(canonicalEnvelope(e)));
    expect(isDiagramDocument(documentFromEnvelope(e))).toBe(true);

    const revised = await reviseGraph({
      envelope: e,
      baseHash: await graphHash(e),
      operations: [
        { op: "set_name", id: "out", name: "L" },
        { op: "set_name", id: "p", position: { x: 780, y: 20 } },
        { op: "set_grid", grid: "1cm", originLabel: "0" },
      ],
    });
    const r = documentFromEnvelope(revised);
    expect(r.grid).toBeUndefined();
    expect(r.originLabel).toBeUndefined();
    expect(r.objects.find((o) => o.id === "out")?.name).toBe("L");
    expect(r.objects.find((o) => o.id === "p")?.namePosition).toEqual({ x: 780, y: 20 });
    expect(r.axes.x.title).toBe("Time of day");
    const cleared = await reviseGraph({ envelope: revised, baseHash: await graphHash(revised), operations: [{ op: "set_name", id: "p", name: null }] });
    expect(documentFromEnvelope(cleared).objects.find((o) => o.id === "p")).toEqual({ id: "p", kind: "point", position: { x: 765, y: 25 } });
    await expect(reviseGraph({ envelope: cleared, baseHash: await graphHash(cleared), operations: [{ op: "set_name", id: "p", position: { x: 1, y: 1 } }] })).rejects.toThrow(/needs a name/);
  });

  it("leaves graphs without the new settings exactly as they were", async () => {
    const plain = createGraph({ objects: [{ kind: "point", position: { x: 1, y: 2 } }] });
    expect(Object.keys(plain.document).sort()).toEqual(["axes", "objects", "selectedObjectId", "version"]);
    expect(Object.keys(plain.document.axes.x).sort()).toEqual(["negativeSquares", "positiveSquares", "unitsPerSquare"]);
    const svg = renderDiagramSvg(documentFromEnvelope(plain));
    expect(svg).toContain("A one centimetre square grid");
    expect(svg).not.toContain("object-name");
    expect(svg).not.toContain("axis-title");
    expect(texts(svg)).toContain("0");
  });
});
