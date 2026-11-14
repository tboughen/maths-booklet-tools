import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { a7Booklet, exampleLessonSource } from "./booklet-fixtures";
import savedBeforeNotation from "./fixtures/booklet-saved-before-notation.json";
import { bookletFileName, renderBooklet, singleLessonBooklet, styles, validateBooklet, type Booklet } from "./index";

const clone = (b: Booklet) => structuredClone(b);
const frames = (svg: string) => svg.match(/<rect x="0.15" y="0.15" width="[\d.]+" height="[\d.]+"/g);

describe("A4 booklet renderer", () => {
  it("draws exactly the pages it drew when these hashes were taken", () => {
    // Hashes of the printed SVG pages (first taken from the renderer before planBooklet, then
    // retaken when the example's fractions became stacked). The PDF pages and the Word files are
    // both made from the plan, so any change here moves printed pages: update these only for a
    // deliberate change to the printed booklet.
    const sha = (pages: string[]) => createHash("sha256").update(pages.join("\n")).digest("hex");
    const unit = clone(a7Booklet);
    const [a, b] = a7Booklet.document.lessons;
    unit.document.lessons = Array.from({ length: 12 }, (_, i) => ({ ...structuredClone(i % 2 ? b : a), title: `${(i % 2 ? b : a).title} (${i + 1})`, code: `A7.${String(i + 1).padStart(2, "0")}` }));
    const one = singleLessonBooklet(a7Booklet, 1);
    expect(sha(renderBooklet(a7Booklet).pages)).toBe("e2d872ac34041a203f1b2d58e528ca09fd6d9bf5c6dc984a162648fc4d76ad6f");
    expect(sha(renderBooklet(a7Booklet, { view: "answers" }).pages)).toBe("851a9cfce695620c5b7d2999ecf315ef68afe0f16732a584c9f6f93d3f7c08fa");
    expect(sha(renderBooklet(one.booklet, { view: "answers", numbering: one.numbering }).pages)).toBe("8e3e506a0a0a754463483b268d8412da60aebdcd115eb3b22415882e02a9cd4f");
    const whole = renderBooklet(unit);
    expect(whole.pages.length).toBe(62);
    expect(sha(whole.pages)).toBe("f57e28e574a9d511135c2c56c0508004c2fbb4631fdf0ec565bce53d24b10e1e");
  });

  it("prints a booklet saved before notation existed exactly as before, flagging only the characters the font lacks", () => {
    // The example booklet as main saved it on 14 November 2026 (no notation field, ⅓ and ⅔ typed
    // as single characters). These are the hashes main pinned for it, so plain booklets are
    // unchanged; the only difference is that ⅓ and ⅔, which printed as gaps, are now reported.
    const sha = (pages: string[]) => createHash("sha256").update(pages.join("\n")).digest("hex");
    const old = validateBooklet(structuredClone(savedBeforeNotation));
    expect(old.document.notation).toBe("plain");
    const unit = clone(old);
    const [a, b] = old.document.lessons;
    unit.document.lessons = Array.from({ length: 12 }, (_, i) => ({ ...structuredClone(i % 2 ? b : a), title: `${(i % 2 ? b : a).title} (${i + 1})`, code: `A7.${String(i + 1).padStart(2, "0")}` }));
    const one = singleLessonBooklet(old, 1);
    const pupil = renderBooklet(old);
    expect(sha(pupil.pages)).toBe("66f85e9f74a801a38e6e61ab8b05aeb175430fe687cdd7381d07c8cb46fbe890");
    expect(sha(renderBooklet(old, { view: "answers" }).pages)).toBe("0eb57e6089f0874bdd0e793c2744c04d0670a08885f6329ce04dafb597009ce6");
    expect(sha(renderBooklet(one.booklet, { view: "answers", numbering: one.numbering }).pages)).toBe("2ee20b368fe52a7b35752d437d669aef37dbfae4060b07259dc62337ac318c82");
    const whole = renderBooklet(unit);
    expect(whole.pages.length).toBe(56);
    expect(sha(whole.pages)).toBe("310e2b6bd9a8227e01061b9d520346ac9dae3ee6d3baba242ef5ebee0ceaf452");
    expect(pupil.issues.length).toBeGreaterThan(0);
    for (const i of pupil.issues) expect(i.message).toMatch(/^Lesson 2, [A-Za-z ]+, question \d uses "[⅓⅔]" \(U\+215[34]\)/);
  });

  it("lays out the example on A4 pages with a cover, an introduction and lessons on fresh pages", () => {
    for (const view of ["pupil", "answers"] as const) {
      const r = renderBooklet(a7Booklet, { view });
      expect(r.issues).toEqual([]);
      expect(r.pages.length).toBe(12);
      expect(r.introPage).toBe(2);
      expect(r.lessonPages).toEqual([3, 5]);
      for (const p of r.pages) expect(p).toMatch(/^<svg [^>]*width="210mm" height="297mm" viewBox="0 0 210 297"/);
    }
  });

  it("lists every lesson with its first page on the cover", () => {
    const cover = renderBooklet(a7Booklet).pages[0];
    expect(cover).toContain("Contents");
    expect(cover).toContain("Plot a linear graph from its equation");
    expect(cover).toContain(">5</text>");
  });

  it("keeps saved answers out of the pupil copy and places both copies identically", () => {
    const pupil = renderBooklet(a7Booklet);
    const answers = renderBooklet(a7Booklet, { view: "answers" });
    expect(pupil.pages.join("")).not.toContain(styles.mathsdock.answer);
    expect(answers.pages.join("")).toContain(styles.mathsdock.answer);
    expect(answers.pages.map(frames)).toEqual(pupil.pages.map(frames));
  });

  it("numbers questions within each section but not worked examples", () => {
    const page = renderBooklet(a7Booklet).pages[5];
    // The worked pair opens page 6 with titles and no number tiles.
    expect(page).toContain("Worked example");
    expect(page).not.toMatch(/fill="white"[^>]*text-anchor="middle"[^>]*>1<\/text>/);
  });

  it("stacks fractions with maths notation and prints plain booklets as typed", () => {
    const maths = renderBooklet(a7Booklet).pages.join("");
    expect(maths).not.toContain("{1/3}");
    const plain = clone(a7Booklet);
    plain.document.notation = "plain";
    const typed = renderBooklet(plain);
    expect(typed.issues).toEqual([]);
    expect(typed.pages.join("")).toContain("{1/3}");
    // Stacked fractions are taller, so the plain copy never needs more pages.
    expect(typed.pages.length).toBeLessThanOrEqual(renderBooklet(a7Booklet).pages.length);
  });

  it("reports a character the font cannot print, naming the lesson and question", () => {
    const b = clone(a7Booklet);
    const diag = b.document.lessons[1].sections.find((s) => s.kind === "diagnostic")!;
    const choice = diag.cards[0].items.find((i) => i.type === "choice") as { options: string[] };
    choice.options[3] = "⅓";
    b.document.lessons[0].keyIdea += " ⅔";
    const issues = renderBooklet(b).issues.map((i) => i.message);
    expect(issues.some((m) => m.startsWith('Lesson 2, Diagnostic questions, question 1 uses "⅓" (U+2153)') && m.includes("{1/3}"))).toBe(true);
    expect(issues.some((m) => m.startsWith('Lesson 1 uses "⅔"'))).toBe(true);
  });

  it("is deterministic", () => {
    expect(renderBooklet(a7Booklet).pages).toEqual(renderBooklet(clone(a7Booklet)).pages);
  });

  it("starts a page break with the section heading marked continued", () => {
    const pages = renderBooklet(a7Booklet).pages;
    expect(pages.some((p) => p.includes("Your turn (continued)"))).toBe(true);
  });

  it("reports a card taller than a page instead of shrinking it", () => {
    const b = clone(a7Booklet);
    b.document.lessons[0].sections[0].cards[0].items.push({ type: "space", kind: "working", heightMm: 200 }, { type: "space", kind: "working", heightMm: 100 });
    const r = renderBooklet(b);
    expect(r.issues.some((i) => i.lesson === 1 && /more than a page holds/.test(i.message))).toBe(true);
  });

  it("reports a worksheet stage on a booklet card and never prints stored working", () => {
    const b = clone(a7Booklet);
    const card = b.document.lessons[0].sections[0].cards[0];
    const before = renderBooklet(b);
    card.working = "STORED-WORKING-NOT-PRINTED";
    const withWorking = renderBooklet(validateBooklet(b));
    expect(withWorking.pages).toEqual(before.pages);
    expect(withWorking.issues).toEqual(before.issues);
    card.stage = "Use your graph";
    const staged = renderBooklet(validateBooklet(b));
    expect(staged.pages).toEqual(before.pages);
    expect(staged.issues.some((i) => i.lesson === 1 && /worksheet stage, which booklets do not print/.test(i.message))).toBe(true);
  });

  it("prints grid paper in a booklet card and reports paper wider than the card", () => {
    const b = clone(a7Booklet);
    const items = b.document.lessons[0].sections[0].cards[0].items;
    items.push({ type: "paper", style: "squared", widthMm: 60, heightMm: 30 });
    expect(renderBooklet(validateBooklet(b)).issues.some((i) => /grid paper/.test(i.message))).toBe(false);
    items[items.length - 1] = { type: "paper", style: "squared", widthMm: 300, heightMm: 30 };
    expect(renderBooklet(validateBooklet(b)).issues.some((i) => /The grid paper is 300 mm wide/.test(i.message))).toBe(true);
  });

  it("reports a diagram too wide for a half-width card", () => {
    const b = clone(a7Booklet);
    const lesson = structuredClone(exampleLessonSource) as never as Booklet["document"]["lessons"][number];
    (lesson.sections[2].cards[0].items[0] as unknown as { diagram: { spec: { axes: { x: { positiveSquares: number } } } } }).diagram.spec.axes.x.positiveSquares = 12;
    b.document.lessons = [lesson];
    const r = renderBooklet(validateBooklet(b));
    expect(r.issues.some((i) => /never shrunk/.test(i.message))).toBe(true);
  });

  it("round-trips through JSON and refuses unknown fields", () => {
    expect(validateBooklet(JSON.parse(JSON.stringify(a7Booklet)))).toEqual(a7Booklet);
    const bad = JSON.parse(JSON.stringify(a7Booklet));
    bad.document.lessons[0].colour = "red";
    expect(() => validateBooklet(bad)).toThrow(/lessons\.0/);
  });

  it("names files by unit code and title", () => {
    expect(bookletFileName(a7Booklet)).toBe("A7_Algebraic proficiency visualising_Booklet_A4.pdf");
    expect(bookletFileName(a7Booklet, "answers")).toBe("A7_Algebraic proficiency visualising_Booklet_Answers_A4.pdf");
  });
});

