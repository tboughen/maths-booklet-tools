import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { validateBooklet, type Booklet } from "./booklet";
import { issuePlace, planBooklet, renderBooklet, topicLessonBooklet } from "./booklet-render";
import { writeBookletDocx } from "./booklet-docx";

// The four topic pages (BOOKLET-STANDARD N30, Tim 25 November 2026): cover, topic introduction,
// lessons, Know it (the fold-over page) and Do it (the revision page on the back cover).

const q = (title: string) => ({ title, items: [{ type: "text", text: "Work it out." }] });
const lesson = (title: string) => ({ title, sections: [{ kind: "practice", columns: 1, cards: [q("One")] }] });
const intro = { keywords: [{ word: "index", meaning: "how many times the base is multiplied" }] };
const retrieval = {
  title: "Know it",
  items: [
    { heading: "Words: say what each word means", question: "coefficient", answer: "the number in front of a letter" },
    { question: "subject", answer: "the letter on its own" },
    { heading: "Spot it", question: "In 4^3, which number is the index?", answer: "3" },
  ],
};
const revision = {
  title: "A4 Algebraic proficiency: revision",
  cards: [1, 2, 3].map((i) => ({ title: `Lesson ${i}`, items: [{ type: "text", text: "Example." }, { type: "text", text: "Try it: simplify 2x × 3x." }] })),
  answers: [
    { label: "1", answer: "6x^2" },
    { label: "2", answer: "h = A/5" },
  ],
};
function booklet(doc: Record<string, unknown> = {}, count = 1): Booklet {
  return validateBooklet({
    tool: "resource",
    schemaVersion: 1,
    document: { kind: "booklet-a4", title: "Algebraic proficiency", code: "A4", notation: "maths", intro, retrieval, revision, lessons: Array.from({ length: count }, (_, i) => lesson(`Lesson title ${i}`)), ...doc },
  });
}
const fonts = { regular: new Uint8Array(8), semiBold: new Uint8Array(8), italic: new Uint8Array(8) };

describe("the four topic pages", () => {
  it("lists the topic introduction, lessons, Know it and Do it on the cover with their pages", () => {
    const plan = planBooklet(booklet());
    expect(plan.contents.map((c) => [c.title, c.page])).toEqual([
      ["Topic introduction", 2],
      ["Lesson title 0", 3],
      ["Know it", 4],
      ["A4 Algebraic proficiency: revision", 5],
    ]);
    expect(plan.revisionPage).toBe(5);
    expect(renderBooklet(booklet()).pages[0]).toContain("Inside this booklet");
  });

  it("prints Know it headings and the revision answers upside down in both copies", () => {
    for (const view of ["pupil", "answers"] as const) {
      const r = renderBooklet(booklet(), { view });
      expect(r.pages[3]).toContain("Spot it");
      const last = r.pages[r.pages.length - 1];
      expect(last).toContain("rotate(180");
      expect(last).toContain("Lesson 3");
    }
  });

  it("flags a side count that is not a multiple of 4 and a lesson that starts on a left-hand page", () => {
    const issues = renderBooklet(booklet({}, 2)).issues.map((i) => i.message);
    expect(issues.some((m) => m.includes("multiple of 4"))).toBe(true);
    expect(issues.some((m) => m.includes("Lesson 2 starts on page 4"))).toBe(true);
    // Booklets without the revision page keep their old shape and are not checked.
    expect(renderBooklet(booklet({ revision: null }, 2)).issues.some((i) => i.message.includes("multiple of 4"))).toBe(false);
  });

  it("refuses a revision page taller than one side, naming the page", () => {
    const tall = { ...revision, cards: Array.from({ length: 12 }, (_, i) => ({ title: `Lesson ${i}`, items: [{ type: "space", kind: "working", heightMm: 40 }] })) };
    const issue = renderBooklet(booklet({ revision: tall })).issues.find((i) => i.message.includes("one side"));
    expect(issue?.revision).toBe(true);
    expect(issuePlace(issue!)).toContain("revision page");
  });

  it("makes a one-lesson topic booklet that keeps the lesson's number in the unit", () => {
    const b = booklet({ firstLessonNumber: 0 }, 3);
    const one = topicLessonBooklet(b, 2);
    expect(planBooklet(one).contents.map((c) => c.label)).toContain("Lesson 2");
    expect(renderBooklet(one).pages).toHaveLength(5);
  });

  it("writes the revision page and Know it headings to Word", async () => {
    const { bytes } = await writeBookletDocx(booklet(), { view: "pupil", fonts, picture: (s) => ({ svg: s, png: new Uint8Array([137, 80, 78, 71]) }) });
    const xml = Object.entries(unzipSync(bytes))
      .filter(([k]) => k.endsWith(".xml"))
      .map(([, v]) => strFromU8(v))
      .join("\n");
    expect(xml).toContain("Inside this booklet");
    expect(xml).toContain("Spot it");
    expect(xml).toContain("Answers, upside down");
  });
});
