import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { validateBooklet, type Booklet } from "./booklet";
import { issuePlace, planBooklet, renderBooklet, topicLessonBooklet, topicPartBooklet, planRevision } from "./booklet-render";
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
    const four = renderBooklet(booklet({}, 2)).issues.find((i) => i.message.includes("multiple of 4"));
    expect(issuePlace(four!)).not.toContain("introduction");
    // Booklets without the revision page keep their old shape and are not checked.
    expect(renderBooklet(booklet({ revision: null }, 2)).issues.some((i) => i.message.includes("multiple of 4"))).toBe(false);
  });

  it("refuses a revision page taller than one side, naming the page", () => {
    const tall = { ...revision, cards: Array.from({ length: 12 }, (_, i) => ({ title: `Lesson ${i}`, items: [{ type: "space", kind: "working", heightMm: 40 }] })) };
    const issue = renderBooklet(booklet({ revision: tall })).issues.find((i) => i.message.includes("one side"));
    expect(issue?.revision).toBe(true);
    expect(issuePlace(issue!)).toContain("revision page");
  });

  it("checks revision cards for characters the font lacks", () => {
    const odd = { ...revision, cards: [{ title: "Lesson 1", items: [{ type: "text", text: "Find ⅓ of 6" }] }] };
    expect(renderBooklet(booklet({ revision: odd, notation: "plain" })).issues.some((i) => i.revision && i.message.includes("⅓"))).toBe(true);
  });

  it("makes a one-lesson topic booklet that keeps the lesson's number in the unit", () => {
    const b = booklet({ firstLessonNumber: 0 }, 3);
    const one = topicLessonBooklet(b, 2);
    expect(planBooklet(one).contents.map((c) => c.label)).toContain("Lesson 2");
    expect(renderBooklet(one).pages).toHaveLength(5);
    // The topic introduction lists every lesson of the topic, this one highlighted.
    expect(one.document.intro?.lessons).toHaveLength(3);
    expect(one.document.intro?.highlight).toEqual([2]);
    expect(renderBooklet(one).pages[1]).toContain("Lessons in this topic");
    expect(topicLessonBooklet(b, 0, { coverNote: "Year 8." }).document.coverNote).toBe("Year 8.");
  });

  it("puts the lesson code before its title on the cover", () => {
    const b = validateBooklet({ ...booklet(), document: { ...booklet().document, lessons: [{ ...lesson("Notation"), code: "A4.01" }] } });
    expect(planBooklet(b).contents[1].title).toBe("A4.01 Notation");
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

// Units in parts (N33, Tim 25 November 2026): the photocopiers take at most 64 sides.
describe("a unit in parts", () => {
  it("makes a part with Part n of m on the cover, its own lessons, and the whole unit highlighted on page 2", () => {
    const whole = booklet({ firstLessonNumber: 0 }, 6);
    const p = topicPartBooklet(whole, 2, 5, { n: 2, of: 2 });
    expect(p.document.lessons.map((l) => l.title)).toEqual(["Lesson title 2", "Lesson title 3", "Lesson title 4", "Lesson title 5"]);
    expect(p.document.firstLessonNumber).toBe(2);
    expect(p.document.intro?.lessons).toHaveLength(6);
    expect(p.document.intro?.highlight).toEqual([2, 3, 4, 5]);
    const r = renderBooklet(p);
    expect(r.pages[0].replace(/<[^>]+>/g, "")).toContain("Algebraic proficiency: Part 2 of 2");
    expect(r.pages[1]).toContain("Lesson 0: Lesson title 0");
    expect(r.pages.length % 4).toBe(0);
    expect(r.issues.filter((i) => /multiple of 4|photocopier|Part/.test(i.message))).toEqual([]);
    expect(() => topicPartBooklet(whole, 4, 6, { n: 2, of: 2 })).toThrow(RangeError);
  });

  it("reports a booklet longer than the photocopier takes", () => {
    const issues = renderBooklet(booklet({ maxSides: 4 }, 2)).issues.map((i) => i.message);
    expect(issues.some((m) => m.includes("at most 4"))).toBe(true);
    expect(renderBooklet(booklet({}, 2)).issues.some((i) => i.message.includes("photocopier"))).toBe(false);
  });

  it("runs four or fewer revision cards one to a row, and more in pairs", () => {
    const base = booklet().document.revision!;
    const four = planRevision({ ...base, cards: base.cards.concat(base.cards[0]) }, () => 30, true);
    expect(four.rows.map((r) => r.cards.length)).toEqual([1, 1, 1, 1]);
    const six = planRevision({ ...base, cards: [...base.cards, ...base.cards] }, () => 30, true);
    expect(six.rows.map((r) => r.cards.length)).toEqual([2, 2, 2]);
    const tall = planRevision({ ...base, cards: base.cards.concat(base.cards[0]) }, () => 70, true);
    expect(tall.rows.map((r) => r.cards.length)).toEqual([2, 2]);
  });

  it("puts Part n of m on the Word cover", async () => {
    const p = topicPartBooklet(booklet({}, 3), 0, 1, { n: 1, of: 2 });
    const { bytes } = await writeBookletDocx(p, { view: "pupil", fonts, picture: (s) => ({ svg: s, png: new Uint8Array([137, 80, 78, 71]) }) });
    const zip = unzipSync(bytes);
    expect(strFromU8(zip["word/document.xml"])).toContain("Part 1 of 2");
  });
});
