import { describe, expect, it } from "vitest";
import { a7Booklet, exampleLessonSource } from "./booklet-fixtures";
import { bookletFileName, renderBooklet, styles, validateBooklet, type Booklet } from "./index";

const clone = (b: Booklet) => structuredClone(b);
const frames = (svg: string) => svg.match(/<rect x="0.15" y="0.15" width="[\d.]+" height="[\d.]+"/g);

describe("A4 booklet renderer", () => {
  it("lays out the example on A4 pages with a cover, an introduction and lessons on fresh pages", () => {
    for (const view of ["pupil", "answers"] as const) {
      const r = renderBooklet(a7Booklet, { view });
      expect(r.issues).toEqual([]);
      expect(r.pages.length).toBe(11);
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
