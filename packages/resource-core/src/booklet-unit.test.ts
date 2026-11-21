import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { validateBooklet, type Booklet } from "./booklet";
import { issuePlace, lessonFileName, lessonPagesOf, planBooklet, renderBooklet, renderLessonNotes, singleLessonBooklet } from "./booklet-render";
import { writeBookletDocx } from "./booklet-docx";

// Full unit booklets (BOOKLET-STANDARD N12, Tim 18 and 20 November 2026): a unit may open with a
// "get ready" lesson 0, hold more than twelve lessons, and end with a fold-over retrieval page.

const q = (title: string) => ({ title, items: [{ type: "text", text: "Work it out." }] });
const lesson = (title: string) => ({ title, teacherNotes: "Go through it.", sections: [{ kind: "practice", columns: 1, cards: [q("One")] }] });
function unit(doc: Record<string, unknown> = {}, count = 2): Booklet {
  return validateBooklet({
    tool: "resource",
    schemaVersion: 1,
    document: { kind: "booklet-a4", title: "Straight line graphs", code: "A7", lessons: Array.from({ length: count }, (_, i) => lesson(`Lesson title ${i}`)), ...doc },
  });
}
const retrieval = { items: [{ question: "Write down the coordinates of the origin.", answer: "(0, 0)" }, { question: "Work out 2 − 3x when x = −2.", answer: "8" }] };
const docxXml = async (b: Booklet) => {
  const { bytes } = await writeBookletDocx(b, { view: "pupil", fonts: { regular: new Uint8Array(8), semiBold: new Uint8Array(8), italic: new Uint8Array(8) }, picture: (s) => ({ svg: s, png: new Uint8Array([137, 80, 78, 71]) }) });
  const files = unzipSync(bytes);
  return Object.keys(files)
    .filter((k) => k.endsWith(".xml"))
    .map((k) => strFromU8(files[k]))
    .join("\n");
};

describe("a unit that opens with lesson 0", () => {
  it("numbers its lessons from 0 on the contents, start tiles, end bands, notes and file names", async () => {
    const b = unit({ firstLessonNumber: 0 });
    expect(planBooklet(b).contents.map((c) => c.label)).toEqual(["Lesson 0", "Lesson 1"]);
    const { pages } = renderBooklet(b);
    expect(pages[1]).toContain("End of lesson 0");
    expect(pages[2]).toContain("End of lesson 1");
    expect(renderLessonNotes(b, 0).pages[0]).toContain("Lesson 0");
    expect(lessonFileName(b, 0)).toContain("Lesson 0");
    expect(await docxXml(b)).toContain("End of lesson 0");
    // A lesson printed on its own keeps its number in the unit.
    const single = singleLessonBooklet(b, 1);
    expect(renderBooklet(single.booklet, { numbering: single.numbering }).pages[1]).toContain("End of lesson 1");
  });

  it("holds up to sixteen lessons", () => {
    expect(unit({}, 13).document.lessons).toHaveLength(13);
    expect(() => unit({}, 17)).toThrow();
  });
});

describe("the fold-over retrieval page", () => {
  it("prints last, in the contents, with the answers in both copies beyond a dashed fold line", async () => {
    const b = unit({ retrieval });
    const plan = planBooklet(b);
    for (const view of ["pupil", "answers"] as const) {
      const r = renderBooklet(b, { view });
      expect(r.retrievalPage).toBe(r.pages.length);
      const last = r.pages[r.pages.length - 1];
      expect(last).toContain("Fold and test yourself");
      expect(last).toContain("(0, 0)");
      expect(last).toContain("stroke-dasharray=\"2.4 1.6\"");
      expect(r.issues).toEqual([]);
    }
    expect(plan.contents.at(-1)).toEqual({ label: "", title: "Fold and test yourself", page: plan.retrievalPage });
    const xml = await docxXml(b);
    expect(xml).toContain("Fold and test yourself");
    expect(xml).toContain('w:val="dashed"');
  });

  it("is not part of the last lesson or of a lesson printed on its own", () => {
    const b = unit({ retrieval });
    expect(lessonPagesOf(b, 1).pages.join("")).not.toContain("Fold and test yourself");
    expect(singleLessonBooklet(b, 1).booklet.document.retrieval).toBeNull();
  });

  it("reports a page too full and a stacked fraction it cannot print", () => {
    const many = { items: Array.from({ length: 20 }, () => ({ question: "A long question that wraps over more than one line of the page so the rows grow taller than they would otherwise be.", answer: "8" })) };
    expect(renderBooklet(unit({ retrieval: many })).issues.some((i) => /fold-over page needs/.test(i.message))).toBe(true);
    const full = renderBooklet(unit({ retrieval: many })).issues.find((i) => /fold-over page needs/.test(i.message))!;
    expect(issuePlace(full)).toMatch(/^fold-over page, page \d+$/);
    const frac = { items: [{ question: "Work out {3/4} of 8.", answer: "6" }] };
    expect(renderBooklet(unit({ retrieval: frac, notation: "maths" })).issues.some((i) => /stacked fraction/.test(i.message))).toBe(true);
  });
});
