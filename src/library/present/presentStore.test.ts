import { beforeEach, describe, expect, it } from "vitest";
import { className, lastBuildFor, loadClass, recentClasses, rememberClass, saveClass } from "./presentStore";

const stroke = (x: number) => ({ id: `s${x}`, kind: "pen" as const, colour: "#111", size: 3.5, scale: 1, points: [[x + 0.123, 10.987], [x + 5, 12]] as [number, number][] });

describe("Present class store", () => {
  beforeEach(() => localStorage.clear());
  it("tidies class names", () => {
    expect(className(" 9 x ")).toBe("9X");
    expect(className("   ")).toBe("");
  });
  it("keeps recent classes newest first, without repeats", () => {
    rememberClass("9X", "2026-11-27T09:00:00Z");
    rememberClass("8T", "2026-11-28T09:00:00Z");
    rememberClass("9X", "2026-11-28T10:00:00Z");
    expect(recentClasses().map((c) => c.name)).toEqual(["9X", "8T"]);
  });
  it("saves ink and place per class and per build, rounding points and dropping empty sides", () => {
    expect(saveClass("9X", "a4@2026-11-25", { "1": [stroke(1)], "2": [] }, { side: 5, at: "2026-11-28T10:00:00Z", flag: true }, "2026-11-28T10:00:00Z")).toBe(true);
    const saved = loadClass("9X", "a4@2026-11-25")!;
    expect(Object.keys(saved.sides)).toEqual(["1"]);
    expect(saved.sides["1"][0].points[0]).toEqual([1.1, 11]);
    expect(saved.stopped).toEqual({ side: 5, at: "2026-11-28T10:00:00Z", flag: true });
    expect(loadClass("9Y", "a4@2026-11-25")).toBeUndefined();
    expect(loadClass("9X", "a4@2026-11-20")).toBeUndefined();
  });
  it("finds the build a class last used", () => {
    saveClass("9X", "old", {}, undefined, "2026-11-20T10:00:00Z");
    saveClass("9X", "new", {}, undefined, "2026-11-26T10:00:00Z");
    expect(lastBuildFor("9X", ["new", "old", "none"])).toBe("new");
    expect(lastBuildFor("8T", ["new"])).toBeUndefined();
  });
});
