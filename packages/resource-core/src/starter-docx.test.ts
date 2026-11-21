import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { writeStarterDocx } from "./starter-docx";
import { year8Run, year9Run } from "./starter-fixtures";
import { validateStarterRun, type StarterRun } from "./index";
import type { DocxOptions } from "./docx";

// Stand-ins: the real fonts and picture maker live in the service (services/graph-mcp/worksheet-docx.ts).
const font = (seed: number) => Uint8Array.from({ length: 64 }, (_, i) => (i * 7 + seed) % 256);
const options = (view: "pupil" | "answers" = "pupil"): DocxOptions => ({ view, fonts: { regular: font(1), semiBold: font(2), italic: font(3) }, picture: (svg) => ({ svg, png: new Uint8Array([137, 80, 78, 71]) }) });
async function open(run: StarterRun, view: "pupil" | "answers" = "pupil", only?: number) {
  const { bytes, issues } = await writeStarterDocx(validateStarterRun(structuredClone(run)), { ...options(view), only });
  const files = unzipSync(bytes);
  return { issues, files, document: strFromU8(files["word/document.xml"]) };
}
const count = (s: string, needle: string) => s.split(needle).length - 1;

describe("Word output for silent starters", () => {
  it("writes one A4 portrait page per starter, each with two copies and a cut line", async () => {
    const { issues, document } = await open(year9Run);
    expect(issues).toEqual([]);
    expect(new DOMParser().parseFromString(document, "application/xml").getElementsByTagName("parsererror")).toHaveLength(0);
    expect(document).toContain('<w:pgSz w:w="11906" w:h="16838"/>');
    expect(count(document, "<w:pageBreakBefore/>")).toBe(5);
    expect(count(document, 'w:val="dashed"')).toBe(6);
    // Two headers per page, each a picture of the PDF header (Word names a picture twice).
    expect(count(document, 'descr="Silent starter 1 of 6: Fractions, area and expanding"')).toBe(4);
  });

  it("tags cards 5 and 6 with navy EXTENSION strips, the rest pale blue, at their printed height", async () => {
    const { document } = await open(year9Run, "pupil", 2);
    expect(count(document, ">EXTENSION<")).toBe(4);
    expect(document).toContain('w:fill="173C65"');
    expect(document).toContain('w:fill="DBE7F6"');
    expect(count(document, 'w:hRule="exact"')).toBeGreaterThanOrEqual(4);
    expect(document).toContain("<m:f>");
  });

  it("prints one starter on its own, and the Year 8 icons as pictures in their corners", async () => {
    const { document, files } = await open(year8Run);
    expect(count(document, "<w:pageBreakBefore/>")).toBe(0);
    for (const icon of ["pencil", "talk", "book", "puzzle"]) expect(count(document, `descr="${icon} icon"`)).toBe(4); // two copies, each naming its picture twice
    const svgs = Object.keys(files).filter((f) => f.endsWith(".svg"));
    expect(svgs.length).toBeGreaterThanOrEqual(12);
  });

  it("keeps the diagram's white background, as every card is white", async () => {
    const { files } = await open(year9Run, "pupil", 1);
    const area = Object.entries(files).filter(([f, b]) => f.endsWith(".svg") && strFromU8(b).includes("Area and perimeter diagram"));
    expect(area.length).toBe(2);
    for (const [, b] of area) expect(strFromU8(b)).toMatch(/aria-label="Area and perimeter[^"]*"><rect width="[\d.]+" height="[\d.]+" fill="white"\/>/);
  });

  it("reports the same problems as the PDF", async () => {
    const run = structuredClone(year9Run);
    run.document.starters[0].cards[2].items.push({ type: "space", kind: "working", heightMm: 60 });
    const { issues } = await open(run);
    expect(issues.some((i) => /^Starter 1, question 3 needs/.test(i.message))).toBe(true);
  });

  it("prints saved answers only in the answers copy", async () => {
    const run = structuredClone(year8Run);
    const choice = run.document.starters[0].cards[0].items[1];
    if (choice.type !== "choice") throw Error("fixture changed");
    choice.answer = 3;
    expect((await open(run)).document).not.toContain("B0125B");
    expect((await open(run, "answers")).document).toContain("B0125B");
  });

  it("puts six questions into the table across, 1 2 3 then 4 5 6, as on the PDF", async () => {
    const { document } = await open(year9Run, "pupil", 1);
    // Word reads a table row by row, so the first copy's labels come in table order: row 1 then row 2.
    const first = document.slice(0, document.indexOf('w:val="dashed"'));
    const labels = [...first.matchAll(/<w:t xml:space="preserve">([1-6])<\/w:t>/g)].map((m) => m[1]);
    expect(labels).toEqual(["1", "2", "3", "4", "5", "6"]);
  });

  it("names the starter and question for a diagram too wide for its slot, once, with starter advice", async () => {
    const run = structuredClone(year9Run);
    const diagram = run.document.starters[0].cards[4].items[0];
    if (diagram.type !== "diagram" || !diagram.diagram.envelope) throw Error("fixture changed");
    const env = diagram.diagram.envelope as { document: { shape: { corners: { x: number; y: number }[] } } };
    env.document.shape.corners = env.document.shape.corners.map((c) => ({ x: c.x * 3, y: c.y }));
    const { issues } = await open(run, "pupil", 1);
    const wide = issues.filter((i) => /wide/.test(i.message));
    expect(wide).toHaveLength(1);
    expect(wide[0].message).toMatch(/^Starter 1, question 5: /);
    expect(issues.some((i) => /column layout/.test(i.message))).toBe(false);
  });
});
