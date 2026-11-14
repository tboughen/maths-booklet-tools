import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { writeWorksheetDocx } from "./docx";
import { renderResource, validate, type Resource } from "./index";
import { answerHasFraction, stackAnswerText } from "./text";

// Fractions on answer lines print stacked, including mixed numbers (Tim, 14 Nov 2026), on sheets
// with maths notation. Plain (older) sheets print exactly as they did.

const sheet = (notation: "plain" | "maths", answer: string, prefix = "", suffix = ""): Resource =>
  validate({
    tool: "resource",
    schemaVersion: 1,
    document: {
      kind: "worksheet-a3",
      title: "Answer fractions",
      code: "TEST",
      objective: "Answer lines with fractions",
      notation,
      sides: [
        {
          columns: [
            { heading: "A", cards: [{ title: "One", items: [{ type: "part", text: "Write the gradient.", items: [{ type: "answerLine", prefix, suffix, answer, inline: false }] }] }] },
            { heading: "B", cards: [{ title: "Two", items: [{ type: "text", text: "Text." }] }] },
            { heading: "C", cards: [{ title: "Three", items: [{ type: "text", text: "Text." }] }] },
          ],
        },
        { columns: [{ heading: "D", cards: [{ title: "Four", items: [{ type: "text", text: "Text." }] }] }, { heading: "E", cards: [] }, { heading: "F", cards: [] }] },
      ],
    },
  } as never);

const svgOf = (doc: Resource, view: "pupil" | "answers") => {
  const page = renderResource(doc, { view }).pages[0] as unknown;
  return typeof page === "string" ? page : (page as { svg: string }).svg;
};
/** Where the answer line sits: a taller answer row puts it lower. */
const answerLineY = (svg: string) => {
  const lines = [...svg.matchAll(/<line x1="[\d.]+" y1="([\d.]+)" x2="[\d.]+" y2="[\d.]+" stroke="#262720" stroke-width="0.3"\/>/g)];
  return Number(lines[lines.length - 1][1]);
};

describe("answer-line fractions", () => {
  it("writes inline fractions, mixed numbers and fraction characters as stacked markup", () => {
    expect(stackAnswerText("1/3")).toBe("{1/3}");
    expect(stackAnswerText("2 1/2")).toBe("2{1/2}");
    expect(stackAnswerText("2½")).toBe("2{1/2}");
    expect(stackAnswerText("−2½")).toBe("−2{1/2}");
    expect(stackAnswerText("y = ½x − 1")).toBe("y = {1/2}x − 1");
    expect(stackAnswerText("2/4 = 1/2")).toBe("{2/4} = {1/2}");
    expect(stackAnswerText("{3/4}")).toBe("{3/4}");
    for (const plain of ["m/s", "1/2/2026", "0.5", "(3, 2)", "12"]) expect(stackAnswerText(plain)).toBe(plain);
    expect(answerHasFraction("2½", true)).toBe(true);
    expect(answerHasFraction("2½", false)).toBe(false);
    expect(answerHasFraction("12", true)).toBe(false);
  });

  it("prints a saved mixed-number answer as a whole number beside a stacked fraction (maths notation)", () => {
    const answers = svgOf(sheet("maths", "2½"), "answers");
    expect(answers).toContain('data-fraction="stacked"');
    expect(answers).not.toContain("½");
    expect(svgOf(sheet("maths", "2½"), "pupil")).not.toContain('data-fraction="stacked"');
  });

  it("stacks fractions in an answer line's prefix and suffix", () => {
    const pupil = svgOf(sheet("maths", "", "y = {1/2}x +", "1/4 m"), "pupil");
    expect(pupil.match(/data-fraction="stacked"/g)).toHaveLength(2);
  });

  it("gives a fraction answer row more height, the same in both copies", () => {
    // A prefix keeps both answers on their own row (a short answer may sit on the question's line).
    const plainRow = svgOf(sheet("maths", "12", "m ="), "answers"),
      tallPupil = svgOf(sheet("maths", "1/3", "m ="), "pupil"),
      tallAnswers = svgOf(sheet("maths", "1/3", "m ="), "answers");
    expect(answerLineY(tallPupil)).toBe(answerLineY(tallAnswers));
    expect(answerLineY(tallPupil)).toBeGreaterThan(answerLineY(plainRow));
  });

  it("leaves plain-notation sheets printing as typed", () => {
    const answers = svgOf(sheet("plain", "2½"), "answers");
    expect(answers).not.toContain('data-fraction="stacked"');
    expect(answers).toContain("2½");
    expect(answerLineY(svgOf(sheet("plain", "2½", "m ="), "answers"))).toBe(answerLineY(svgOf(sheet("plain", "12", "m ="), "answers")));
  });

  it("writes the stacked answer as a Word equation", async () => {
    const font = (seed: number) => Uint8Array.from({ length: 64 }, (_, i) => (i * 7 + seed) % 256);
    const word = async (doc: Resource) => {
      const { bytes, issues } = await writeWorksheetDocx(doc, {
        view: "answers",
        fonts: { regular: font(1), semiBold: font(2), italic: font(3) },
        picture: (svg) => ({ svg, png: new Uint8Array([137, 80, 78, 71]) }),
      });
      expect(issues).toEqual([]);
      return strFromU8(unzipSync(bytes)["word/document.xml"]);
    };
    const maths = await word(sheet("maths", "2 1/2"));
    expect(maths).toMatch(/2<\/w:t><\/w:r><m:oMath><m:f>/);
    const plain = await word(sheet("plain", "2 1/2"));
    expect(plain).not.toContain("<m:f>");
    expect(plain).toContain("2 1/2");
  });
});

