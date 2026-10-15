import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { BankCatalogue, BankQuestion } from "../bank/model";
import { accessibility, generateClass, prioritiesFor } from "./select";
import { defaults, type AssessmentItem, type Pupil } from "./types";

const bank: BankCatalogue = JSON.parse(readFileSync("public/bank/catalogue.json", "utf8"));
const pupil = (scores: Pupil["scores"]): Pupil => ({ key: "synthetic", identifier: "S001", profile: {}, scores });
const item = (label: string, code: string, marks = 2): AssessmentItem => ({ label, codes: [code], marks });
function question(id: string, code: string, number = 1): BankQuestion {
  const base = bank.questions.find(q => q.tier === "H")!;
  return { ...base, id, equivalentId: undefined, number, order: number, marks: 2, codes: [code], review: "reviewed", scaleSensitive: false, writingSpacePolicy: "generated",
    parts: [{ ...base.parts[0], label: "whole", marks: 2, codes: [code] }],
    questionViews: [{ ...base.questionViews[0], width: 500, height: 70 }], schemeViews: [{ ...base.schemeViews[0], width: 500, height: 60 }],
    performance: { kind: "estimated", percentage: 85 } };
}
const catalogue = (...questions: BankQuestion[]): BankCatalogue => ({ ...bank, questions });

describe("assessment priority and difficulty corrections", () => {
  it("pools repeated parts into the same evidence as one whole-question score", () => {
    const end = item("Q21", "U751");
    const parts = [item("Q17a", "U168", 2), item("Q17b", "U168", 1), item("Q17c", "U168", 3), end];
    const whole = [item("Q17", "U168", 6), end];
    const a = prioritiesFor(parts, pupil({ Q17A: 1, Q17B: 1, Q17C: 0, Q21: 2 }))[0];
    const b = prioritiesFor(whole, pupil({ Q17: 2, Q21: 2 }))[0];
    expect(a.weight).toBeCloseTo(b.weight); expect(a.achieved).toBeCloseTo(2 / 6);
    expect(a.references).toEqual(["Q17a", "Q17c"]);
    const missing = prioritiesFor(parts, pupil({ Q17A: 2, Q17B: null, Q17C: null, Q21: 2 }));
    expect(missing).toEqual([]);
  });
  it("prioritises early gaps before selecting topics and ignores spreadsheet ordering", () => {
    const items = [item("Q17a", "U168", 2), item("Q17b", "U168", 1), item("Q17c", "U168", 3), item("Q2", "U278", 4), item("Q1a", "U179"), item("Q3", "U332"), item("Q21", "U699", 4)];
    const scores = pupil({ Q17A: 0, Q17B: 0, Q17C: 0, Q2: 0, Q1A: 0, Q3: 0, Q21: 0 });
    const priorities = prioritiesFor(items, scores);
    expect(priorities.slice(0, 3).map(p => p.code).sort()).toEqual(["U179", "U278", "U332"]);
    expect(prioritiesFor([...items].reverse(), scores)).toEqual(priorities);
  });
  it("uses original paper counts for a partial assessment instead of treating its final question as the exam end", () => {
    const source = bank.questions.find(q => q.tier === "H" && q.number === 5)!;
    const items = [{ ...item("Q5", "U753"), questionId: source.id }];
    expect(prioritiesFor(items, pupil({ Q5: 0 }), bank)[0].weight).toBeGreaterThan(prioritiesFor(items, pupil({ Q5: 0 }))[0].weight);
  });
  it("uses developing/strong bands, year and achieved marks for estimated questions", () => {
    const q = { ...question("estimated", "U753", 10), performance: { kind: "estimated" as const, percentage: 30 } };
    const developing = { year: 10, tier: "H" as const, strength: "developing" as const }, strong = { ...developing, strength: "strong" as const };
    expect(accessibility(q, bank, strong, 0)).toBeGreaterThan(accessibility(q, bank, developing, 0));
    expect(accessibility(q, bank, developing, 1)).toBeGreaterThan(accessibility(q, bank, developing, 0));
    expect(accessibility(q, bank, { ...developing, year: 11 }, 0)).toBeGreaterThan(accessibility(q, bank, developing, 0));
    expect(accessibility(q, bank, developing, 0)).toBeGreaterThan(0);
  });
});

