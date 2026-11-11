import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { comparativeBarCharts, treeDiagrams } from "./fixtures";
import { obfuscateFont, writeWorksheetDocx, WORD_FOOT_MM, type DocxOptions } from "./docx";
import { renderResource, styles, validate, type Resource } from "./index";
import { wordSample } from "./word-sample";

// Stand-ins: the real fonts and picture maker live in the service (services/graph-mcp/worksheet-docx.ts).
const font = (seed: number) => Uint8Array.from({ length: 64 }, (_, i) => (i * 7 + seed) % 256);
const options = (view: "pupil" | "answers" = "pupil"): DocxOptions => ({
  view,
  fonts: { regular: font(1), semiBold: font(2), italic: font(3) },
  picture: (svg) => ({ svg, png: new Uint8Array([137, 80, 78, 71]) }),
});
async function open(doc: Resource, view: "pupil" | "answers" = "pupil") {
  const { bytes, issues } = await writeWorksheetDocx(doc, options(view));
  const files = unzipSync(bytes);
  const text = (name: string) => strFromU8(files[name]);
  return { bytes, issues, files, text, document: text("word/document.xml") };
}
const parse = (xml: string) => new DOMParser().parseFromString(xml, "application/xml");
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

describe("Word output for worksheets", () => {
  const sheets: [string, Resource][] = [
    ["comparative bar charts", comparativeBarCharts],
    ["tree diagrams", treeDiagrams],
    ["the Word rendering test", wordSample],
  ];

  for (const [name, doc] of sheets) {
    it(`writes a well-formed Word package for ${name} with the same layout checks as the PDF`, async () => {
      for (const view of ["pupil", "answers"] as const) {
        const { files, text, issues } = await open(doc, view);
        for (const part of ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml", "word/settings.xml", "word/fontTable.xml", "word/_rels/document.xml.rels", "word/_rels/fontTable.xml.rels", "docProps/core.xml"])
          expect(files[part], part).toBeDefined();
        for (const xml of Object.keys(files).filter((f) => f.endsWith(".xml") || f.endsWith(".rels")))
          expect(parse(text(xml)).getElementsByTagName("parsererror"), xml).toHaveLength(0);
        expect(issues).toEqual(renderResource(doc, { view }).issues);
        expect(issues).toEqual([]);
        // Every picture the document uses is in the package, as PNG and SVG.
        const rels = text("word/_rels/document.xml.rels");
        for (const id of text("word/document.xml").match(/r:embed="[^"]+"/g) ?? []) expect(rels).toContain(`Id="${id.slice(9, -1)}"`);
      }
    });
  }

  it("keeps saved answers out of the pupil copy and prints them in the answers copy", async () => {
    const colour = styles.mathsdock.answer.slice(1).toUpperCase();
    for (const doc of [comparativeBarCharts, treeDiagrams, wordSample]) {
      expect((await open(doc)).document).not.toContain(colour);
      expect((await open(doc, "answers")).document).toContain(colour);
    }
    expect((await open(treeDiagrams)).document).not.toContain("HHH, HHT");
    expect((await open(treeDiagrams, "answers")).document).toContain("HHH, HHT");
  });

  it("sets two A3 landscape sides of fixed tables with pinned card heights", async () => {
    const { document } = await open(comparativeBarCharts);
    const xml = parse(document);
    const size = xml.getElementsByTagNameNS(W, "pgSz")[0];
    expect([size.getAttribute("w:w"), size.getAttribute("w:h"), size.getAttribute("w:orient")]).toEqual(["23811", "16838", "landscape"]);
    // The bottom margin gives back WORD_FOOT_MM so a fractionally taller card stays on its side.
    expect(xml.getElementsByTagNameNS(W, "pgMar")[0].getAttribute("w:bottom")).toBe(String(Math.round(((8 - WORD_FOOT_MM) * 1440) / 25.4)));
    expect(document.match(/<w:br w:type="page"\/>/g)).toHaveLength(1);
    const tables = [...xml.getElementsByTagNameNS(W, "tbl")];
    expect(tables.every((t) => t.getElementsByTagNameNS(W, "tblLayout")[0]?.getAttribute("w:type") === "fixed")).toBe(true);
    // Twelve question cards, each a bordered one-cell table with a minimum height.
    expect(document.match(/<w:top w:val="single" w:sz="10"/g)).toHaveLength(12);
    expect(document.match(/w:hRule="atLeast"/g)!.length).toBeGreaterThanOrEqual(12);
    // No paragraph uses automatic line spacing except pictures.
    const auto = document.match(/w:lineRule="auto"/g)?.length ?? 0;
    expect(auto).toBe((document.match(/<w:drawing>/g) ?? []).length);
  });

  it("embeds Inter, obfuscated with a stable key, and marks the fonts for embedding", async () => {
    const a = await open(comparativeBarCharts);
    const table = a.text("word/fontTable.xml");
    expect(table).toMatch(/<w:font w:name="Inter">.*<w:embedRegular r:id="rIdFont1" w:fontKey="\{[0-9A-F-]{36}\}"\/><w:embedItalic/);
    expect(table).toContain('<w:font w:name="Inter SemiBold">');
    expect(a.text("word/settings.xml")).toContain("<w:embedTrueTypeFonts/>");
    const key = table.match(/w:fontKey="([^"]+)"/)![1];
    expect(obfuscateFont(a.files["word/fonts/font1.odttf"], key)).toEqual(font(1));
    expect(a.files["word/fonts/font1.odttf"].slice(32)).toEqual(font(1).slice(32));
    // The same worksheet always makes the same file.
    expect((await open(comparativeBarCharts)).bytes).toEqual(a.bytes);
  });

  it("writes stacked fractions as native Word equations only when the sheet uses maths notation", async () => {
    const { document } = await open(wordSample);
    expect(document).toContain("<m:f><m:num>");
    expect(document.match(/<m:f>/g)!.length).toBeGreaterThan(15);
    expect(document).not.toContain("{3/4}");
    const plain = validate({ ...structuredClone(wordSample), document: { ...wordSample.document, notation: "plain" } });
    const p = await open(plain);
    expect(p.document).not.toContain("<m:f>");
    expect(p.document).toContain("{3/4}");
  });

  it("names its properties and keeps the version given", async () => {
    const { bytes } = await writeWorksheetDocx(treeDiagrams, { ...options("answers"), version: "test 1" });
    const core = strFromU8(unzipSync(bytes)["docProps/core.xml"]);
    expect(core).toContain("<dc:title>List outcomes of combined events using a tree diagram (answers)</dc:title>");
    expect(core).toContain("<cp:version>test 1</cp:version>");
  });
});

describe("stacked fractions in the SVG pages", () => {
  it("draws {a/b} stacked and keeps plain sheets unchanged", () => {
    const svg = renderResource(wordSample).pages.join("");
    expect(svg).toContain('data-fraction="stacked"');
    expect(svg).not.toContain("{3/4}");
    const plain = validate({ ...structuredClone(wordSample), document: { ...wordSample.document, notation: "plain" } });
    expect(renderResource(plain).pages.join("")).not.toContain("data-fraction");
  });

  it("reports a brace that is not a fraction", () => {
    const doc = structuredClone(wordSample);
    doc.document.sides[0].columns[0].cards[0].items.unshift({ type: "text", text: "Gradient {1/2} and {oops}" });
    expect(renderResource(doc).issues.some((i) => /brace is not part of a fraction/.test(i.message))).toBe(true);
  });

  it("reports a saved answer longer than its answer line", () => {
    const doc = structuredClone(treeDiagrams);
    doc.document.sides[1].columns[2].cards[1].items[2] = {
      type: "part",
      text: "List every possible outcome.",
      items: [{ type: "answerLine", prefix: "", suffix: "", answer: "HHH, HHT, HTH, HTT, THH, THT, TTH, TTT", inline: false }],
    };
    expect(renderResource(doc).issues.some((i) => /saved answer is [\d.]+ mm wider than its answer line/.test(i.message))).toBe(true);
  });
});
