import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { writeWorksheetDocx } from "./docx";
import { renderResource, validate, type Resource } from "./index";
import { resourceAnswerSlots } from "./answer-slots";

// P11: a table of values runs along the page, the x row over the y row, and the x row is the
// shaded heading row whose cells can be blank or hidden answers (A7.01 Q4, A7.09; 16 Nov 2026).
const sheet = (items: unknown[]): Resource =>
  validate({
    tool: "resource",
    schemaVersion: 1,
    document: {
      kind: "worksheet-a3",
      title: "Tables of values",
      code: "TEST",
      objective: "Tables of values",
      notation: "maths",
      sides: [
        {
          columns: [
            { heading: "A", cards: [{ title: "One", items }] },
            { heading: "B", cards: [] },
            { heading: "C", cards: [] },
          ],
        },
        { columns: [{ heading: "D", cards: [] }, { heading: "E", cards: [] }, { heading: "F", cards: [] }] },
      ],
    },
  } as never);
const c = (text: string, state = "supplied") => ({ text, state });
const along = {
  type: "table",
  rows: [
    [c("x"), c("-1"), c("0"), c("1"), c("", "blank"), c("3", "hidden")],
    [c("y"), c("-5"), c("-3"), c("-1"), c("1"), c("0")],
  ],
};

describe("a table whose shaded first row holds blanks and hidden answers", () => {
  it("shades the x row, leaves its blanks empty and shows hidden answers only on the answers copy", () => {
    const doc = sheet([along]);
    const pupil = renderResource(doc, { view: "pupil" }), answers = renderResource(doc, { view: "answers" });
    expect(pupil.issues).toEqual([]);
    // The 3 in the x row prints only on the answers copy, in the answer colour.
    expect(pupil.pages[0]).not.toMatch(/>3<\/t/);
    expect(answers.pages[0]).toMatch(/fill="#b0125b"[^>]*>3</);
    // The pupil copy differs from the answers copy only by that answer.
    expect(pupil.pages[0].length).toBeLessThan(answers.pages[0].length);
  });
  it("saves the hidden answer as an answer slot and matches in Word", async () => {
    const slots = resourceAnswerSlots(sheet([along]));
    const firstRow = slots.filter((s) => s.path.includes(".rows.0."));
    expect(firstRow.filter((s) => s.state === "hidden").map((s) => s.text)).toEqual(["3"]);
    expect(firstRow.filter((s) => s.state === "blank")).toHaveLength(1);
    const font = (n: number) => new Uint8Array([n]);
    const xml = (view: "pupil" | "answers") =>
      writeWorksheetDocx(sheet([along]), { view, fonts: { regular: font(1), semiBold: font(2), italic: font(3) }, picture: (svg) => ({ svg, png: new Uint8Array([137, 80, 78, 71]) }) }).then((d) =>
        strFromU8(unzipSync(d.bytes)["word/document.xml"]),
      );
    const [p, a] = await Promise.all([xml("pupil"), xml("answers")]);
    const table = (x: string) => x.slice(x.lastIndexOf("<w:tbl>", x.indexOf("5</w:t>")), x.indexOf("</w:tbl>", x.indexOf("5</w:t>")));
    // The x row is shaded in Word too, and its hidden 3 shows only on the answers copy.
    const first = (x: string) => table(x).slice(0, table(x).indexOf("</w:tr>"));
    expect(first(p)).toContain("w:fill=");
    expect(first(p)).not.toContain(">3</w:t>");
    expect(first(a)).toContain(">3</w:t>");
  });
  it("still prints printed headings, and refuses rows longer than the table", () => {
    expect(() => sheet([{ type: "table", columns: ["x", "y"], rows: [[c("1"), c("2")]] }])).not.toThrow();
    // A short row still opens and prints its missing cell empty; a long row is refused clearly.
    expect(() => sheet([{ type: "table", columns: ["x", "y", "z"], rows: [[c("1"), c("2")]] }])).not.toThrow();
    expect(() => sheet([{ type: "table", rows: [[c("x"), c("1")], [c("y"), c("2"), c("3")]] }])).toThrow(/has 3 cells but the table has 2 columns/);
    expect(() => sheet([{ type: "table", rows: [] }])).toThrow(/rows/);
    expect(() => sheet([{ type: "table", rows: [] }])).not.toThrow(TypeError);
  });
});