describe("class pack topic coverage and exclusions", () => {
  it("covers other priority skills before selecting a second question on one skill", () => {
    const items = [item("Q1", "U753"), item("Q2", "U751"), item("Q3", "U179")];
    const cat = catalogue(question("A1", "U753"), question("A2", "U753"), question("B", "U751"), question("C", "U179"));
    const pack = generateClass(cat, items, [pupil({ Q1: 0, Q2: 0, Q3: 0 })], { ...defaults, pageLimit: null, marksLimit: 6 }).packs[0];
    expect(new Set(pack.entries.flatMap(e => e.codes)).size).toBe(3);
  });
  it("moves to the next gap when earlier priorities have no fitting practice", () => {
    const items = [item("Q1", "U753"), item("Q2", "U751"), item("Q3", "U179"), item("Q4", "U168")];
    const pack = generateClass(catalogue(question("only", "U168")), items, [pupil({ Q1: 0, Q2: 0, Q3: 0, Q4: 0 })], defaults).packs[0];
    expect(pack.entries.map(e => e.question.id)).toEqual(["only"]);
  });
  it("does not replace a fully correct assessment with an assumed all-zero fallback", () => {
    const items = [item("Q1", "U753")];
    const pack = generateClass(catalogue(question("A", "U753")), items, [pupil({ Q1: 2 })], defaults).packs[0];
    expect(pack.entries).toEqual([]); expect(pack.fallback).toBe(false);
  });
  it("excludes untaught topics in individual, absent, common and all-absent packs", () => {
    const items = [item("Q1", "U753"), item("Q17a", "U168"), item("Q17b", "U168")];
    const cat = catalogue(question("algebra", "U753"), question("iteration", "U168"));
    const scored = pupil({ Q1: 0, Q17A: 0, Q17B: 0 }), absent = { ...pupil({ Q1: null, Q17A: null, Q17B: null }), key: "absent", identifier: "S002" };
    for (const common of [false, true]) for (const pupils of [[scored, absent], [absent]]) {
      const plan = generateClass(cat, items, pupils, { ...defaults, common, excludedQuestions: ["Q17"] });
      expect(plan.packs.every(p => p.entries.length === 1 && p.entries[0].codes[0] === "U753")).toBe(true);
      expect(plan.packs.flatMap(p => p.entries).every(e => !e.references.some(r => r.startsWith("Q17")))).toBe(true);
    }
    expect(generateClass(cat, items, [scored], { ...defaults, excludedQuestions: ["Q1", "Q17"] }).packs[0].entries).toEqual([]);
  });
  it("rejects a whole practice question containing an excluded topic alongside an allowed one", () => {
    const mixed = question("mixed", "U753"); mixed.codes.push("U168");
    const items = [item("Q1", "U753"), item("Q17", "U168")];
    const plan = generateClass(catalogue(mixed), items, [pupil({ Q1: 0, Q17: 0 })], { ...defaults, excludedQuestions: ["Q17"] });
    expect(plan.packs[0].entries).toEqual([]);
  });
  it("supplements partial records only from unrecorded topics, preserving demonstrated success", () => {
    const items = [item("Q1", "U753"), item("Q2", "U751")];
    const cat = catalogue(question("A", "U753"), question("B", "U751"));
    const partial = pupil({ Q1: null, Q2: 2 }), other = { ...pupil({ Q1: 0, Q2: 0 }), key: "other", identifier: "S002" };
    const plan = generateClass(cat, items, [partial, other], defaults);
    expect(plan.packs[0].entries.map(e => e.codes)).toEqual([["U753"]]);
  });
});
