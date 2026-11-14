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
    // retaken when the example's fractions became stacked, and when maths notation began typesetting
    // typed maths: the objective's y = mx ± c now prints with italic letters, and when ratio-table
    // fraction parts and operation labels rose to the 10 pt house minimum, U111). The PDF pages and the Word files are
    // both made from the plan, so any change here moves printed pages: update these only for a
    // deliberate change to the printed booklet.
    const sha = (pages: string[]) => createHash("sha256").update(pages.join("\n")).digest("hex");
    const unit = clone(a7Booklet);
    const [a, b] = a7Booklet.document.lessons;
    unit.document.lessons = Array.from({ length: 12 }, (_, i) => ({ ...structuredClone(i % 2 ? b : a), title: `${(i % 2 ? b : a).title} (${i + 1})`, code: `A7.${String(i + 1).padStart(2, "0")}` }));
    const one = singleLessonBooklet(a7Booklet, 1);
    expect(sha(renderBooklet(a7Booklet).pages)).toBe("65729b22e073f7d9f347fa6d3436144cc8024b331eaf1244378330cde25554dc");
    expect(sha(renderBooklet(a7Booklet, { view: "answers" }).pages)).toBe("fb0b945ae6a5301a442997ec1fafb166c6b0a908aefd108082706f169cd43304");
    expect(sha(renderBooklet(one.booklet, { view: "answers", numbering: one.numbering }).pages)).toBe("16478364f0780334f9b1ee56a447ecdbc83efb738ee01fb81ee4403a7bae249d");
    const whole = renderBooklet(unit);
    expect(whole.pages.length).toBe(62);
    expect(sha(whole.pages)).toBe("e424b51f3000bc9fecd1cdd485e7e57dc5e3418c54636e1913bf5caa99e84a69");
  });

  it("prints a booklet saved before notation existed exactly as before, flagging only the characters the font lacks", () => {
    // The example booklet as main saved it on 14 November 2026 (no notation field, ⅓ and ⅔ typed
    // as single characters). These are the hashes main pinned for it (retaken when ratio-table small text rose to
    // 10 pt, U111), so plain booklets are otherwise unchanged; the only difference is that ⅓ and ⅔, which printed as gaps, are now reported.
    const sha = (pages: string[]) => createHash("sha256").update(pages.join("\n")).digest("hex");
    const old = validateBooklet(structuredClone(savedBeforeNotation));
    expect(old.document.notation).toBe("plain");
    const unit = clone(old);
    const [a, b] = old.document.lessons;
    unit.document.lessons = Array.from({ length: 12 }, (_, i) => ({ ...structuredClone(i % 2 ? b : a), title: `${(i % 2 ? b : a).title} (${i + 1})`, code: `A7.${String(i + 1).padStart(2, "0")}` }));
    const one = singleLessonBooklet(old, 1);
    const pupil = renderBooklet(old);
    expect(sha(pupil.pages)).toBe("688b3962a0f5e227bb6007012358c903d79c615517a1160bceeaf5f8b6d9fc4f");
    expect(sha(renderBooklet(old, { view: "answers" }).pages)).toBe("daebdba6c8df239f18eb604d68ae5f0255bb6732791d6f3938bc5f55d6249783");
    expect(sha(renderBooklet(one.booklet, { view: "answers", numbering: one.numbering }).pages)).toBe("0d469393ff1f86d7ebd4b1c036d01dbaa61636269bf7f5deff190ef57ff93fed");
    const whole = renderBooklet(unit);
    expect(whole.pages.length).toBe(56);
    expect(sha(whole.pages)).toBe("c6932dda735b001cfb6d4260e335743fff22aae441c1abf190c0ffddc84b1519");
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
