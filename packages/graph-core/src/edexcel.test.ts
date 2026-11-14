// @vitest-environment node
// Edexcel-style graphs: object names, axis titles, free scales, times of day, fine grids and an
// italic O at the origin. Saved graphs without these settings keep their hashes and artwork
// (checked byte for byte by src/gates/goldens.test.ts).
import { describe, expect, it } from "vitest";
import { TIME_GAP, axisTicks, formatTime } from "./axes";
import { coordinateToSvg, getBounds, snapCoordinate } from "./diagram";
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
import { getExportMetrics, graphPrintFacts, pointLabelPlacement, renderDiagramSvg } from "./svg";

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

describe("answer-only objects", () => {
  const spec = {
    objects: [
      { kind: "point", id: "given", position: { x: 1, y: 2 }, name: "A" },
      { kind: "line", id: "drawn", equation: { kind: "slope", slope: 2, intercept: -1 }, answerOnly: true, name: "L" },
      { kind: "point", id: "plotted", position: { x: -2, y: 3 }, answerOnly: true },
    ],
  };
  it("leave the pupil copy blank and draw the answers copy in the answer colour at the same size", async () => {
    const e = createGraph(spec);
    const d = documentFromEnvelope(e);
    expect(d.objects.map((o) => o.answerOnly)).toEqual([undefined, true, true]);
    const pupil = renderDiagramSvg(d);
    const answer = renderDiagramSvg(d, "answer");
    expect(pupil).not.toContain("#b0125b");
    expect(pupil).not.toContain("𝐋");
    expect(pupil).toContain("𝐴");
    expect(answer).toContain('class="graph-answers" stroke="#b0125b"');
    expect(answer).toContain("object-name-answer");
    const size = (svg: string) => svg.match(/width="[\d.]+cm" height="[\d.]+cm"/)![0];
    expect(size(answer)).toBe(size(pupil));
    expect(describeGraph(e)).toContain("answer only");
    // The flag survives links and revisions, and can be taken off again.
    const link = editorLink(e, "https://mathsdock.co.uk/");
    expect(decodeEnvelope(new URL(link).hash.slice("#graph=".length)).document.objects[1].answerOnly).toBe(true);
    const revised = await reviseGraph({ envelope: e, baseHash: await graphHash(e), operations: [{ op: "replace_object", id: "plotted", object: { kind: "point", position: { x: -2, y: 3 } } }] });
    expect(documentFromEnvelope(revised).objects[2]).toEqual({ id: "plotted", kind: "point", position: { x: -2, y: 3 } });
    expect(isDiagramDocument(d)).toBe(true);
  });
});

describe("crowded axis numbers", () => {
  it("warns when times of day on every line would touch, and not for ordinary graphs", async () => {
    const { graphWarnings } = await import("./interchange");
    const crowded = createGraph({ axes: { x: { negativeSquares: 0, positiveSquares: 10, unitsPerSquare: 15, origin: 540, format: "time" }, y: { negativeSquares: 0, positiveSquares: 5, unitsPerSquare: 1 } }, objects: [] });
    expect(graphWarnings(crowded)[0]).toMatch(/touch at print size/);
    const spaced = createGraph({ axes: { x: { negativeSquares: 0, positiveSquares: 10, unitsPerSquare: 15, origin: 540, format: "time", labelEvery: 2 }, y: { negativeSquares: 0, positiveSquares: 5, unitsPerSquare: 1 } }, objects: [] });
    expect(graphWarnings(spaced)).toEqual([]);
    const wide = createGraph({ axes: { x: { negativeSquares: 9, positiveSquares: 9, unitsPerSquare: 2 }, y: { negativeSquares: 5, positiveSquares: 5, unitsPerSquare: 1 } }, objects: [] });
    expect(graphWarnings(wide)).toEqual([]);
  });
});

