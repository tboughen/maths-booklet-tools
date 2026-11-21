import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { verifyCatalogue } from "../bank/model";
import { withPerformance } from "../bank/performance";
import { importPupils, paperMappings, parseDelimited, questionLabel } from "./import";
import { ALL_GROUPS, analyseResults, analysisCsv, topicPattern } from "./analysis";
import { sourceRate } from "./select";
import type { Pupil } from "./types";

const bank = withPerformance(verifyCatalogue(JSON.parse(readFileSync("public/bank/catalogue.json", "utf8"))));
const items = paperMappings(bank, "1MA1_NOV_2019_1H");
const pupil = (id: string, group: string, score: (marks: number, i: number) => number): Pupil => ({ identifier: id, key: id, group, profile: {}, scores: Object.fromEntries(items.map((item, i) => [questionLabel(item.label), score(item.marks, i)])) });

describe("class analysis", () => {
  it("compares each class with the national rate and pools gaps by topic", () => {
    const pupils = [pupil("A1", "10X", m => m), pupil("A2", "10X", m => m), pupil("B1", "10Y", () => 0), pupil("B2", "10Y", (m, i) => i < 3 ? m : 0)];
    const result = analyseResults(bank, items, pupils);
    expect(result.groups).toEqual([ALL_GROUPS, "10X", "10Y"]);
    const q1 = result.questions[0], national = sourceRate(items[0], bank)!;
    expect(q1.national).toBeCloseTo(national);
    expect(q1.groups["10X"]).toMatchObject({ pupils: 2, percentage: 100 });
    expect(q1.groups["10X"].gap).toBeCloseTo(100 - national);
    expect(q1.groups[ALL_GROUPS].percentage).toBeCloseTo(75);
    // Full marks everywhere: class 10X is never below national, 10Y nearly always is.
    expect(result.themes["10X"]).toEqual([]);
    expect(result.themes["10Y"].length).toBeGreaterThan(0);
    const low = result.topics.find(t => result.themes["10Y"].includes(t.code))!;
    expect(topicPattern(low, result.groups)).toBe("some classes");
  });
  it("keeps pupil identifiers out of the downloadable analysis", () => {
    const csv = analysisCsv(analyseResults(bank, items, [pupil("Secret Name", "10X", () => 1)]));
    expect(csv).not.toContain("Secret Name");
    expect(csv.split("\n")[0]).toContain("National %");
  });
  it("reads a Class column from the marks sheet", () => {
    const head = ["Student", "Class", ...items.slice(0, 2).map(i => i.label)].join("\t");
    const rows = parseDelimited(`${head}\nP1\t10X\t1\t1\nP2\t10Y\t0\t0`);
    const imported = importPupils(rows, items.slice(0, 2));
    expect(imported.rows.map(r => r.group)).toEqual(["10X", "10Y"]);
    expect(imported.detection.ignoredColumns).toBe(0);
  });
});
