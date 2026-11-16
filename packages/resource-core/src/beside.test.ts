import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { writeWorksheetDocx } from "./docx";
import { renderResource, validate, type Resource } from "./index";
import { BESIDE_GAP, countSpaces } from "./render";

// Two items side by side in one card, such as a small graph with its ratio table to the right
// (Tim, A7.04 marking, 15 Nov 2026).
const graph = { type: "diagram", diagram: { tool: "graph", spec: { axes: { x: { negativeSquares: 0, positiveSquares: 4, unitsPerSquare: 1 }, y: { negativeSquares: 0, positiveSquares: 5, unitsPerSquare: 1 } }, objects: [] } } };
const ratio = { type: "diagram", diagram: { tool: "ratio-table", spec: { columns: ["x →", "y ↑"], table: [["2", "-4"], ["1", "[-2]"]], steps: ["right: [÷ 2]"] } } };
// One side only: a hidden step leaves a 13 mm line (Tim, 16 Nov 2026), and both sides would not fit beside a graph in a third of the sheet.
const sheet = (items: unknown[], layout: "three" | "two" = "three"): Resource =>
  validate({
    tool: "resource",
    schemaVersion: 1,
    document: {
      kind: "worksheet-a3",
      title: "Beside",
      code: "TEST",
      objective: "Two items in a row",
      notation: "maths",
      sides: [
        { layout, columns: [{ heading: "A", cards: [{ title: "One", items }] }, ...(layout === "three" ? [{ heading: "B", cards: [] }, { heading: "C", cards: [] }] : [{ heading: "B", cards: [] }])] },
        { columns: [{ heading: "D", cards: [] }, { heading: "E", cards: [] }, { heading: "F", cards: [] }] },
      ],
    },
  } as never);

describe("beside: two items in one row", () => {
  it("puts the second item to the right of the first, at the same height", () => {
    const row = sheet([graph, { ...ratio, beside: true }]);
    const r = renderResource(row);
    expect(r.issues).toEqual([]);
    // Both diagrams are drawn at the top of the same row; the table starts right of the graph and gap.
    const placed = [...r.pages[0].matchAll(/<g transform="translate\(([\d.]+),([\d.]+)\)"><svg[^>]*width="([\d.]+)"/g)].map((m) => m.slice(1).map(Number));
    const [[gx, gy, gw], [tx, ty]] = placed.slice(-2);
    expect(ty).toBe(gy);
    expect(tx).toBeGreaterThanOrEqual(gx + gw + BESIDE_GAP - 0.01);
  });
  it("lets text take the rest of the row beside a diagram", () => {
    const doc = sheet([graph, { type: "text", text: "Read the movements from the triangle, then complete the ratio table.", beside: true }]);
    expect(renderResource(doc).issues).toEqual([]);
  });
  it("reports a row too wide for the card instead of shrinking a diagram", () => {
    const wide = { type: "diagram", diagram: { tool: "graph", spec: { axes: { x: { negativeSquares: 0, positiveSquares: 9, unitsPerSquare: 1 }, y: { negativeSquares: 0, positiveSquares: 3, unitsPerSquare: 1 } }, objects: [] } } };
    const issues = renderResource(sheet([wide, { ...ratio, beside: true }])).issues.map((i) => i.message);
    expect(issues.some((m) => /Two items side by side need [\d.]+ mm more width/.test(m))).toBe(true);
  });
  it("refuses beside on the first item, after a part, or as a third item in a row", () => {
    expect(() => sheet([{ ...ratio, beside: true }])).toThrow(/no item before it/);
    expect(() => sheet([{ type: "part", text: "Find it.", items: [] }, { ...ratio, beside: true }])).toThrow(/lettered part/);
    expect(() => sheet([graph, { ...ratio, beside: true }, { type: "text", text: "Third.", beside: true }])).toThrow(/Only two items share a row/);
    expect(() => sheet([{ type: "answerLine", prefix: "a", inline: true }, { type: "text", text: "x", beside: true }])).toThrow(/Inline answer lines/);
  });
  it("works inside a lettered part", () => {
    const doc = sheet([{ type: "part", text: "Find the gradient.", items: [graph, { ...ratio, beside: true }] }]);
    expect(renderResource(doc).issues).toEqual([]);
  });
  it("lays the row out in Word as a borderless table of two cells", async () => {
    const font = (seed: number) => Uint8Array.from({ length: 64 }, (_, i) => (i * 7 + seed) % 256);
    const { bytes, issues } = await writeWorksheetDocx(sheet([graph, { ...ratio, beside: true }]), {
      view: "pupil",
      fonts: { regular: font(1), semiBold: font(2), italic: font(3) },
      picture: (svg) => ({ svg, png: new Uint8Array([137, 80, 78, 71]) }),
    });
    expect(issues).toEqual([]);
    const xml = strFromU8(unzipSync(bytes)["word/document.xml"]);
    // Two pictures in one table row: a gridCol of 4 mm (227 twentieths of a point) sits between them.
    expect(xml).toMatch(/<w:gridCol w:w="227"\/>/);
  });
  it("pins the Word row to the page's height and shares spare height once", async () => {
    const font = (seed: number) => Uint8Array.from({ length: 64 }, (_, i) => (i * 7 + seed) % 256);
    const { bytes } = await writeWorksheetDocx(sheet([graph, { ...ratio, beside: true }]), {
      view: "pupil",
      fonts: { regular: font(1), semiBold: font(2), italic: font(3) },
      picture: (svg) => ({ svg, png: new Uint8Array([137, 80, 78, 71]) }),
    });
    const xml = strFromU8(unzipSync(bytes)["word/document.xml"]);
    expect(xml).toMatch(/<w:gridCol w:w="227"\/><w:gridCol[^>]*\/><\/w:tblGrid><w:tr><w:trPr><w:cantSplit\/><w:trHeight w:val="\d+" w:hRule="atLeast"\/>/);
    const space = { type: "space", heightMm: 20 };
    expect(countSpaces([space, { ...space, beside: true }] as never)).toBe(1);
    expect(countSpaces([graph, { ...space, beside: true }, space] as never)).toBe(2);
    expect(countSpaces([space, { ...space, beside: true }, { ...space, beside: true }] as never)).toBe(2);
  });
});
