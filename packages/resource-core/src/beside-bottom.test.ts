import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { writeWorksheetDocx } from "./docx";
import { renderResource, validate, type Resource } from "./index";

// An answer line beside a working space sits at the bottom of the space, as it does under one
// (A7.10 Q2e, A7.11 Q7; 16 Nov 2026). It used to print at the top of the row.
const sheet = (items: unknown[]): Resource =>
  validate({
    tool: "resource",
    schemaVersion: 1,
    document: {
      kind: "worksheet-a3",
      title: "Beside",
      code: "TEST",
      objective: "Answer beside working",
      notation: "maths",
      sides: [
        { columns: [{ heading: "A", cards: [{ title: "One", items }] }, { heading: "B", cards: [] }, { heading: "C", cards: [] }] },
        { columns: [{ heading: "D", cards: [] }, { heading: "E", cards: [] }, { heading: "F", cards: [] }] },
      ],
    },
  } as never);
const working = { type: "space", kind: "working", heightMm: 18 };
const answer = { type: "answerLine", prefix: "x =", suffix: "", answer: "4", inline: false, beside: true };
// Where the answer line's group is placed inside its row: the translate just before its "x =".
const answerTop = (svg: string) => {
  const at = svg.lastIndexOf("<g transform", svg.indexOf('italic">x</tspan> =</text><line'));
  return Number(svg.slice(at).match(/translate\(([\d.]+),([\d.]+)\)/)![2]);
};
const font = (seed: number) => Uint8Array.from({ length: 64 }, (_, i) => (i * 7 + seed) % 256);
const word = (r: Resource) =>
  writeWorksheetDocx(r, { view: "pupil", fonts: { regular: font(1), semiBold: font(2), italic: font(3) }, picture: (svg) => ({ svg, png: new Uint8Array([137, 80, 78, 71]) }) }).then((d) => strFromU8(unzipSync(d.bytes)["word/document.xml"]));
const bottoms = (xml: string) => xml.split('<w:vAlign w:val="bottom"/>').length - 1;
const stem = { type: "text", text: "Solve 2x = 8." };

describe("an answer line beside a working space", () => {
  it("is bottom-aligned with the space instead of printing at the top of the row", () => {
    const r = renderResource(sheet([stem, working, answer]));
    expect(r.issues).toEqual([]);
    // The row is at least the 18 mm space; the answer line's own row is about 8 mm.
    expect(answerTop(r.pages[0])).toBeGreaterThan(9);
    // A diagram or text beside a space still starts at the top (only answer lines drop).
    const text = renderResource(sheet([stem, working, { type: "text", text: "Show your working.", beside: true }])).pages[0];
    expect(text).toMatch(/<g transform="translate\([\d.]+,0\)"><text[^>]*>Show your working/);
  });
  it("is bottom-aligned in Word too", async () => {
    const [beside, alone] = await Promise.all([word(sheet([stem, working, answer])), word(sheet([stem, working, { ...answer, beside: undefined }]))]);
    // The beside row's answer cell adds one bottom alignment to what the answer line itself uses.
    expect(bottoms(beside)).toBe(bottoms(alone) + 1);
  });
});
