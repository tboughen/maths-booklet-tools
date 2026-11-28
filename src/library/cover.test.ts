import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { coverLibrary, coverPlan, coverSuggestions, isCoverWork, nextSchoolDay, officeText, planSentence, ukDay, type CoverLogEntry } from "./cover";
import type { Library, Resource } from "./model";

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

describe("the Cover library", () => {
  const now = new Date(2026, 11, 10, 9, 0);
  const res = (id: string, note: string, updated = "2026-12-01", unit = "REVIEW") => ({ id, year: 10, unit, version: "Main", note, title: id, type: "revision-lesson", status: "waiting", updated, history: [],
    files: [{ role: "answers", format: "pdf", name: "a.pdf", bytes: 1, href: `bank/assets/${id}-a.pdf` }, { role: "pupil", format: "pdf", name: "p.pdf", bytes: 1, href: `bank/assets/${id}-p.pdf` }] }) as Resource;
  const req = (number: number, date: string | null, state: CoverLogEntry["state"] = "ready") => ({ number, when: "2026-12-01T08:00:00Z", year: 10, tier: "Foundation", className: "10X2", room: "M4", date, who: "Ann Lee", mine: false, text: "NP17", state }) as CoverLogEntry;

  it("knows cover work by its shelf and note", () => {
    expect(isCoverWork({ unit: "REVIEW", note: "Cover request #41" })).toBe(true);
    expect(isCoverWork({ unit: "REVIEW", note: "Cover lesson, 2026-11-26" })).toBe(true);
    expect(isCoverWork({ unit: "REVIEW", note: "Mock revision" })).toBe(false);
    expect(isCoverWork({ unit: "A7", note: "Cover lesson" })).toBe(false);
  });

  it("merges requests with their booklets, most recent lesson date first, folding entries over 7 days old", () => {
    const resources = [res("built-41", "Cover request #41. Class 10X2, room M4, 2026-12-09."), res("a7-hand", "Cover lesson, 2026-11-26", "2026-11-26"), res("gone-30", "Cover request #30"), res("mock", "Mock revision")];
    const { recent, older } = coverLibrary([req(42, "2026-12-11", "building"), req(41, "2026-12-09"), req(30, "2026-12-08"), req(29, null, "stopped")], resources, new Set(["gone-30"]), now);
    expect(recent.map((e) => [e.key, e.date, e.state])).toEqual([["q42", "2026-12-11", "building"], ["q41", "2026-12-09", "ready"]]);
    expect(recent[1].resource?.id).toBe("built-41");
    expect(older.map((e) => [e.key, e.date, e.state, e.className])).toEqual([["q29", "2026-12-01", "stopped", "10X2"], ["a7-hand", "2026-11-26", "ready", null]]);
  });

  it("still lists a built booklet when its request is no longer in the log, reading class, room and date from its note", () => {
    const { recent } = coverLibrary([], [res("built-7", "Cover request #7. Class 9H1, room Science Lab 3, 2026-12-07.")], new Set(), now);
    expect(recent.map((e) => [e.number, e.className, e.room, e.date])).toEqual([[7, "9H1", "Science Lab 3", "2026-12-07"]]);
  });

  it("starts the date box on the next weekday and writes dates the UK way", () => {
    expect(nextSchoolDay(new Date(2026, 10, 27, 7))).toBe("2026-11-30");
    expect(nextSchoolDay(new Date(2026, 10, 24, 7))).toBe("2026-11-25");
    expect(ukDay("2026-11-28")).toBe("Sat 28 Nov");
  });
});