describe("PDF fonts", () => {
  it("sends italic maths letters such as graph axis names to the maths font", async () => {
    const { mathFontForMathLetters } = await import("./pdf");
    const svg = `<text x="1" font-family="'STIX Two Text', 'STIX Two Math', serif">𝑦</text><text font-family="Inter">y = 2</text>`;
    const out = mathFontForMathLetters(svg);
    expect(out).toContain(`<text x="1" font-family="'STIX Two Math'">𝑦</text>`);
    expect(out).toContain(`<text font-family="Inter">y = 2</text>`);
  });
});

describe("one lesson on its own", () => {
  it("prints a lesson from a one-lesson booklet exactly as the full booklet does", async () => {
    const { lessonPagesOf, singleLessonBooklet, renderBooklet: render } = await import("./index");
    for (const view of ["pupil", "answers"] as const) {
      const full = lessonPagesOf(a7Booklet, 1, { view });
      const one = singleLessonBooklet(a7Booklet, 1);
      const r = render(one.booklet, { view, numbering: one.numbering });
      // Only the diagram id counters differ (they are unique per file, not per booklet).
      const ids = (pages: string[]) => pages.map((p) => p.replace(/\bd\d+-/g, "d-"));
      expect(ids(r.pages.slice(1))).toEqual(ids(full.pages));
      expect(full.pages[0]).toContain("Page 5");
    }
  });
});