describe("sketch axes", () => {
  const sketch = {
    grid: "none",
    originLabel: "O",
    axes: {
      x: { negativeSquares: 3, positiveSquares: 4, unitsPerSquare: 1 },
      y: { negativeSquares: 3, positiveSquares: 4, unitsPerSquare: 1 },
    },
    objects: [
      {
        kind: "line",
        id: "l",
        equation: { kind: "slope", slope: -1.5, intercept: 3 },
        answerOnly: true,
        labels: [{ at: { x: 0, y: 3 }, text: "3" }, { at: { x: 2, y: 0 }, text: "2" }, { at: { x: 4, y: -3 }, text: "(4, -3)", side: "left" }],
      },
    ],
  };

  it("draw only the axes, x, y and O, with the sketch and its labels on the answers copy alone", () => {
    const e = createGraph(sketch);
    const d = documentFromEnvelope(e);
    expect(axisTicks(d, "x")).toEqual([]);
    expect(axisTicks(d, "y")).toEqual([]);
    const pupil = renderDiagramSvg(d);
    const answer = renderDiagramSvg(d, "answer");
    expect(pupil).not.toContain("grid-lines");
    expect(pupil).not.toContain("axis-number\"");
    expect(texts(pupil).filter((t) => /[0-9]/.test(t))).toEqual([]);
    expect(texts(pupil)).toContain("𝑂");
    expect(pupil).not.toContain("point-labels");
    expect(pupil).not.toContain("#b0125b");
    expect(pupil).toContain("Sketch axes with no grid or numbers");
    expect(answer).toContain('class="point-labels point-labels-answer" fill="#b0125b"');
    // Each label prints once in ink, over a white outline that keeps the line clear of it.
    expect(texts(answer).filter((t) => t === "3")).toHaveLength(2);
    expect(texts(answer)).toContain("(4, −3)");
    expect(graphPrintFacts(d).referenceFeatures.gridPitchMm).toEqual([]);
    expect(describeGraph(e)).toContain("Sketch axes");
    expect(describeGraph(e)).toContain('labelled "3" at (0, 3)');
    expect(isDiagramDocument(d)).toBe(true);
    expect(parseGraphFile(JSON.stringify(e))).toEqual(e);
  });

  it("place a label in the corner the line leaves free", () => {
    const d = doc(sketch);
    const line = d.objects[0] as import("./types").StraightObject;
    const layout = getExportMetrics(d).layout;
    const at = (x: number, y: number) => coordinateToSvg({ x, y }, layout);
    // A falling line crosses the y-axis going up to the left, so its label sits below-left.
    const y = pointLabelPlacement(d, line, line.labels![0], layout);
    expect(y.anchor).toBe("end");
    expect(y.baseline).toBeGreaterThan(at(0, 3).y);
    // On the x-axis it sits below, to the left of a falling line.
    const x = pointLabelPlacement(d, line, line.labels![1], layout);
    expect(x.anchor).toBe("end");
    expect(x.baseline).toBeGreaterThan(at(2, 0).y);
    const rising = { ...line, start: { x: -1, y: -1 }, end: { x: 1, y: 1 } };
    expect(pointLabelPlacement(d, rising, { at: { x: 0, y: 3 }, text: "3" }, layout).baseline).toBeLessThan(at(0, 3).y);
  });

  it("refuses labels that are too long, padded or off the axes", () => {
    const line = (labels: unknown) => ({ ...sketch, objects: [{ ...sketch.objects[0], labels }] });
    expect(() => createGraph(line([{ at: { x: 0, y: 3 }, text: "x".repeat(17) }]))).toThrow();
    expect(() => createGraph(line([{ at: { x: 0, y: 3 }, text: " 3" }]))).toThrow();
    expect(() => createGraph(line([{ at: { x: 9, y: 3 }, text: "3" }]))).toThrow(/outside the axes/);
    expect(() => createGraph(line([{ at: { x: 0, y: 3 }, text: "3", side: "middle" }]))).toThrow();
    expect(() => createGraph(line(Array(5).fill({ at: { x: 0, y: 3 }, text: "3" })))).toThrow();
  });

  it("keep labels through links, hashes and revisions", async () => {
    const e = createGraph(sketch);
    const link = editorLink(e, "https://mathsdock.co.uk/");
    expect(decodeEnvelope(new URL(link).hash.slice("#graph=".length))).toEqual(JSON.parse(canonicalEnvelope(e)));
    const revised = await reviseGraph({
      envelope: e,
      baseHash: await graphHash(e),
      operations: [
        { op: "replace_object", id: "l", object: { kind: "line", equation: { kind: "slope", slope: 1, intercept: 2 }, labels: [{ at: { x: 0, y: 2 }, text: "2" }] } },
        { op: "set_grid", grid: "1cm" },
      ],
    });
    const r = documentFromEnvelope(revised);
    expect(r.grid).toBeUndefined();
    expect(r.objects[0]).toMatchObject({ labels: [{ at: { x: 0, y: 2 }, text: "2" }] });
    expect(r.objects[0].answerOnly).toBeUndefined();
  });
});

