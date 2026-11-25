import { describe, expect, it } from "vitest";
import { applyChecks, lessonPlan, predictFeedback, loadFeedback, loadLibrary, partRanges, readState, searchLibrary, summary, threadMap, unitOf, versionsOf, writeState, type Feedback, type Library, type Resource, type Thread } from "./model";

const file = (role: "pupil" | "answers", format: "pdf" | "docx" = "pdf") => ({ role, format, name: `x_${role}.${format}`, bytes: 1, href: `library-data/files/${"a".repeat(64)}/x_${role}.${format}` });
const res = (over: Partial<Resource>): Resource => ({ id: "r", year: 9, unit: "A7", version: "Main", title: "Gradient", type: "lesson-booklet", status: "ready", updated: "2026-11-22", files: [file("pupil")], history: [], ...over });
const lessons = ["A7.01", "A7.02", "A7.03", "A7.04"].map((code) => ({ code, title: `Planned ${code}` }));
const list: Library = {
  schema: "mathsdock-library-served/2", published: "2026-11-24T12:00:00Z",
  years: [{ year: 9, now: "A7", sections: [{ name: "Autumn term", estimate: true, units: [{ code: "A7", title: "Algebraic proficiency: visualising", lessons, parts: [{ name: "Part 1", from: "A7.01", to: "A7.02" }, { name: "Part 2", from: "A7.03", to: "A7.04" }] }, { code: "SP7", title: "Understanding risk" }] }, { name: "Also for Year 9", units: [{ code: "STARTERS", title: "Silent starters" }] }] }],
  resources: [
    res({ id: "a", lesson: "A7.03", title: "Gradient (positive)" }),
    res({ id: "b", lesson: "A7.00", title: "Unit start", status: "waiting" }),
    res({ id: "c", lesson: "A7.01", title: "Plot", version: "Foundation", status: "waiting" }),
    res({ id: "d", type: "unit-booklet", title: "Whole A7", part: "Part 2" }),
    res({ id: "e", unit: "SP7", lesson: "SP7.02", title: "Multiplication law" }),
    res({ id: "f", unit: "STARTERS", type: "starter", title: "Silent starter 2" }),
    res({ id: "g", unit: "STARTERS", type: "starter", title: "Silent starter 1", status: "waiting" }),
  ],
};
const thread = (over: Partial<Thread>): Thread => ({ number: 1, year: 9, unit: "A7", version: "Main", lesson: "A7.03", kind: "lesson", queued: false, agreed: false, opened: "2026-11-25T09:00:00Z", comments: [], ...over });

