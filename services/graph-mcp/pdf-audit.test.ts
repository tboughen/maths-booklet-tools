// @vitest-environment node
// W30: every worksheet and booklet PDF is re-opened and audited after it is written.
import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { renderResource, validate } from "../../packages/resource-core/src/index";
import { treeDiagrams } from "../../packages/resource-core/src/fixtures";
import { auditPdf, expectedPages } from "../../packages/resource-core/src/pdf-audit";
import { worksheetPdf } from "./worksheet-pdf";

const root = join(import.meta.dirname, "../..");
const roots = { text: join(root, "assets/resource-fonts"), diagrams: join(root, "assets/graph-fonts") };
const A3 = { widthMm: 420, heightMm: 297, images: 0, text: true };
/** One 1 x 1 PNG pixel. */
const PIXEL = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
const pt = (mm: number) => (mm * 72) / 25.4;

describe("post-export vector audit", () => {
  it("passes a real worksheet: 2 A3 pages, vector, embedded fonts with text maps", async () => {
    const pages = renderResource(validate(treeDiagrams), { view: "answers" }).pages;
    const pdf = await worksheetPdf(pages, "audit", roots);
    const audit = await auditPdf(pdf, expectedPages(pages));
    expect(audit.problems).toEqual([]);
    expect(audit.pages).toBe(2);
    expect(audit.images).toBe(0);
    expect(audit.fonts).toBeGreaterThan(1);
    expect(expectedPages(pages)[0]).toMatchObject({ widthMm: 420, heightMm: 297, images: 0, text: true });
  }, 60000);

  it("reports a wrong page count and a wrong page size", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([pt(297), pt(420)]);
    const audit = await auditPdf(await doc.save(), [A3, A3]);
    expect(audit.problems[0]).toMatch(/has 1 pages; 2 were drawn/);
    expect(audit.problems.join(" ")).toMatch(/Page 1 is 297.0 × 420.0 mm; it should be 420 × 297 mm/);
  });

  it("reports a rasterised page: an image that was not drawn, and no selectable text", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([pt(420), pt(297)]);
    page.drawImage(await doc.embedPng(PIXEL), { x: 0, y: 0, width: pt(420), height: pt(297) });
    const audit = await auditPdf(await doc.save(), [A3]);
    expect(audit.problems.join(" ")).toMatch(/holds 1 raster image; only 0 were drawn/);
    expect(audit.problems.join(" ")).toMatch(/no selectable text/);
    // A drawn bank image is allowed.
    expect((await auditPdf(await doc.save(), [{ ...A3, images: 1, text: false }])).problems).toEqual([]);
  });

  it("reports a font that is not embedded", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([pt(420), pt(297)]);
    page.drawText("Question 1", { x: 40, y: 700, font: await doc.embedFont(StandardFonts.Helvetica), size: 11 });
    const audit = await auditPdf(await doc.save(), [A3]);
    expect(audit.problems.join(" ")).toMatch(/font Helvetica is not embedded/);
  });
});
