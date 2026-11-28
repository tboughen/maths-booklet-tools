import { beforeEach, describe, expect, it } from "vitest";
import { classRecord, className, lastBuildFor, loadClass, loadClassSite, newerRecord, recentClasses, rememberClass, saveClass, saveClassSite } from "./presentStore";

const stroke = (x: number) => ({ id: `s${x}`, kind: "pen" as const, colour: "#111", size: 3.5, scale: 1, points: [[x + 0.123, 10.987], [x + 5, 12]] as [number, number][] });

describe("Present class store", () => {
  beforeEach(() => localStorage.clear());
  it("tidies class names", () => {
    expect(className(" 9 x ")).toBe("9X");
    expect(className("   ")).toBe("");
    expect(className("10x-Ma/1")).toBe("10XMA1");
  });
  it("keeps recent classes newest first, without repeats", () => {
    rememberClass("9X", "2026-11-27T09:00:00Z");
    rememberClass("8T", "2026-11-28T09:00:00Z");
    rememberClass("9X", "2026-11-28T10:00:00Z");
    expect(recentClasses().map((c) => c.name)).toEqual(["9X", "8T"]);
  });
  it("saves ink and place per class and per build, rounding points and dropping empty sides", () => {
    expect(saveClass("9X", "a4@2026-11-25", classRecord({ "1": [stroke(1)], "2": [] }, { side: 5, at: "2026-11-28T10:00:00Z", flag: true }, "2026-11-28T10:00:00Z"))).toBe(true);
    const saved = loadClass("9X", "a4@2026-11-25")!;
    expect(Object.keys(saved.sides)).toEqual(["1"]);
    expect(saved.sides["1"][0].points[0]).toEqual([1.1, 11]);
    expect(saved.stopped).toEqual({ side: 5, at: "2026-11-28T10:00:00Z", flag: true });
    expect(loadClass("9Y", "a4@2026-11-25")).toBeUndefined();
    expect(loadClass("9X", "a4@2026-11-20")).toBeUndefined();
  });
  it("finds the build a class last used", () => {
    saveClass("9X", "old", classRecord({}, undefined, "2026-11-20T10:00:00Z"));
    saveClass("9X", "new", classRecord({}, undefined, "2026-11-26T10:00:00Z"));
    expect(lastBuildFor("9X", ["new", "old", "none"])).toBe("new");
    expect(lastBuildFor("8T", ["new"])).toBeUndefined();
    expect(lastBuildFor("9X", ["new", "old"], [{ build: "old", updated: "2026-11-27T10:00:00Z" }])).toBe("old");
  });
  it("keeps the newer of this browser's copy and the site's", () => {
    const a = classRecord({}, undefined, "2026-11-27T10:00:00Z"), b = classRecord({}, undefined, "2026-11-28T10:00:00Z");
    expect(newerRecord(a, b)).toBe(b);
    expect(newerRecord(b, a)).toBe(b);
    expect(newerRecord(undefined, a)).toBe(a);
  });
  it("reads and writes the site copy, and carries on when the site cannot save", async () => {
    const record = classRecord({ "2": [stroke(2)] }, undefined, "2026-11-28T10:00:00Z");
    const calls: [string, RequestInit | undefined][] = [];
    const site = (async (url: string, init?: RequestInit) => { calls.push([url, init]); return new Response(JSON.stringify(init?.method === "PUT" ? { ok: true } : { record }), { headers: { "Content-Type": "application/json" } }); }) as typeof fetch;
    expect(await loadClassSite("9X", "a4@2026-11-25", site)).toEqual(record);
    expect(calls[0][0]).toContain("api/present/ink?class=9X&build=a4%402026-11-25");
    expect(await saveClassSite("9X", "a4@2026-11-25", record, { fetcher: site })).toBe(true);
    expect(JSON.parse(String(calls[1][1]?.body))).toEqual({ class: "9X", build: "a4@2026-11-25", record });
    const page = (async () => new Response("<!doctype html>", { headers: { "Content-Type": "text/html" } })) as typeof fetch;
    expect(await loadClassSite("9X", "a4@2026-11-25", page)).toBeUndefined();
    expect(await saveClassSite("9X", "a4@2026-11-25", record, { fetcher: page })).toBe(false);
    const offline = (async () => { throw new TypeError("offline"); }) as typeof fetch;
    expect(await loadClassSite("9X", "a4@2026-11-25", offline)).toBeUndefined();
  });
});
