// @vitest-environment node
// U32 / M24: one diagram as a vector PDF page at its exact physical size.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { DIAGRAM_KINDS, FAMILIES, svgSizeMm } from "../../packages/diagram-core/src/registry";
import { diagramPage, sheetFor } from "../../packages/resource-core/src/diagram-page";
import { auditPdf, expectedPages } from "../../packages/resource-core/src/pdf-audit";
import { worksheetPdf } from "./worksheet-pdf";

const root = join(import.meta.dirname, "../..");
const roots = { text: join(root, "assets/resource-fonts"), diagrams: join(root, "assets/graph-fonts") };
const corpus = join(root, "packages/envelope-core/fixtures/corpus");
const first = (kind: string) => JSON.parse(readFileSync(join(corpus, kind, readdirSync(join(corpus, kind))[0]), "utf8"));

describe("single-diagram PDF page", () => {
  it("chooses the smallest sheet that holds the diagram inside 15 mm margins", () => {
    expect(sheetFor(120, 80).name).toBe("A4 portrait");
    expect(sheetFor(200, 120).name).toBe("A4 landscape");
    expect(sheetFor(260, 300).name).toBe("A3 portrait");
    expect(() => sheetFor(500, 100)).toThrow(/larger than an A3 page/);
  });

  it("places the artwork at 1:1, centred, 15 mm from the top, and strips embedded font CSS", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="12cm" height="8cm" viewBox="0 0 120 80" role="img" aria-label="T"><!-- fonts --><style>@font-face{font-family:x;src:url(data:a)}</style><rect width="120" height="80"/></svg>';
    const page = diagramPage(svg, "T");
    expect(page).toMatch(/^<svg[^>]* width="210mm" height="297mm"/);
    expect(page).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" x="45" y="15" viewBox="0 0 120 80"');
    expect(page).not.toContain("@font-face");
  });

  it("writes an audited vector PDF for every family at the artwork's printed size", async () => {
    for (const kind of DIAGRAM_KINDS) {
      const svg = FAMILIES[kind].svg(first(kind), "pupil");
      const page = diagramPage(svg);
      const pdf = await worksheetPdf([page], kind, roots);
      const audit = await auditPdf(pdf, expectedPages([page]));
      expect(audit.problems, kind).toEqual([]);
      expect(audit.images, kind).toBe(0);
      const doc = await PDFDocument.load(pdf);
      const { width } = doc.getPage(0).getSize();
      expect(Math.abs((width * 25.4) / 72 - sheetFor(svgSizeMm(svg).width, svgSizeMm(svg).height).width), kind).toBeLessThan(0.1);
    }
  }, 120000);
});
