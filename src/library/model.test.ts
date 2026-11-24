import { describe, expect, it } from "vitest";
import { lessonRows, loadLibrary, readState, searchLibrary, writeState, type Library, type Resource } from "./model";

const file = (role: "pupil" | "answers", format: "pdf" | "docx" = "pdf") => ({ role, format, name: `x_${role}.${format}`, bytes: 1, href: `library-data/files/${"a".repeat(64)}/x_${role}.${format}` });
const res = (over: Partial<Resource>): Resource => ({ id: "r", year: 9, unit: "A7", title: "Gradient", type: "lesson-booklet", status: "ready", updated: "2026-11-22", files: [file("pupil")], ...over });
const list: Library = {
  schema: "mathsdock-library-served/1", published: "2026-11-24T12:00:00Z",
  years: [{ year: 9, sections: [{ name: "Spring term", units: [{ code: "A7", title: "Algebraic proficiency: visualising" }, { code: "SP7", title: "Understanding risk" }] }] }],
  resources: [
    res({ id: "a", lesson: "A7.10", title: "Real-life graphs" }),
    res({ id: "b", lesson: "A7.03", title: "Gradient (positive)", type: "a3-worksheet", status: "waiting" }),
    res({ id: "c", lesson: "A7.03", title: "Gradient (positive)" }),
    res({ id: "d", type: "unit-booklet", title: "Whole A7" }),
    res({ id: "e", unit: "SP7", lesson: "SP7.02", title: "Multiplication law" }),
  ],
};

describe("Resource library list", () => {
  it("puts the whole unit first, then lessons in number order with the booklet before the A3 sheet", () => {
    const rows = lessonRows(list.resources.filter((r) => r.unit === "A7"));
    expect(rows.map((r) => r.lesson)).toEqual(["", "A7.03", "A7.10"]);
    expect(rows[0].title).toBe("Whole unit");
    expect(rows[1].items.map((r) => r.type)).toEqual(["lesson-booklet", "a3-worksheet"]);
  });
  it("finds resources by code, unit title, type and status, needing every word", () => {
    expect(searchLibrary(list, "a7.03")).toHaveLength(2);
    expect(searchLibrary(list, "risk").map((r) => r.id)).toEqual(["e"]);
    expect(searchLibrary(list, "gradient a3").map((r) => r.id)).toEqual(["b"]);
    expect(searchLibrary(list, "waiting").map((r) => r.id)).toEqual(["b"]);
    expect(searchLibrary(list, "  ")).toEqual([]);
    expect(searchLibrary(list, "gradient pie")).toEqual([]);
  });
  it("keeps its state in the address", () => {
    const state = { year: 9, unit: "A7", view: "shelves" as const, q: "" };
    expect(writeState(state)).toBe("?year=9&unit=A7");
    expect(readState(writeState(state))).toEqual({ ...state, unit: "A7" });
    expect(readState("?year=12&view=map", 8)).toEqual({ year: 8, unit: undefined, view: "map", q: "" });
  });
  it("explains a list it cannot load", async () => {
    await expect(loadLibrary(async () => new Response("", { status: 403 }))).rejects.toThrow(/Sign in again/);
    await expect(loadLibrary(async () => new Response("", { status: 500 }))).rejects.toThrow(/could not be loaded/);
    await expect(loadLibrary(async () => Response.json({ schema: "other" }))).rejects.toThrow(/format/);
    await expect(loadLibrary(async () => Response.json(list))).resolves.toEqual(list);
  });
});
