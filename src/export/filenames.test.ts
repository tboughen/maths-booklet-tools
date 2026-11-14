import { describe, expect, it } from "vitest";
import { contentHint, downloadName, fileDate } from "./filenames";

const day = new Date(2026, 10, 14, 9, 30);
describe("download names (U33)", () => {
  it("names the tool, the content and the date", () => {
    expect(downloadName("triangle", "png", { resource: { document: { sourceId: "1MA1_JUN_2018_1H_Q4" } }, date: day })).toBe(
      "mathsdock-triangle-1ma1-jun-2018-1h-q4-2026-11-14.png",
    );
    expect(downloadName("venn", "json", { resource: { document: {} }, date: day })).toBe("mathsdock-venn-2026-11-14.json");
    expect(downloadName("ratio-table", "svg", { answers: true, date: day })).toBe("mathsdock-ratio-table-answers-2026-11-14.svg");
    expect(downloadName("cuboids", "json", { recovery: true, date: day })).toBe("mathsdock-cuboids-recovery-2026-11-14.json");
  });
  it("prefers a title, keeps names short and safe", () => {
    expect(contentHint({ document: { title: "Y9 Pythagoras — Q3!", sourceId: "X" } })).toBe("y9-pythagoras-q3");
    expect(contentHint({ document: { title: "   ", sourceId: null } })).toBe("");
    expect(contentHint(null)).toBe("");
    expect(downloadName("graph", "png", { content: "a".repeat(80), date: day })).toBe(`mathsdock-graph-${"a".repeat(40)}-2026-11-14.png`);
    expect(fileDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
