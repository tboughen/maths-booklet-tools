import { beforeEach, describe, expect, it } from "vitest";
import { forgetWork, noteWork, resetRecentWorkForTests, whenText, workRecorder } from "./recentWork";

const stored = () => JSON.parse(localStorage.getItem("mathsdock.recentWork") ?? "[]") as { id: string; at: number; detail?: string }[];

beforeEach(() => {
  localStorage.clear();
  resetRecentWorkForTests();
  history.replaceState(null, "", "/");
});

describe("recent work, for Home's Carry on row", () => {
  it("keeps the newest first, one entry for each place, and at most six", () => {
    noteWork("venn", undefined, 1000);
    noteWork("graph", undefined, 2000);
    noteWork("venn", undefined, 3000);
    expect(stored()).toEqual([{ id: "venn", at: 3000 }, { id: "graph", at: 2000 }]);
    for (const [i, id] of (["charts", "angles", "area", "cuboids", "triangle"] as const).entries()) noteWork(id, undefined, 4000 + i);
    expect(stored().map((item) => item.id)).toEqual(["triangle", "cuboids", "area", "angles", "charts", "venn"]);
  });

  it("keeps a short line about the work and forgets a place whose work has gone", () => {
    noteWork("paper-builder", "3 Sparx codes", 1000);
    noteWork("worksheets", undefined, 2000);
    expect(stored()).toEqual([{ id: "worksheets", at: 2000 }, { id: "paper-builder", at: 1000, detail: "3 Sparx codes" }]);
    forgetWork("paper-builder");
    expect(stored()).toEqual([{ id: "worksheets", at: 2000 }]);
  });

  it("records a page's document steps against that page, wherever the address points", () => {
    history.replaceState(null, "", "/tools/venn");
    workRecorder("worksheets")("changed");
    expect(stored().map((item) => item.id)).toEqual(["worksheets"]);
    workRecorder("venn")("changed");
    expect(stored().map((item) => item.id)).toEqual(["venn", "worksheets"]);
    expect(workRecorder("venn")).toBe(workRecorder("venn"));
  });

  it("puts back what the list said once every step has been undone", () => {
    noteWork("graph", undefined, 1000);
    noteWork("venn", undefined, 2000);
    // Graph had saved work from an earlier day; ratio tables had none.
    workRecorder("graph")("changed");
    workRecorder("ratio-table")("changed");
    expect(stored().map((item) => item.id)).toEqual(["ratio-table", "graph", "venn"]);
    workRecorder("ratio-table")("undone");
    workRecorder("graph")("undone");
    expect(stored()).toEqual([{ id: "venn", at: 2000 }, { id: "graph", at: 1000 }]);
    // A later change is recorded again, and undoing it returns to the same earlier record.
    workRecorder("graph")("changed");
    workRecorder("graph")("undone");
    expect(stored()).toEqual([{ id: "venn", at: 2000 }, { id: "graph", at: 1000 }]);
    // Undone with nothing recorded changes nothing.
    workRecorder("area")("undone");
    expect(stored()).toEqual([{ id: "venn", at: 2000 }, { id: "graph", at: 1000 }]);
  });

  it("ignores stored values that are not a list of known places", () => {
    localStorage.setItem("mathsdock.recentWork", JSON.stringify([{ id: "nowhere", at: 5 }, { id: "venn", at: "soon" }, { id: "graph", at: 7 }, { id: "graph", at: 6 }, null]));
    noteWork("venn", undefined, 9);
    expect(stored()).toEqual([{ id: "venn", at: 9 }, { id: "graph", at: 7 }]);
    localStorage.setItem("mathsdock.recentWork", "{broken");
    resetRecentWorkForTests();
    noteWork("area", undefined, 10);
    expect(stored()).toEqual([{ id: "area", at: 10 }]);
  });
});

describe("whenText", () => {
  const now = new Date(2026, 10, 16, 14, 30).getTime();
  it("says today, yesterday, the weekday, then the date", () => {
    expect(whenText(new Date(2026, 10, 16, 9, 5).getTime(), now)).toBe("today at 09:05");
    expect(whenText(new Date(2026, 10, 15, 23, 59).getTime(), now)).toBe("yesterday at 23:59");
    expect(whenText(new Date(2026, 10, 12, 8, 0).getTime(), now)).toBe("on Thursday");
    expect(whenText(new Date(2026, 10, 3, 8, 0).getTime(), now)).toBe("on 3 November");
    expect(whenText(new Date(2025, 11, 20, 8, 0).getTime(), now)).toBe("on 20 December 2025");
  });
});
