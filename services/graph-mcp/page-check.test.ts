// @vitest-environment node
// W31: every written worksheet and booklet PDF is read back and its text checked against the trim,
// the question cards and the diagrams.
import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { renderBooklet, renderResource, validate } from "../../packages/resource-core/src/index";
import { comparativeBarCharts, treeDiagrams } from "../../packages/resource-core/src/fixtures";
import { a7Booklet } from "../../packages/resource-core/src/booklet-fixtures";
import { layoutSample } from "../../packages/resource-core/src/layout-sample";
import { wordSample } from "../../packages/resource-core/src/word-sample";
import { checkRenderedPages, pageFrames, type GetDocument } from "../../packages/resource-core/src/page-check";
import { worksheetPdf } from "./worksheet-pdf";

const root = join(import.meta.dirname, "../..");
const roots = { text: join(root, "assets/resource-fonts"), diagrams: join(root, "assets/graph-fonts") };
const read = getDocument as unknown as GetDocument;

describe("rendered-page check (W31)", () => {
  it("passes every worksheet and booklet fixture, pupil and answers", async () => {
    const sets: [string, string[]][] = [];
    for (const [name, r] of [["trees", treeDiagrams], ["bar charts", comparativeBarCharts], ["layout", layoutSample], ["word", wordSample]] as const)
      for (const view of ["pupil", "answers"] as const) sets.push([`${name} ${view}`, renderResource(validate(r), { view }).pages]);
    for (const view of ["pupil", "answers"] as const) sets.push([`A7 booklet ${view}`, renderBooklet(a7Booklet, { view }).pages]);
    for (const [name, pages] of sets) expect(await checkRenderedPages(read, await worksheetPdf(pages, name, roots), pages), name).toEqual([]);
  }, 120000);

  it("finds the cards and diagrams a page draws", () => {
    const frames = pageFrames(renderResource(validate(treeDiagrams), { view: "pupil" }).pages[0]);
    expect(frames.filter((f) => f.kind === "card").length).toBeGreaterThan(3);
    expect(frames.filter((f) => f.kind === "diagram").every((d) => d.width > 0 && d.height > 0 && d.label)).toBe(true);
  });

  it("names text near the paper's edge, text crossing a card's frame and text running into a diagram", async () => {
    const pages = renderResource(validate(treeDiagrams), { view: "pupil" }).pages;
    const frames = pageFrames(pages[0]);
    const card = frames.find((f) => f.kind === "card")!,
      diagram = frames.find((f) => f.kind === "diagram")!;
    const extra =
      `<text x="300" y="294" font-size="3.88">Bottom text</text>` +
      `<text x="${card.x + card.width - 10}" y="${card.y + 40}" font-size="3.88">Runs out of the card here</text>` +
      `<text x="${diagram.x + diagram.width - 5}" y="${diagram.y + 10}" font-size="3.88">Into diagram</text>`;
    const end = pages[0].lastIndexOf("</svg>");
    const faulty = [pages[0].slice(0, end) + extra + pages[0].slice(end), pages[1]];
    const problems = await checkRenderedPages(read, await worksheetPdf(faulty, "faulty", roots), faulty);
    expect(problems.map((p) => [p.page, p.message])).toEqual([
      [0, expect.stringMatching(/^The text "Bottom text" is [\d.]+ mm from the edge of the paper; printers leave about 5 mm unprinted/)],
      [0, 'The text "Runs out of the card here" crosses the edge of its question card. Shorten it or break it onto another line.'],
      [0, expect.stringMatching(/^The text "Into diagram" crosses the edge of the diagram "Probability tree diagram/)],
    ]);
  }, 60000);
});
