import { describe, expect, it } from "vitest";
import { readState, writeState, type Library, type LibraryFile, type Resource } from "../model";
import { buildLabel, canPresent, findBuild, fitScale, stepZoom } from "./presentModel";

const file = (role: LibraryFile["role"], format: LibraryFile["format"] = "pdf", tag = "a"): LibraryFile => ({ role, format, name: `x_${role}.${format}`, bytes: 1, href: `library-data/files/${tag.repeat(64)}/x_${role}.${format}` });
const res = (over: Partial<Resource>): Resource => ({ id: "r", year: 9, unit: "A7", version: "Main", title: "Gradient", type: "lesson-booklet", status: "ready", updated: "2026-11-25", files: [file("pupil"), file("answers"), file("pupil", "docx")], history: [], ...over });
const list = (resources: Resource[]): Library => ({ schema: "mathsdock-library-served/2", published: "2026-11-25T12:00:00Z", years: [{ year: 9, sections: [] }], resources });

describe("Present builds", () => {
  const main = res({ id: "a4", lesson: "A7.04", history: [{ updated: "2026-11-20", files: [file("pupil", "pdf", "b")] }] });
  const foundation = res({ id: "a4f", lesson: "A7.04", version: "Foundation", updated: "2026-11-26" });
  const other = res({ id: "a5", lesson: "A7.05" });
  const docxOnly = res({ id: "sp", unit: "SP7", lesson: "SP7.01", files: [file("pupil", "docx")] });
  const l = list([foundation, main, other, docxOnly]);

  it("lists the same lesson in every version, Main first, with earlier builds after each", () => {
    const { builds, build } = findBuild(l, "a4");
    expect(builds.map((b) => b.key.replace(/\.[0-9a-z]+$/, ""))).toEqual(["a4@2026-11-25", "a4@2026-11-20", "a4f@2026-11-26"]);
    expect(build?.key).toBe(`a4@${build?.at}`);
    expect(build?.at).toMatch(/^2026-11-25\.[0-9a-z]+$/);
    expect(build?.answers?.role).toBe("answers");
    expect(buildLabel(builds[1])).toBe("Main · 20 Nov 2026 (earlier)");
    expect(builds[1].answers).toBeUndefined();
  });
  it("opens an earlier build by its date, and falls back to the current one", () => {
    expect(findBuild(l, "a4", "2026-11-20").build?.current).toBe(false);
    expect(findBuild(l, "a4", "1999-01-01").build?.current).toBe(true);
    expect(findBuild(l, "gone").build).toBeUndefined();
  });
  it("keeps two builds published on the same day apart", () => {
    const twice = res({ id: "t", lesson: "A7.09", history: [{ updated: "2026-11-25", files: [file("pupil", "pdf", "c")] }] });
    const { builds } = findBuild(list([twice]), "t");
    expect(new Set(builds.map((b) => b.key)).size).toBe(2);
    expect(findBuild(list([twice]), "t", builds[1].at).build?.current).toBe(false);
    expect(findBuild(list([twice]), "t", "2026-11-25").build?.current).toBe(false);
    expect(findBuild(list([twice]), "t").build?.current).toBe(true);
  });
  it("only offers Present for a booklet with a pupil PDF", () => {
    expect(canPresent(main.files)).toBe(true);
    expect(canPresent(docxOnly.files)).toBe(false);
    expect(findBuild(l, "sp").build).toBeUndefined();
  });
  it("keeps unit booklet parts apart", () => {
    const p1 = res({ id: "u1", type: "unit-booklet", part: "Part 1" }), p2 = res({ id: "u2", type: "unit-booklet", part: "Part 2" }), p2f = res({ id: "u2f", type: "unit-booklet", part: "Part 2", version: "Foundation" });
    expect(findBuild(list([p1, p2, p2f]), "u2").builds.map((b) => b.resource.id)).toEqual(["u2", "u2f"]);
  });
});

describe("Present address and zoom", () => {
  it("round-trips the booklet and build in the library address", () => {
    const state = readState("?year=9&unit=A7&present=a4&at=2026-11-20");
    expect(state).toMatchObject({ present: "a4", at: "2026-11-20" });
    expect(writeState(state)).toBe("?year=9&unit=A7&present=a4&at=2026-11-20");
    expect(readState("?year=9&at=2026-11-20").at).toBeUndefined();
  });
  it("fits a side to the width or the whole side to the stage", () => {
    const a4 = { width: 595, height: 842 }, stage = { width: 1291, height: 900 };
    expect(fitScale("width", a4, stage)).toBeCloseTo((1291 - 96) / 595);
    expect(fitScale("side", a4, stage)).toBeCloseTo((900 - 48) / 842);
    expect(fitScale("width", a4, { width: 4000, height: 900 })).toBe(3);
  });
  it("steps zoom through fixed levels and stops at the ends", () => {
    expect(stepZoom(1, 1)).toBe(1.25);
    expect(stepZoom(1.1, -1)).toBe(1);
    expect(stepZoom(4, 1)).toBe(4);
    expect(stepZoom(0.5, -1)).toBe(0.5);
  });
});
