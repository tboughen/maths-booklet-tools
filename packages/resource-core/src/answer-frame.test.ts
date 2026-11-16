import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { writeWorksheetDocx } from "./docx";
import { renderResource, validate, type Resource } from "./index";
import { resourceAnswerSlots } from "./answer-slots";
import { FRAME_BLANK } from "./text";

// "( ____ , ____ )": a coordinate answer with two short blanks (Tim, A7.05 marking, 16 Nov 2026).
const sheet = (items: unknown[]): Resource =>
  validate({
    tool: "resource",
    schemaVersion: 1,
    document: {
      kind: "worksheet-a3",
      title: "Coordinates",
      code: "TEST",
      objective: "Coordinate answers",
      notation: "maths",
      sides: [
        {
          columns: [
            { heading: "A", cards: [{ title: "One", items: [{ type: "text", text: "Write the coordinates of the point." }, ...items] }] },
            { heading: "B", cards: [] },
            { heading: "C", cards: [] },
          ],
        },
        { columns: [{ heading: "D", cards: [] }, { heading: "E", cards: [] }, { heading: "F", cards: [] }] },
      ],
    },
  } as never);
const coord = (x = "3", y = "-2", more: object = {}) => ({ type: "answerLine", prefix: "(", suffix: ")", answer: "", inline: false, blanks: [{ answer: x }, { before: ",", answer: y }], ...more });
const lines = (svg: string) =>
  [...svg.matchAll(/<line x1="([\d.]+)" y1="[\d.]+" x2="([\d.]+)" y2="[\d.]+" stroke="#[0-9a-f]+" stroke-width="0.3"\/>/g)].map((m) => [Number(m[1]), Number(m[2])]);

describe("answer frame with short blanks", () => {
  it("prints y = ____ x + ____ with two short blanks and the fixed text between them", () => {
    const eq = { type: "answerLine", prefix: "y =", suffix: "", answer: "", inline: false, blanks: [{ answer: "2" }, { before: "x +", answer: "-9" }] };
    const doc = sheet([eq]);
    const r = renderResource(doc, { view: "answers" });
    expect(r.issues).toEqual([]);
    const [a, b] = lines(r.pages[0]).slice(-2);
    expect(a[1] - a[0]).toBeCloseTo(FRAME_BLANK, 1);
    expect(b[1] - b[0]).toBeCloseTo(FRAME_BLANK, 1);
    // Maths notation typesets the fixed text too: italic letters.
    expect(r.pages[0]).toMatch(/font-style="italic">y<\/tspan> =/);
    expect(r.pages[0]).toMatch(/font-style="italic">x<\/tspan> \+/);
    // The whole frame is short: well under the 55 mm the old pair of lines took each.
    expect(b[1] - a[0]).toBeLessThan(55);
  });

  it("prints two short left-aligned blanks between brackets and a comma, never a full-width line", () => {
    const r = renderResource(sheet([coord()]));
    expect(r.issues).toEqual([]);
    const [a, b] = lines(r.pages[0]).slice(-2);
    expect(a[1] - a[0]).toBeCloseTo(FRAME_BLANK, 1);
    expect(b[1] - b[0]).toBeCloseTo(FRAME_BLANK, 1);
    expect(b[0]).toBeGreaterThan(a[1]);
    for (const ch of ["(", ",", ")"]) expect(r.pages[0]).toContain(`>${ch}</text>`);
  });

  it("shows both saved numbers in the answer colour on the answers copy only, with one layout", () => {
    const doc = sheet([coord("3", "-2")]);
    const pupil = renderResource(doc).pages[0],
      answers = renderResource(doc, { view: "answers" }).pages[0];
    expect(pupil).not.toMatch(/>3<\/text>|>−2<\/text>|>-2<\/text>/);
    expect(answers).toMatch(/text-anchor="middle" xml:space="preserve">3<\/text>/);
    expect(answers).toMatch(/xml:space="preserve">(−|-)2<\/text>/);
    expect(lines(pupil)).toEqual(lines(answers));
  });

  it("puts two coordinate frames side by side on one row when inline", () => {
    const r = renderResource(sheet([coord("1", "2", { inline: true, prefix: "A (" }), coord("3", "4", { inline: true, prefix: "B (" })]));
    expect(r.issues).toEqual([]);
    const ls = lines(r.pages[0]).slice(-4);
    expect(ls).toHaveLength(4);
  });

  it("refuses a plain answer as well as coordinates", () => {
    expect(() => sheet([coord("1", "2", { answer: "(1, 2)" })])).toThrow(/answer frame/);
  });

  it("reports a character the font lacks in the fixed text", () => {
    const r = renderResource(sheet([coord("1", "2", { blanks: [{ answer: "1" }, { before: "⅓", answer: "2" }] })]));
    expect(r.issues.map((i) => i.message).join(" ")).toContain("⅓");
  });

  it("has two answer slots", () => {
    const slots = resourceAnswerSlots(sheet([coord("3", "-2")])).filter((s) => s.path.includes("blanks"));
    expect(slots.map((s) => [s.path.split(".").slice(-2).join("."), s.state, s.text])).toEqual([
      ["0.answer", "answerLine", "3"],
      ["1.answer", "answerLine", "-2"],
    ]);
  });

  it("prints the same frame in Word: bracket, bordered blank, comma, bordered blank, bracket, numbers only in answers", async () => {
    const doc = sheet([coord("3", "-2")]);
    const font = (seed: number) => Uint8Array.from({ length: 64 }, (_, i) => (i * 7 + seed) % 256);
    const xml = (view: "pupil" | "answers") =>
      writeWorksheetDocx(doc, { view, fonts: { regular: font(1), semiBold: font(2), italic: font(3) }, picture: (svg) => ({ svg, png: new Uint8Array([137, 80, 78, 71]) }) }).then((d) =>
        strFromU8(unzipSync(d.bytes)["word/document.xml"]),
      );
    const [pupil, answers] = await Promise.all([xml("pupil"), xml("answers")]);
    const row = (x: string) => x.slice(x.lastIndexOf("<w:tbl>", x.indexOf(">)</w:t>")), x.indexOf("</w:tbl>", x.indexOf(">)</w:t>")));
    const p = row(pupil), a = row(answers);
    expect(p.match(/<w:bottom w:val="single"/g)).toHaveLength(2);
    expect(p).toMatch(/>\(<\/w:t>[^]*>,<\/w:t>[^]*>\)<\/w:t>/);
    expect(p).not.toMatch(/>3<\/w:t>/);
    expect(a).toMatch(/<w:jc w:val="center"\/>[^]*>3<\/w:t>/);
    // Both copies share the column grid.
    expect(p.match(/<w:tblGrid>.*?<\/w:tblGrid>/)![0]).toBe(a.match(/<w:tblGrid>.*?<\/w:tblGrid>/)![0]);
  });
});
