import { describe, expect, it } from "vitest";
import { parseSkillSets, type SkillSet } from "./model";
import { defaultPlan, fitSheet, isAbsent, pick, sheetResource, skillLabels, startLevel } from "./compose";

// An invented two-part assessment with three small skills (the real banks live in the private question bank).
const card = (title: string) => ({ title, items: [{ type: "text", text: `Work out ${title}.` }, { type: "answerLine", prefix: "", suffix: "", answer: "1", inline: false }] });
const cards = (code: string) => (["1", "1", "2", "2", "3", "3", "4", "P", "S", "S"] as const).map((l, i) => ({ level: (/\d/.test(l) ? Number(l) : l) as 1, card: card(`${code} ${l}.${i}`) }));
const file = {
  schema: "mathsdock-skill-sheets", version: 1,
  sets: [{
    id: "demo", name: "Demo test", year: 8, title: "Demo test follow-up",
    parts: [{ label: "Q1", max: 1, codes: ["U1"] }, { label: "Q2a", max: 2, codes: ["U2"] }, { label: "Q2b", max: 1, codes: ["U2"] }, { label: "Q3", max: 3, codes: ["U3"] }],
    instructions: ["Side one.", "Side two."],
    skills: [
      { code: "A", title: "Adding", pupilCodes: "M1", sparx: ["U1"], paper: ["Q1"], start: [{ level: 1, all: [["Q1", 1]] }], cards: cards("A") },
      { code: "B", title: "Bonds", pupilCodes: "M2", sparx: ["U2"], paper: ["Q2a", "Q2b"], start: [{ level: 1, all: [["Q2a", 1], ["Q2b", 1]] }, { level: 2, any: [["Q2a", 2], ["Q2b", 1]] }, { level: 4, all: [["Q2a", 3]] }], cards: cards("B") },
      { code: "C", title: "Counting", pupilCodes: "M3", sparx: ["U3"], paper: ["Q3"], start: [{ level: 1, all: [["Q3", 1]] }, { level: 3, all: [["Q3", 3]] }], cards: cards("C") },
      { code: "D", title: "Dividing", pupilCodes: "M4", sparx: ["U3"], paper: ["Q3"], start: [], cards: cards("D") },
    ],
  }],
};
const set = (): SkillSet => parseSkillSets(structuredClone(file))[0];

describe("skill sheets", () => {
  it("reads a bank and refuses a broken one with a specific message", () => {
    expect(set().skills).toHaveLength(4);
    const bad = structuredClone(file); bad.sets[0].skills[0].paper = ["Q9"];
    expect(() => parseSkillSets(bad)).toThrow(/Adding names Q9/);
    expect(() => parseSkillSets({ schema: "other" })).toThrow(/unknown file type/);
  });
  it("starts each skill at the first rule that passes, and missing marks count as none", () => {
    const [, b, c] = set().skills;
    expect(startLevel(b, { Q2a: 0, Q2b: 0 })).toBe(1);
    expect(startLevel(b, { Q2a: 1, Q2b: 1 })).toBe(2);
    expect(startLevel(b, { Q2a: 2, Q2b: 1 })).toBe(4);
    expect(startLevel(c, { Q3: 3 })).toBe("S");
    expect(startLevel(c, { Q3: null })).toBe(1);
  });
  it("chooses the three skills with most marks lost, leaves out excluded skills and treats blank rows as absent", () => {
    const s = set(), scores = { Q1: 1, Q2a: 0, Q2b: 0, Q3: 2 };
    expect(defaultPlan(s, scores)).toEqual([{ code: "B", level: 1 }, { code: "C", level: 3 }, { code: "D", level: "S" }]);
    expect(defaultPlan(s, scores, ["B"]).map((p) => p.code)).toEqual(["C", "D", "A"]);
    // A skill with no recorded mark is not chosen: there is no evidence either way.
    expect(defaultPlan(s, { Q1: 0, Q2a: null, Q2b: null, Q3: 3 }).map((p) => p.code)).toEqual(["A", "C", "D"]);
    expect(isAbsent(s, { Q1: null, Q2a: null, Q2b: null, Q3: null })).toBe(true);
    expect(isAbsent(s, { Q1: 0, Q2a: null, Q2b: null, Q3: null })).toBe(false);
  });
  it("uses the two-level window", () => {
    const b = set().skills[1], t = (x: { card: Record<string, unknown> }[]) => x.map((c) => c.card.title);
    expect(pick(b, 1, 6, 6).map(t)).toEqual([["B 1.0", "B 1.1"], ["B 2.2", "B 2.3", "B 3.4", "B 3.5", "B 4.6", "B P.7"]]);
    expect(pick(b, 3, 6, 1).map(t)).toEqual([["B 3.4", "B 3.5"], ["B 4.6"]]);
    expect(pick(b, 4, 6, 6).map(t)).toEqual([["B 4.6"], ["B P.7", "B S.8", "B S.9"]]);
    expect(pick(b, "S", 6, 6).map(t)).toEqual([["B S.8"], ["B S.9"]]);
  });
  it("builds a valid two-sided A3 sheet that fits, headed with the student label", () => {
    const s = set(), plan = defaultPlan(s, { Q1: 0, Q2a: 0, Q2b: 0, Q3: 0 });
    const { resource, problems } = fitSheet(s, "Student 07", plan);
    expect(problems).toEqual([]);
    expect(resource.document.title).toBe("Student 07");
    expect(resource.document.code).toBe("Student-07");
    expect(resource.document.sides[0].columns.map((c) => c.heading)).toEqual(["Adding: Level 1", "Bonds: Level 1", "Counting: Level 1"]);
    expect(resource.document.sides[1].columns.map((c) => c.heading)).toEqual(["Adding: Level 2", "Bonds: Level 2", "Counting: Level 2"]);
    expect(resource.document.objective).toBe("Demo test follow-up. Your Sparx codes: Adding M1; Bonds M2; Counting M3");
    // Budgets cap each column, so a smaller budget gives fewer cards.
    expect(sheetResource(s, "x", plan, [[1, 1, 1], [1, 1, 1]]).document.sides[1].columns[0].cards).toHaveLength(1);
  });
  it("labels students from the row order only when the marks had no identifiers", () => {
    const pupils = [{ key: "a", identifier: "S001", scores: {}, profile: {} }, { key: "b", identifier: "S002", scores: {}, profile: {} }];
    expect(skillLabels(set(), pupils, true).map((p) => p.label)).toEqual(["Student 01", "Student 02"]);
    expect(skillLabels(set(), pupils, false).map((p) => p.label)).toEqual(["S001", "S002"]);
  });
  it("reads marks whose part labels the import wrote in capitals", () => {
    const pupils = [{ key: "a", identifier: "S001", scores: { Q1: 1, Q2A: 2, Q2B: null }, profile: {} }];
    expect(skillLabels(set(), pupils, true)[0].scores).toEqual({ Q1: 1, Q2a: 2, Q2b: null, Q3: null });
  });
});
