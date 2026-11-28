import { describe, expect, it } from "vitest";
import { adaptName, kindOf, versionName } from "./adapt";
import { adaptationPlan, type Library, type Resource } from "./model";

const res = (over: Partial<Resource>): Resource => ({ id: "r", year: 9, unit: "A7", version: "Main", title: "Gradient", type: "lesson-booklet", status: "ready", updated: "2026-11-22", files: [], history: [], ...over });
const list: Library = {
  schema: "mathsdock-library-served/2", published: "2026-11-28T05:00:00Z",
  years: [{ year: 9, sections: [{ name: "Autumn term", units: [{ code: "A7", title: "Straight lines", lessons: ["A7.01", "A7.02", "A7.03"].map((code) => ({ code, title: code })) }] }] }],
  resources: [res({ id: "a", lesson: "A7.01" }), res({ id: "b", lesson: "A7.02", status: "waiting" }), res({ id: "c", lesson: "A7.02", version: "Easier (9X)", status: "waiting", adaptation: { kind: "easier" } })],
};

describe("adaptations", () => {
  it("are named by kind and class, always as a name the library accepts", () => {
    expect(adaptName("easier", "9X")).toBe("Easier (9X)");
    expect(adaptName("harder", "")).toBe("Harder");
    expect(adaptName("different", " 10y2 ", "Bar models · first!")).toBe("Bar models first (10y2)");
    expect(adaptName("different", "", "  ")).toBe("Different approach");
    for (const n of [adaptName("easier", "<!-- 9X -->"), adaptName("different", "x".repeat(40), "y".repeat(40))]) expect(versionName.test(n)).toBe(true);
    expect([kindOf("Easier (9X)"), kindOf("Harder"), kindOf("Foundation"), kindOf("Foundation", "easier")]).toEqual(["easier", "harder", "different", "easier"]);
  });
  it("show Main, greyed, for the lessons an adaptation leaves as they are", () => {
    const rows = adaptationPlan(list, 9, "A7", "Easier (9X)");
    expect(rows.map((r) => [r.code, r.resource?.id ?? null, r.main?.id ?? null, r.state])).toEqual([["A7.01", null, "a", "none"], ["A7.02", "c", null, "waiting"], ["A7.03", null, null, "none"]]);
    expect(adaptationPlan(list, 9, "A7", "Main").some((r) => r.main)).toBe(false);
  });
});
