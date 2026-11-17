import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { writeWorksheetDocx } from "./docx";
import { renderResource, validate, type Resource } from "./index";
import { LETTERS, letterColumns } from "./render";
import { createRatioTable, ratioBottomBaselineMm } from "../../ratio-table-core/src/interchange";
import { ratioMetrics } from "../../ratio-table-core/src/svg";

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

  it("measures the bottom row the same under a taller stacked-fraction heading row", () => {
    const tall = createRatioTable({ columns: ["x", "1/x"], table: [["2", "6"], ["1", "3"]], steps: [] }).document;
    expect(ratioMetrics(tall).headHeight).toBeGreaterThan(ratioMetrics(createRatioTable(spec).document).headHeight);
    expect(ratioBottomBaselineMm(tall)).toBeCloseTo(foot, 5);
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

describe("after the A7.03 rebuild (17 Nov 2026)", () => {
  const ratio = { type: "diagram", diagram: { tool: "ratio-table", spec: { columns: ["x →", "y ↑"], table: [["2", "8"], ["1", "[4]"]], steps: ["÷ 2"] } } };

  it("puts options in a narrow space one under another, not in a crowded 2 by 2 block", () => {
    const page = renderResource(sheet([ratio, { type: "choice", mode: "letters", options: ["1", "2", "4", "8"], beside: true }])).pages[0];
    const r = rings(page);
    expect(r).toHaveLength(4);
    // Here there is room for one row; never a 2 by 2 block beside a diagram.
    expect(new Set(r.map((o) => o.y)).size).toBe(1);
    // In a narrow space (a half-width booklet card beside a grid) they go one under another.
    const four = [8.8, 8.8, 8.8, 8.8];
    expect(letterColumns(four, 32)).toBe(1);
    expect(letterColumns(four, 40)).toBe(1);
    expect(letterColumns(four, 60)).toBe(4);
    // Longer options on a wider card still take two columns.
    expect(letterColumns([20, 20, 20, 20], 70)).toBe(2);
  });

  it("keeps a longer passage beside a ratio table at the top", () => {
    const text = "Leah says, “I divided 4 by 4 to get 1 right, so the gradient is 12.” Explain her mistake.";
    const page = renderResource(sheet([ratio, { type: "text", text, beside: true }])).pages[0];
    const table = page.match(/<g transform="translate\([\d.-]+,([\d.-]+)\)"><svg[^>]*aria-label="Ratio table"/)!;
    const passage = page.match(/<g transform="translate\([\d.-]+,([\d.-]+)\)"><text[^>]*>Leah/)!;
    expect(Number(passage[1])).toBe(Number(table[1]));
  });
});

describe("bold round a stacked fraction (16 Nov 2026)", () => {
  it("prints **Gradient = {1/2}** with bold words and a bold fraction, and no stray marks", async () => {
    const doc = sheet([{ type: "text", text: "**Gradient = {1/2}**" }]);
    const r = renderResource(doc);
    const page = r.pages[0];
    expect(page).not.toContain("**");
    expect(page).toMatch(/<g data-fraction="stacked"><text[^>]*font-weight="600"[^>]*>1<\/text><line[^>]*stroke-width="0.45"\/><text[^>]*font-weight="600"[^>]*>2<\/text>/);
    expect(page).toMatch(/<tspan font-weight="600">Gradient<\/tspan>/);
    const { bytes } = await writeWorksheetDocx(doc, options);
    const xml = strFromU8(unzipSync(bytes)["word/document.xml"]);
    expect(xml).not.toContain("**");
    const num = xml.slice(xml.indexOf("<m:num>"), xml.indexOf("</m:num>"));
    // Bold runs name the semibold font; regular runs name none.
    expect(num).toMatch(/<w:rFonts/);
  });

  it("keeps several short bold runs apart when fractions sit between them", () => {
    const page = renderResource(sheet([{ type: "text", text: "**f.**\u00a0{1/5},  **g.**\u00a0{4/5},  **i.**\u00a00,  **j.**\u00a0{1/10}" }])).pages[0];
    expect(page).not.toContain("**");
    for (const l of ["f.", "g.", "i.", "j."]) expect(page).toContain(`<tspan font-weight="600">${l}</tspan>`);
    expect(page).not.toMatch(/<g data-fraction="stacked"><text[^>]*font-weight/);
  });

  it("leaves a fraction outside the bold marks regular", () => {
    const page = renderResource(sheet([{ type: "text", text: "**Gradient =** {1/2}" }])).pages[0];
    expect(page).toMatch(/<g data-fraction="stacked"><text(?![^>]*font-weight)[^>]*>1<\/text>/);
  });
});

describe("tick and cross in the sheet font (16 Nov 2026)", () => {
  it("prints ✓ and ✗ without a missing-character issue", () => {
    const r = renderResource(sheet([{ type: "text", text: "Perfect points ✓ Triangle ✓ Wrong step ✗" }]));
    expect(r.issues.filter((i) => /does not have/.test(i.message))).toEqual([]);
  });
});
