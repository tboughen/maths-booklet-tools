import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import { auditPaperPdf, shownText } from "./pdf-audit";

const A4: [number, number] = [595.276, 841.89];
const want = (headings: string[], pages = 1) => ({ pages, widthMm: 210, heightMm: 297, headings });

async function paper(draw: (doc: PDFDocument) => Promise<void>) {
  const doc = await PDFDocument.create();
  await draw(doc);
  return doc.save();
}

describe("question-bank paper checks (L23)", () => {
  it("passes a vector paper whose headings are in the text layer in order", async () => {
    const source = await PDFDocument.create();
    source.addPage([400, 300]).drawRectangle({ x: 10, y: 10, width: 50, height: 50 });
    const bytes = await paper(async (doc) => {
      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      const [form] = await doc.embedPages(source.getPages());
      for (const label of ["1. June 2024 2H Q8 | 3 marks", "2. Nov 2019 1F Q23 | 2 marks"]) {
        const page = doc.addPage(A4);
        page.drawText(label, { x: 24, y: 800, size: 10, font });
        page.drawPage(form, { x: 24, y: 300 });
      }
    });
    expect(await auditPaperPdf(bytes, want(["1. June 2024 2H Q8 | 3 marks", "2. Nov 2019 1F Q23 | 2 marks"], 2))).toEqual([]);
  });
  it("names a wrong page count, size, rotation, missing or out-of-order headings and page rasters", async () => {
    const png = Uint8Array.from(
      atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
      (c) => c.charCodeAt(0),
    );
    const bytes = await paper(async (doc) => {
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const page = doc.addPage([841.89, 595.276]);
      page.setRotation(degrees(90));
      page.drawText("2. Second", { x: 24, y: 500, size: 10, font });
      page.drawText("1. First", { x: 24, y: 480, size: 10, font });
      page.drawImage(await doc.embedPng(png), { x: 0, y: 0, width: 10, height: 10 });
    });
    const problems = await auditPaperPdf(bytes, want(["1. First", "2. Second"], 2));
    expect(problems).toEqual([
      "The PDF has 1 page; 2 were drawn.",
      "Page 1 is 297.0 × 210.0 mm; it should be 210 × 297 mm.",
      "Page 1 is rotated 90°; the orientation must come from its size.",
      "Page 1 has a raster image drawn on it; questions and schemes must stay vector pages.",
      'The heading "2. Second" is missing from the selectable text, or out of order.',
    ]);
  });
  it("reads literal and hex strings", () => {
    expect(shownText("BT <48656C6C6F> Tj (a \\(b\\)) Tj ET")).toBe("Hello\na (b)");
  });
});
