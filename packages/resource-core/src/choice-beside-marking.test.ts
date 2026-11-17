import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { writeWorksheetDocx } from "./docx";
import { renderResource, validate, type Resource } from "./index";
import { LETTERS } from "./render";
import { createRatioTable, ratioBottomBaselineMm } from "../../ratio-table-core/src/interchange";

// Tim's marking of the A7.03 booklet pilot, 17 November 2026 (booklet standard 0.2, section 4b).
// N6: multiple choice spread across the card with room to circle, letters on one line ("wibbly
// wobbly, uppy downy" before). N5: "Gradient =" level with the bottom row of the ratio table beside it.

const sheet = (items: unknown[]): Resource =>
  validate({
    tool: "resource",
    schemaVersion: 1,
    document: {
      kind: "worksheet-a3",
      title: "Marking",
      code: "TEST",
      objective: "Choices and rows",
      notation: "maths",
      sides: [
        { layout: "two", columns: [{ heading: "A", cards: [{ title: "One", items }] }, { heading: "B", cards: [] }] },
        { columns: [{ heading: "C", cards: [] }, { heading: "D", cards: [] }, { heading: "E", cards: [] }] },
      ],
    },
  } as never);
const options = { view: "pupil" as const, fonts: { regular: new Uint8Array(8), semiBold: new Uint8Array(8), italic: new Uint8Array(8) }, picture: (svg: string) => ({ svg, png: new Uint8Array([137, 80, 78, 71]) }) };

/** Each lettered option's group: its x and y in the choice, and its ring's centre height. */
const rings = (svg: string) => [...svg.matchAll(/<g transform="translate\(([\d.-]+),([\d.-]+)\)"><circle cx="2.5" cy="([\d.-]+)" r="2.5"/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]), cy: Number(m[3]) }));

describe("lettered multiple choice (N6)", () => {
  it("spreads four options across the card in equal columns, every letter on one line", () => {
    const page = renderResource(sheet([{ type: "text", text: "What is the gradient?" }, { type: "choice", mode: "letters", options: ["5", "{5/6}", "{6/5}", "6"], answer: 1 }])).pages[0];
    const r = rings(page);
    expect(r).toHaveLength(4);
    // One row: the same height, the same ring centre, equal steps across.
    expect(new Set(r.map((o) => o.y)).size).toBe(1);
    expect(new Set(r.map((o) => o.cy)).size).toBe(1);
    const steps = r.slice(1).map((o, i) => o.x - r[i].x);
    for (const s of steps) expect(s).toBeCloseTo(steps[0], 1);
    expect(steps[0]).toBeGreaterThan(30);
  });

  it("drops a whole-number option onto the line its stacked neighbours sit on", () => {
    const page = renderResource(sheet([{ type: "choice", mode: "letters", options: ["5", "{5/6}", "{6/5}", "6"] }])).pages[0];
    // The plain options are moved down to the fractions' baseline; the fraction options are not moved.
    const drops = [...page.matchAll(/r="2.5"[^/]*\/><text[^>]*>(?:<tspan[^>]*>)?[A-D](?:<\/tspan>)?<\/text><g transform="translate\(0,([\d.]+)\)">/g)].map((m) => Number(m[1]));
    expect(drops).toHaveLength(4);
    expect(drops[0]).toBeGreaterThan(0.5);
    expect(drops[0]).toBeCloseTo(drops[3], 5);
    expect(drops[1]).toBe(0);
    expect(drops[2]).toBe(0);
  });

  it("leaves room to circle between rows when the options take two columns", () => {
    const long = ["Divide the up by the right", "Divide the right by the up", "Subtract the movements", "Read the coordinates"];
    const page = renderResource(sheet([{ type: "choice", mode: "letters", options: long }])).pages[0];
    const r = rings(page);
    expect(r.map((o) => o.y)).toEqual([r[0].y, r[0].y, r[2].y, r[2].y]);
    expect(r[1].x).toBeGreaterThan(r[0].x);
    expect(r[2].x).toBe(r[0].x);
    // At least the row gap below a one-line row.
    expect(r[2].y - r[0].y).toBeGreaterThanOrEqual(LETTERS.rowGap + 5);
  });

  it("gives every option in a row with a stacked fraction the same line in Word", async () => {
    const { bytes } = await writeWorksheetDocx(sheet([{ type: "choice", mode: "letters", options: ["5", "{5/6}", "{6/5}", "6"] }]), options);
    const xml = strFromU8(unzipSync(bytes)["word/document.xml"]);
    const lines = ["A", "B", "C", "D"].map((l) => {
      const at = xml.indexOf(`>\u00a0${l}\u00a0</w:t>`);
      const p = xml.lastIndexOf("<w:p>", at);
      return xml.slice(p, at).match(/w:line="(\d+)"/)?.[1];
    });
    expect(lines.every(Boolean)).toBe(true);
    expect(new Set(lines).size).toBe(1);
  });
});