describe("Resource library list", () => {
  it("lists planned lessons in order with made ones in place, and feedback turns a lesson violet", () => {
    const rows = lessonPlan(list, 9, "A7", "Main", threadMap([thread({})]));
    expect(rows.map((r) => [r.code, r.state])).toEqual([["A7.00", "waiting"], ["A7.01", "none"], ["A7.02", "none"], ["A7.03", "feedback"], ["A7.04", "none"]]);
    expect(rows[3].title).toBe("Planned A7.03");
    expect(summary(rows)).toBe("1 of 5 ready · 1 waiting");
    expect(summary(lessonPlan(list, 9, "SP7", "Foundation"))).toBe("Nothing yet");
    expect(lessonPlan(list, 9, "A7", "Foundation").map((r) => r.state)).toEqual(["waiting", "none", "none", "none"]);
  });
  it("gives starters a row each, and keeps versions and parts", () => {
    expect(lessonPlan(list, 9, "STARTERS", "Main").map((r) => r.title)).toEqual(["Silent starter 1", "Silent starter 2"]);
    expect(versionsOf(list, 9, "A7")).toEqual(["Main", "Foundation"]);
    const rows = lessonPlan(list, 9, "A7", "Main");
    expect(partRanges(unitOf(list, 9, "A7"), rows)?.map((p) => [p.start, p.end])).toEqual([[1, 2], [3, 4]]);
    expect(partRanges(unitOf(list, 9, "SP7"), rows)).toBeNull();
  });
  it("finds booklets by code, unit title, version and status, needing every word", () => {
    expect(searchLibrary(list, "a7.03").map((r) => r.id)).toEqual(["a"]);
    expect(searchLibrary(list, "risk").map((r) => r.id)).toEqual(["e"]);
    expect(searchLibrary(list, "foundation").map((r) => r.id)).toEqual(["c"]);
    expect(searchLibrary(list, "waiting starter").map((r) => r.id)).toEqual(["g"]);
    expect(searchLibrary(list, "  ")).toEqual([]);
  });
  it("keeps its state in the address", () => {
    const state = { year: 9, unit: "A7", version: "Foundation", view: "shelves" as const, q: "" };
    expect(writeState(state)).toBe("?year=9&unit=A7&version=Foundation");
    expect(writeState({ ...state, version: "Main" })).toBe("?year=9&unit=A7");
    expect(readState(writeState(state))).toEqual(state);
    expect(readState("?year=12&view=map", 8)).toEqual({ year: 8, unit: undefined, version: undefined, view: "map", q: "" });
  });
  it("explains a list it cannot load", async () => {
    await expect(loadLibrary(async () => new Response("", { status: 403 }))).rejects.toThrow(/Sign in again/);
    await expect(loadLibrary(async () => new Response("", { status: 500 }))).rejects.toThrow(/could not be loaded/);
    await expect(loadLibrary(async () => Response.json({ schema: "other", years: [{}], resources: [] }))).rejects.toThrow(/format/);
    const old = await loadLibrary(async () => Response.json({ ...list, schema: "mathsdock-library-served/1", resources: [{ ...list.resources[0], version: undefined, history: undefined, files: [file("pupil"), { ...file("answers"), role: "teacher-notes" }] }, { ...list.resources[1], type: "a3-worksheet" }] }));
    expect(old.resources).toEqual([{ ...list.resources[0], files: [file("pupil")] }]);
    await expect(loadLibrary(async () => Response.json(list))).resolves.toEqual(list);
  });
  it("treats feedback that is off or broken as off", async () => {
    await expect(loadFeedback(async () => Response.json({ error: "Feedback isn't switched on yet." }, { status: 503 }))).resolves.toEqual({ off: "Feedback isn't switched on yet." });
    await expect(loadFeedback(async () => new Response("<html>"))).resolves.toEqual({ off: "Feedback could not be loaded." });
    await expect(loadFeedback(async () => Response.json({ threads: [], canAct: true, me: "Tim" }))).resolves.toEqual({ threads: [], checks: {}, canAct: true, me: "Tim" });
  });
  it("shows a checked booklet green only at the version that was checked", () => {
    const base = { schema: "mathsdock-library-served/2", published: "", years: [], resources: [{ id: "a", year: 9, unit: "A7", lesson: "A7.01", version: "Main", title: "", type: "lesson-booklet", status: "waiting", updated: "2026-11-25", files: [], history: [] }] } as unknown as Library;
    const check = { updated: "2026-11-25", by: "Tim Boughen", at: "" };
    expect(applyChecks(base, { a: check }).resources[0]).toMatchObject({ status: "ready", checked: check });
    expect(applyChecks(base, { a: { ...check, updated: "2026-11-18" } }).resources[0].status).toBe("waiting");
    expect(applyChecks(base, {})).toBe(base);
  });
  it("predicts what an action does before the Worker answers", () => {
    const old = { threads: [], checks: {}, canAct: true, me: "Tim Boughen" } as Feedback;
    const key = { year: 9, unit: "A7", version: "Main", lesson: "A7.01" };
    const commented = predictFeedback(old, { action: "comment", ...key, text: " Q3 typo " }) as Extract<Feedback, { threads: unknown }>;
    expect(commented.threads[0]).toMatchObject({ lesson: "A7.01", kind: "lesson", comments: [{ who: "Tim Boughen", text: "Q3 typo" }] });
    const queued = predictFeedback(commented, { action: "queue", ...key }) as Extract<Feedback, { threads: unknown }>;
    expect(queued.threads[0].queued).toBe(true);
    const checked = predictFeedback(queued, { action: "check", ...key, id: "a", updated: "2026-11-25", close: true }) as Extract<Feedback, { threads: unknown }>;
    expect(checked.threads).toEqual([]);
    expect(checked.checks.a.by).toBe("Tim Boughen");
    expect((predictFeedback(checked, { action: "uncheck", ...key, id: "a" }) as Extract<Feedback, { checks: unknown }>).checks).toEqual({});
  });
});
