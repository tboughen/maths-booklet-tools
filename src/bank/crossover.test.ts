import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { emptyRoute, exportSelection, filterQuestions, verifyCatalogue, type BankCatalogue, type BankQuestion } from "./model";

const catalogue = verifyCatalogue(JSON.parse(readFileSync("public/bank/catalogue.json", "utf8")) as BankCatalogue);
const identity = (q: BankQuestion) => q.equivalentId ? [q.id, q.equivalentId].sort().join("|") : q.id;
const shared = catalogue.questions.filter(q => q.tier === "F" && q.equivalentId);

describe("reviewed Foundation/Higher crossover catalogue", () => {
  it("retains all paper appearances with 300 reciprocal reviewed pairs across all 42 components", () => {
    expect(catalogue.questions).toHaveLength(2080);
    expect(new Set(catalogue.questions.map(q => q.paperId)).size).toBe(84);
    expect(shared).toHaveLength(300);
    expect(new Set(shared.map(q => q.paperId)).size).toBe(42);
    expect(filterQuestions(catalogue, emptyRoute)).toHaveLength(2080);
  });

  it("shows every mapped identity exactly once for every Sparx code and every individual filter", () => {
    for (const topic of catalogue.topics) {
      const mapped = catalogue.questions.filter(q => q.codes.includes(topic.code));
      const identities = new Set(mapped.map(identity));
      const all = filterQuestions(catalogue, {...emptyRoute, code: topic.code});
      expect(new Set(all.map(identity)), topic.code).toEqual(identities);
      expect(all.length, topic.code).toBe(identities.size);
      expect(topic.availableCount, topic.code).toBe(all.length);
      for (const filters of [{tier: "F" as const}, {tier: "H" as const}, {calculator: "yes" as const}, {calculator: "no" as const}, {collection: "mock" as const}, {collection: "past" as const}]) {
        const found = filterQuestions(catalogue, {...emptyRoute, code: topic.code, ...filters});
        expect(new Set(found.map(identity)).size).toBe(found.length);
        expect(found.every(q => q.codes.includes(topic.code))).toBe(true);
        if (filters.tier) expect(found.every(q => q.tier === filters.tier)).toBe(true);
        if (filters.collection) expect(found.every(q => /^mock/i.test(q.collection) === (filters.collection === "mock"))).toBe(true);
      }
    }
  });

  it("honours both existing direct links for every shared mapped question", () => {
    for (const foundation of shared) {
      const higher = catalogue.questions.find(q => q.id === foundation.equivalentId)!;
      for (const q of [foundation, higher]) {
        const found = filterQuestions(catalogue, {...emptyRoute, code: q.codes[0], question: q.id});
        expect(found.some(item => item.id === q.id), q.id).toBe(true);
        expect(found.filter(item => identity(item) === identity(q))).toHaveLength(1);
      }
    }
  });

  it("exports each pair once in either selection order and keeps a single total for a whole-bank selection", () => {
    for (const q of shared) {
      for (const ids of [[q.id, q.equivalentId!], [q.equivalentId!, q.id]]) {
        const selection = exportSelection(catalogue, ids);
        expect(selection.questions.map(item => item.id)).toEqual([ids[0]]);
        expect(selection.marks).toBe(q.marks);
      }
    }
    const all = exportSelection(catalogue, catalogue.questions.map(q => q.id));
    expect(all.questions).toHaveLength(1780);
    expect(all.marks).toBe(catalogue.questions.reduce((sum, q) => sum + q.marks, 0) - shared.reduce((sum, q) => sum + q.marks, 0));
  });
});