describe("beside a ratio table (N5)", () => {
  const spec = { columns: ["x →", "y ↑"], table: [["2", "6"], ["1", "3"]], steps: ["÷ 2"] };
  const ratio = { type: "diagram", diagram: { tool: "ratio-table", spec } };
  const foot = ratioBottomBaselineMm(createRatioTable(spec).document);

  /** The ratio table's top and height, and the beside item's top and its last text baseline inside it. */
  function placed(page: string) {
    const table = page.match(/<g transform="translate\([\d.-]+,([\d.-]+)\)"><svg[^>]*height="([\d.]+)"[^>]*aria-label="Ratio table"/);
    const text = page.match(/<g transform="translate\([\d.-]+,([\d.-]+)\)">(?:<text[^>]*>[^<]*<\/text>)*<text x="[\d.-]+" y="([\d.]+)"[^>]*>(?:<tspan[^>]*>)?Gradient/);
    expect(table && text).toBeTruthy();
    return { tableTop: Number(table![1]), tableH: Number(table![2]), textTop: Number(text![1]), baseline: Number(text![2]) };
  }

  it("puts text beside a ratio table level with the table's bottom row", () => {
    const p = placed(renderResource(sheet([ratio, { type: "text", text: "**Gradient = 3**", beside: true }])).pages[0]);
    expect(p.textTop + p.baseline).toBeCloseTo(p.tableTop + p.tableH - foot, 2);
    expect(p.textTop).toBeGreaterThan(p.tableTop + 10);
  });

  it("puts an answer line beside a ratio table on the bottom row too", () => {
    const page = renderResource(sheet([ratio, { type: "answerLine", prefix: "Gradient =", suffix: "", answer: "3", inline: false, beside: true }])).pages[0];
    const table = page.match(/<g transform="translate\([\d.-]+,([\d.-]+)\)"><svg[^>]*height="([\d.]+)"[^>]*aria-label="Ratio table"/)!;
    const line = page.match(/<g transform="translate\([\d.-]+,([\d.-]+)\)"><text x="0" y="([\d.]+)"[^>]*>(?:<tspan[^>]*>)?Gradient/)!;
    expect(Number(line[1]) + Number(line[2])).toBeCloseTo(Number(table[1]) + Number(table[2]) - foot, 2);
  });

  it("keeps other rows of two at the top", () => {
    const graph = { type: "diagram", diagram: { tool: "graph", spec: { axes: { x: { negativeSquares: 0, positiveSquares: 4, unitsPerSquare: 1 }, y: { negativeSquares: 0, positiveSquares: 5, unitsPerSquare: 1 } }, objects: [] } } };
    const page = renderResource(sheet([graph, { type: "text", text: "Read the movements.", beside: true }])).pages[0];
    const [g, t] = [...page.matchAll(/<g transform="translate\([\d.-]+,([\d.-]+)\)">(?:<svg|<text)/g)].slice(-2).map((m) => Number(m[1]));
    expect(t).toBe(g);
  });

  it("drops the Word cell beside a ratio table by the same amount", async () => {
    const doc = sheet([ratio, { type: "text", text: "**Gradient = 3**", beside: true }]);
    const p = placed(renderResource(doc).pages[0]);
    const { bytes } = await writeWorksheetDocx(doc, options);
    const xml = strFromU8(unzipSync(bytes)["word/document.xml"]);
    const at = xml.indexOf(">Gradient");
    const cellStart = xml.lastIndexOf("<w:tc>", at);
    // The cell opens with an exact empty paragraph as tall as the drop on the page (twentieths of a point).
    const first = xml.slice(cellStart, at).match(/<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="(\d+)" w:lineRule="exact"\/>/);
    expect(first).toBeTruthy();
    expect(Number(first![1]) / 56.693).toBeCloseTo(p.textTop - p.tableTop, 0);
  });
});
