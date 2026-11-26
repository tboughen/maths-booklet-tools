import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { validateBooklet, type Booklet } from "./booklet";
import { misconceptionLines, planBooklet, renderBooklet } from "./booklet-render";
import { writeBookletDocx } from "./booklet-docx";

// Common misconceptions (Tim, 25 November 2026): a "Watch for" box and an "Ask" box either side of
// the page number, in the footer of the page where a section starts, in the ANSWERS copy only.

const q = (title: string) => ({ title, items: [{ type: "text", text: "Work it out." }] });
const SQUARES = { watch: "counting squares, not reading the axes (Mei, Q21).", ask: "What does one square stand for on each axis?", source: "Examiner report June 2018 3H Q12" };
const FLIP = { watch: "the fraction upside down: right ÷ up, not up ÷ right.", ask: "How far up does it go for 1 right?", source: "Examiner report June 2018 3H Q12" };

function booklet(sections: unknown[]): Booklet {
  return validateBooklet({
    tool: "resource",
    schemaVersion: 1,
    document: { kind: "booklet-a4", title: "Visualising", code: "A7", lessons: [{ title: "Find the gradient of a straight line (positive)", code: "A7.03", sections }] },
  });
}
const tall = (n: number) => Array.from({ length: n }, (_, i) => ({ title: `Card ${i + 1}`, items: [{ type: "text", text: "Work it out." }, { type: "space", kind: "working", heightMm: 200 }] }));
const lesson = (a?: object, b?: object) =>
  booklet([
    { kind: "worked", title: "Whole-number gradients", columns: 2, startBanner: "Stage 1", cards: tall(2) },
    { kind: "worked", title: "Scaled axes", columns: 2, startBanner: "Stage 2", cards: tall(2), ...(a ? { misconception: a } : {}) },
    { kind: "worked", title: "Fractions", columns: 2, startBanner: "Stage 3", cards: tall(2), ...(b ? { misconception: b } : {}) },
    { kind: "challenge", instruction: "Show your working.", columns: 2, cards: [q("Challenge A"), q("Challenge B")] },
  ]);
const docx = async (b: Booklet, view: "pupil" | "answers") => {
  const { bytes } = await writeBookletDocx(b, { view, fonts: { regular: new Uint8Array(8), semiBold: new Uint8Array(8), italic: new Uint8Array(8) }, picture: (s) => ({ svg: s, png: new Uint8Array([137, 80, 78, 71]) }) });
  const files = unzipSync(bytes);
  return Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strFromU8(v)]));
};

describe("misconceptions in the answers copy", () => {
  it("prints in the answers footer only", () => {
    const b = lesson(SQUARES, FLIP);
    const answers = renderBooklet(b, { view: "answers" });
    const svg = answers.pages.join("");
    expect(svg).toContain(">Watch<");
    expect(svg).toContain(">(Mei,<");
    expect(svg).toContain(">Ask:<");
    expect(answers.issues.filter((i) => /misconception/i.test(i.message))).toEqual([]);
    const pupil = renderBooklet(b, { view: "pupil" }).pages.join("");
    expect(pupil).not.toContain(">Watch<");
    expect(pupil).not.toContain(">(Mei,<");
  });

  it("never moves the page layout", () => {
    const plain = planBooklet(lesson());
    const noted = planBooklet(lesson(SQUARES, FLIP), { view: "answers" });
    expect(noted.pages.map((p) => p.blocks.map((x) => [x.kind, x.y, x.h]))).toEqual(plain.pages.map((p) => p.blocks.map((x) => [x.kind, x.y, x.h])));
  });

  it("refuses text that needs more than two lines, rather than shrinking it", () => {
    expect(misconceptionLines(SQUARES)).not.toBeNull();
    const long = { ...SQUARES, watch: "counting squares on both axes instead of reading the numbers printed beside them when an axis goes up in fives" , ask: "What does one square stand for on each axis, and how do you know from the numbers?" };
    expect(misconceptionLines(long)).toBeNull();
    const issues = renderBooklet(lesson(long), { view: "answers" }).issues;
    expect(issues.some((i) => /more than two lines/.test(i.message))).toBe(true);
  });

  it("reports a note whose page footer is the end band", () => {
    const b = booklet([{ kind: "challenge", instruction: "Show your working.", columns: 2, cards: [q("Challenge A")], misconception: SQUARES }]);
    const issues = renderBooklet(b, { view: "answers" }).issues;
    expect(issues.some((i) => /cannot print/.test(i.message))).toBe(true);
  });

  it("gives a noted page its own Word footer in the answers copy only", async () => {
    const a = await docx(lesson(SQUARES, FLIP), "answers");
    const notes = Object.keys(a).filter((k) => /footer-note\d\.xml$/.test(k));
    expect(notes).toHaveLength(2);
    expect(notes.map((k) => a[k]).join("")).toContain("Watch");
    expect(a["word/document.xml"]).toContain("rIdNoteFooter1");
    const p = await docx(lesson(SQUARES, FLIP), "pupil");
    expect(Object.keys(p).some((k) => /footer-note/.test(k))).toBe(false);
  });

  it("sees a misconception on a check-in folded into its START banner", () => {
    const b = booklet([
      { kind: "check-in", title: "", columns: 2, cards: [q("A"), q("B")], misconception: SQUARES },
      { kind: "worked", title: "Stage one", columns: 2, startBanner: "Stage 1", cards: tall(2) },
      { kind: "challenge", instruction: "Show your working.", columns: 2, cards: [q("Challenge A")] },
    ]);
    const issues = renderBooklet(b, { view: "answers" }).issues;
    expect(issues.some((i) => /misconception/i.test(i.message))).toBe(true);
  });

  it("keeps formatting that spans words and spots a spaced fraction", () => {
    const lines = misconceptionLines({ ...SQUARES, watch: "the fraction *upside down* here" });
    const words = lines!.left.flat();
    expect(words.some((w) => w.text.includes("*"))).toBe(false);
    expect(misconceptionLines({ ...SQUARES, watch: "writing {a + b/2} wrongly" }, true)).toBeNull();
  });
});
