import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalogueCoverage } from "./coverage";
import { emptyReason, emptyRoute, filterQuestions, readRoute, routeQuery, verifyCatalogue } from "./model";

const bank = verifyCatalogue(JSON.parse(readFileSync("public/bank/catalogue.json", "utf8")));
const programme = JSON.parse(readFileSync("scripts/bank/revision-programme.json", "utf8")) as {papers: Record<string, string>};

describe("Year 11 revision programme papers", () => {
  it("marks exactly the questions from papers in the programme list", () => {
    for (const q of bank.questions) expect(q.revisionUse, q.id).toBe(programme.papers[q.paperId]);
    expect(bank.questions.some(q => q.revisionUse)).toBe(true);
  });

  it("leaves them out of searches by default and brings them back when included", () => {
    const hidden = filterQuestions(bank, emptyRoute);
    expect(hidden.length).toBeGreaterThan(0);
    expect(hidden.some(q => q.revisionUse)).toBe(false);
    const included = filterQuestions(bank, {...emptyRoute, revision: "include"});
    expect(included).toHaveLength(bank.questions.length);
    const coverage = catalogueCoverage(bank, emptyRoute);
    const marked = new Set(bank.questions.filter(q => q.revisionUse).map(q => q.id));
    for (const keys of coverage.codes.values()) for (const key of keys) expect(key.split("|").some(id => marked.has(id))).toBe(false);
  });

  it("keeps the choice in the address only when revision papers are included", () => {
    expect(readRoute("").revision).toBe("hide");
    expect(readRoute("?revision=include").revision).toBe("include");
    expect(readRoute("?revision=yes").revision).toBe("hide");
    expect(routeQuery({...emptyRoute, revision: "include"})).toBe("?revision=include");
    expect(routeQuery(emptyRoute)).toBe("");
  });

  it("opens a link to a marked question with revision papers included", () => {
    const marked = bank.questions.find(q => q.revisionUse)!, plain = bank.questions.find(q => !q.revisionUse)!;
    expect(readRoute(`?question=${marked.id}`, bank).revision).toBe("include");
    expect(readRoute(`?question=${plain.id}`, bank).revision).toBe("hide");
  });

  it("says when only Year 11 revision papers have a topic", () => {
    const only = bank.topics.find(t => { const qs = bank.questions.filter(q => q.codes.includes(t.code)); return qs.length && qs.every(q => q.revisionUse); });
    if (only) expect(emptyReason(bank, {...emptyRoute, code: only.code})).toBe("revision");
    const mixed = bank.topics.find(t => bank.questions.some(q => q.codes.includes(t.code) && !q.revisionUse))!;
    expect(emptyReason(bank, {...emptyRoute, code: mixed.code})).toBeNull();
  });
});