describe("axis numbers over lines", () => {
  it("draws axis numbers after plotted lines and before points and names", () => {
    const svg = renderDiagramSvg(doc({ objects: [{ kind: "line", equation: { kind: "slope", slope: 3, intercept: -1 }, name: "L" }, { kind: "point", position: { x: 2, y: 1 }, name: "A" }] }));
    const line = svg.indexOf("<line x1", svg.indexOf('clip-path="url(#plot-clip)">'));
    const numbers = svg.indexOf('class="axis-labels"');
    const cross = svg.indexOf('fill="none"><path d="M');
    expect(line).toBeGreaterThan(0);
    expect(numbers).toBeGreaterThan(line);
    expect(cross).toBeGreaterThan(numbers);
    expect(svg.indexOf("object-names")).toBeGreaterThan(numbers);
    // Names have a white outline, not a white box that would cut grid lines.
    const name = svg.match(/<g class="object-name object-name-straight"[^>]*>(.*?)<\/g>/)![1];
    expect(name).not.toContain("<rect");
    expect(name).toContain('stroke="#ffffff"');
  });
});

describe("point coordinates", () => {
  const spec = {
    objects: [
      { kind: "point", id: "a", position: { x: 2, y: -3 }, name: "A", coordinates: "show" },
      { kind: "point", id: "b", position: { x: -1, y: 4 }, name: "B", coordinates: "blank" },
      { kind: "point", id: "c", position: { x: 1, y: 1 } },
    ],
  };
  it("print A(2, −3), leave a blank for pupils and show the saved point only on the answers copy", () => {
    const d = documentFromEnvelope(createGraph(spec));
    const pupil = renderDiagramSvg(d);
    const answer = renderDiagramSvg(d, "answer");
    expect(pupil).toContain("(2, −3)");
    expect(pupil).toContain("( ……… , ……… )");
    expect(pupil).not.toContain("(−1, 4)");
    expect(answer).toContain("(−1, 4)");
    expect(answer).toContain('point-coordinates-answer" fill="#b0125b"');
    expect(answer).not.toContain("……");
    const size = (svg: string) => svg.match(/width="[\d.]+cm" height="[\d.]+cm"/)![0];
    expect(size(answer)).toBe(size(pupil));
    // The point without coordinates saves without the field.
    expect("coordinates" in d.objects[2]).toBe(false);
    expect(isDiagramDocument(d)).toBe(true);
    expect(isDiagramDocument({ ...d, objects: [{ ...d.objects[0], coordinates: "maybe" }] })).toBe(false);
  });
  it("keep a graph without coordinates byte for byte", () => {
    const without = { objects: spec.objects.map((o) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== "coordinates"))) };
    const d = documentFromEnvelope(createGraph(without));
    expect(renderDiagramSvg(d)).not.toContain("point-coordinates");
  });
});
