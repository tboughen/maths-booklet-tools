import { describe, expect, it } from "vitest";
import { a7Booklet } from "./booklet-fixtures";
import { lessonChecks, scriptChecks, svgPlainText } from "./booklet-checks";
import { renderBooklet, singleLessonBooklet } from "./booklet-render";
import { validateBooklet, type Booklet } from "./booklet";

const one = (): Booklet => validateBooklet(singleLessonBooklet(a7Booklet, 0).booklet);

describe("booklet build checks, shared by the build script and the Booklet builder", () => {
  it("names a retrieval heading that says From earlier (N13)", () => {
    const b = structuredClone(one());
    b.document.lessons[0].sections[0].title = "From earlier";
    const r = scriptChecks({ source: { working: [] }, lesson: b.document.lessons[0], lessonNumber: 3, pages: {} });
    expect(r.findings.some((f) => f.check === "N13" && /From earlier/.test(f.message))).toBe(true);
  });

  it("reports printed questions with no stored working (M1)", () => {
    const b = one();
    const r = scriptChecks({ source: { working: [] }, lesson: b.document.lessons[0], lessonNumber: 1, pages: {} });
    expect(r.findings.some((f) => f.check === "M1" && /No stored working/.test(f.message))).toBe(true);
  });

  it("runs every lesson check without files: sides, cycles and the script checks", () => {
    const b = one();
    const r = lessonChecks({ booklet: b, working: [], sides: 99 }, 0);
    expect(r.pages.pupil.length).toBeGreaterThan(0);
    expect(r.pages.pupil.length).toBe(r.pages.answers.length);
    expect(r.findings.some((f) => f.check === "B2" && /exactly 99/.test(f.message))).toBe(true);
    expect(r.findings.some((f) => f.check === "M1")).toBe(true);
  });

  it("reads the printed words off the pages for the wording rules", () => {
    expect(svgPlainText(['<svg><text x="1">Go <tspan font-style="italic">x</tspan> &amp; y</text><text>across</text></svg>'])).toBe("Go x & y\nacross");
    const b = structuredClone(one());
    b.document.lessons[0].sections[0].instruction = "Count across the grid.";
    expect(lessonChecks({ booklet: b, working: [] }, 0).findings.some((f) => f.check === "L14")).toBe(true);
  });
});

describe("where each card is drawn, for editing on the page", () => {
  it("places every lesson card once, inside its A4 page", () => {
    const r = renderBooklet(a7Booklet);
    const cards = a7Booklet.document.lessons.reduce((n, l) => n + l.sections.reduce((k, s) => k + s.cards.length, 0), 0);
    expect(r.cards.length).toBe(cards);
    const keys = new Set(r.cards.map((c) => `${c.lesson}.${c.section}.${c.card}`));
    expect(keys.size).toBe(cards);
    for (const c of r.cards) {
      expect(c.page).toBeGreaterThan(1);
      expect(c.page).toBeLessThanOrEqual(r.pages.length);
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + c.w).toBeLessThanOrEqual(210.01);
      expect(c.y + c.h).toBeLessThanOrEqual(297.01);
    }
  });

  it("puts each card on a page of its own lesson", () => {
    const r = renderBooklet(a7Booklet);
    for (const c of r.cards) {
      const first = r.lessonPages[c.lesson];
      const next = r.lessonPages[c.lesson + 1] ?? r.pages.length + 1;
      expect(c.page).toBeGreaterThanOrEqual(first);
      expect(c.page).toBeLessThan(next);
    }
  });
});