const withItems = (notation: "plain" | "maths", items: unknown[]): Resource =>
  validate({
    tool: "resource",
    schemaVersion: 1,
    document: {
      kind: "worksheet-a3",
      title: "Cell fractions",
      code: "TEST",
      objective: "Tables and circle-one options with fractions",
      notation,
      sides: [
        { columns: [{ heading: "A", cards: [{ title: "One", items }] }, { heading: "B", cards: [] }, { heading: "C", cards: [] }] },
        { columns: [{ heading: "D", cards: [] }, { heading: "E", cards: [] }, { heading: "F", cards: [] }] },
      ],
    },
  } as never);
const fractionTable = {
  type: "table",
  columns: ["x", "m"],
  rows: [
    [{ text: "1", state: "supplied" }, { text: "1/2", state: "supplied" }],
    [{ text: "2", state: "supplied" }, { text: "2½", state: "hidden" }],
  ],
};
const circle = { type: "choice", mode: "circle", options: ["1/2", "2 1/2", "3"], answer: 1 };
const tableHeight = (svg: string) => Number(svg.match(/<path d="M0,0H[\d.]+V([\d.]+)H0Z/)![1]);

describe("table cells and circle-one options", () => {
  it("prints table fractions stacked in taller rows, the same in both copies", () => {
    const pupil = svgOf(withItems("maths", [fractionTable]), "pupil"),
      answers = svgOf(withItems("maths", [fractionTable]), "answers");
    expect(pupil.match(/data-fraction="stacked"/g)).toHaveLength(1);
    expect(answers.match(/data-fraction="stacked"/g)).toHaveLength(2);
    expect(tableHeight(pupil)).toBe(tableHeight(answers));
    expect(tableHeight(pupil)).toBeGreaterThan(tableHeight(svgOf(withItems("plain", [fractionTable]), "pupil")));
    expect(svgOf(withItems("plain", [fractionTable]), "answers")).toContain("2½");
  });

  it("prints circle-one fractions stacked and rings the chosen one in the answers copy", () => {
    const answers = svgOf(withItems("maths", [circle]), "answers");
    expect(answers.match(/data-fraction="stacked"/g)).toHaveLength(2);
    expect(answers).toMatch(/<ellipse[^>]*ry="4.2"/);
    expect(svgOf(withItems("plain", [circle]), "answers")).not.toContain('data-fraction="stacked"');
  });

  it("writes table and circle-one fractions as Word equations, boxing the chosen option", async () => {
    const font = (seed: number) => Uint8Array.from({ length: 64 }, (_, i) => (i * 7 + seed) % 256);
    const { bytes, issues } = await writeWorksheetDocx(withItems("maths", [fractionTable, circle]), {
      view: "answers",
      fonts: { regular: font(1), semiBold: font(2), italic: font(3) },
      picture: (svg) => ({ svg, png: new Uint8Array([137, 80, 78, 71]) }),
    });
    expect(issues).toEqual([]);
    const xml = strFromU8(unzipSync(bytes)["word/document.xml"]);
    expect(xml.match(/<m:f>/g)).toHaveLength(4);
    expect(xml).toMatch(/<m:borderBox><m:e><m:r>[^]*?2<\/m:t><\/m:r><m:f>/);
  });
});
