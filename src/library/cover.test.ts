import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { coverPlan, coverSuggestions, isCoverLesson, isOldCover, officeText, planSentence, recentRequests, type CoverLogEntry } from "./cover";
import type { Library } from "./model";

const lessons = (unit: string, n: number) => Array.from({ length: n }, (_, i) => ({ code: `${unit}.${String(i + 1).padStart(2, "0")}`, title: `${unit} lesson ${i + 1}` }));
const list = { schema: "mathsdock-library-served/2", published: "", resources: [], years: [
  { year: 10, sections: [{ name: "Autumn", units: [{ code: "SP8", title: "Probability", lessons: lessons("SP8", 5) }, { code: "NP17", title: "Ratio and proportion", lessons: lessons("NP17", 6) }] }] },
] } as unknown as Library;

describe("the cover request check", () => {
  it("revises a named unit up to the named lesson and no further", () => {
    for (const text of ["We're on NP17, lesson 3. Revise the lessons so far.", "np17.03 please", "lesson 3 of NP17"]) {
      const plan = coverPlan(list, 10, text);
      expect(plan.lessons.map((l) => l.code)).toEqual(["NP17.01", "NP17.02", "NP17.03"]);
      expect(plan.upTo).toBe("NP17.03");
    }
    expect(planSentence(coverPlan(list, 10, "NP17 lesson 2"), "Year 10 Foundation", null)).toBe("I'll make one cover lesson for Year 10 Foundation revising NP17.01 to NP17.02: NP17 lesson 1; NP17 lesson 2.");
  });

  it("asks which lesson when only the unit is named, and follows the description when no unit is", () => {
    const plan = coverPlan(list, 10, "Something on SP8 please");
    expect(plan).toMatchObject({ needsLesson: true, lessons: [] });
    expect(coverPlan(list, 10, "Something on SP8 please", "SP8.02").lessons.map((l) => l.code)).toEqual(["SP8.01", "SP8.02"]);
    const free = coverPlan(list, 10, "Mock revision for Paper 3");
    expect(free.unit).toBeNull();
    expect(planSentence(free, "Year 11 Higher", "Mock Paper 3.pptx")).toBe("I'll make one cover lesson for Year 11 Higher from your description, using the attached file (Mock Paper 3.pptx).");
    expect(coverPlan(list, 9, "NP17 lesson 3").unit).toBeNull();
  });

  it("ignores lesson numbers away from the unit, and lets a code that isn't a unit be waved away", () => {
    expect(coverPlan(list, 10, "Last lesson 5 pupils were out. Revise NP17 please.")).toMatchObject({ needsLesson: true, upTo: null });
    expect(coverPlan(list, 10, "Revise SP8 (lesson 2)").upTo).toBe("SP8.02");
    expect(coverPlan(list, 10, "Mock revision on SP8 paper", "none")).toMatchObject({ unit: null, needsLesson: false });
  });

  it("never calls a suggestion a starter", () => {
    expect(JSON.stringify(coverSuggestions)).not.toMatch(/starter/i);
  });

  it("reads the words of a PowerPoint, slide by slide", async () => {
    const slide = (t: string) => strToU8(`<p:sld><a:t>${t}</a:t><a:t xml:space="preserve"> &amp; more</a:t></p:sld>`);
    const pptx = zipSync({ "ppt/slides/slide2.xml": slide("Ratio"), "ppt/slides/slide10.xml": slide("Best buys"), "ppt/slides/slide1.xml": slide("Rounding"), "ppt/media/x.png": new Uint8Array(4) });
    expect(await officeText(pptx)).toBe("Slide 1: Rounding & more\nSlide 2: Ratio & more\nSlide 3: Best buys & more");
  });
});

describe("old cover lessons", () => {
  const now = Date.parse("2026-12-10T09:00:00Z");
  const cover = { unit: "REVIEW", note: "Cover request #41", updated: "2026-12-02" };
  it("knows a cover lesson by its shelf and note", () => {
    expect(isCoverLesson(cover)).toBe(true);
    expect(isCoverLesson({ ...cover, note: "Mock revision" })).toBe(false);
    expect(isCoverLesson({ ...cover, unit: "A7" })).toBe(false);
  });
  it("folds a cover lesson away after 7 days, never another booklet", () => {
    expect(isOldCover(cover, now)).toBe(true);
    expect(isOldCover({ ...cover, updated: "2026-12-04" }, now)).toBe(false);
    expect(isOldCover({ ...cover, note: undefined }, now)).toBe(false);
  });
  it("lists the requests of the last 7 days", () => {
    const entry = (when: string) => ({ number: 1, when, year: 9, tier: "Higher", who: "A", mine: false, text: "", state: "ready" }) as CoverLogEntry;
    expect(recentRequests([entry("2026-12-09T10:00:00Z"), entry("2026-12-01T10:00:00Z")], now).map((r) => r.when)).toEqual(["2026-12-09T10:00:00Z"]);
  });
});
