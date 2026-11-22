import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { draftEntries, draftReducer, emptyDraft } from "./paper-builder";
import { catalogueCoverage } from "./coverage";
import { bankPapers, emptyReason, emptyRoute, filterQuestions, matchPapers, paperName, paperQuestions, readRoute, routeQuery, type BankCatalogue, type BankListQuestion } from "./model";

const catalogue = JSON.parse(readFileSync("public/bank/catalogue.json", "utf8")) as BankCatalogue<BankListQuestion>;

describe("opening one paper", () => {
  it("lists all 150 papers: exam series newest first, then mock sets, each Foundation 1-3 then Higher 1-3", () => {
    const papers = bankPapers(catalogue);
    expect(papers).toHaveLength(150);
    expect(papers.reduce((n, p) => n + p.questions, 0)).toBe(catalogue.questions.length);
    const sets = [...new Set(papers.map(p => p.set))];
    expect(sets[0]).toBe("June 2026");
    expect(sets.slice(0, 4)).toEqual(["June 2026", "November 2025", "June 2025", "November 2024"]);
    expect(sets.indexOf("June 2017")).toBe(sets.findIndex(s => s.startsWith("Mock")) - 1);
    expect(sets.slice(-2)).toEqual(["Mock Set 7", "Mock Set 8"]);
    expect(papers.slice(0, 6).map(paperName)).toEqual(["June 2026 1F", "June 2026 2F", "June 2026 3F", "June 2026 1H", "June 2026 2H", "June 2026 3H"]);
    for (const p of papers) expect(p.marks, p.id).toBe(80);
  });

  it("shows a paper whole, in paper order, whatever the other filters say, including Year 11 revision papers", () => {
    const revision = bankPapers(catalogue).find(p => p.revisionUse)!;
    const route = readRoute(`?paper=${revision.id.toLowerCase()}&code=U837&tier=F&calc=no`, catalogue);
    expect(route).toEqual({...emptyRoute, paper: revision.id});
    const shown = filterQuestions(catalogue, {...route, tier: revision.tier === "F" ? "H" : "F", revision: "hide", crossover: "only"});
    expect(shown.map(q => q.number)).toEqual(Array.from({length: revision.questions}, (_, i) => i + 1));
    expect(shown.every(q => q.paperId === revision.id)).toBe(true);
  });

  it("round-trips a paper link with its question and view", () => {
    const route = {...emptyRoute, paper: "1MA1_NOV_2023_2H", question: "1MA1_NOV_2023_2H_Q3", view: 0};
    expect(routeQuery(route)).toBe("?paper=1MA1_NOV_2023_2H&question=1MA1_NOV_2023_2H_Q3");
    expect(readRoute(routeQuery(route), catalogue)).toEqual(route);
    expect(readRoute("?code=U837", catalogue).paper).toBeUndefined();
    expect(routeQuery({...route, bankView: "topics"})).toBe(routeQuery(route));
  });

  it("says when a linked paper is not in the bank", () => {
    expect(emptyReason(catalogue, {...emptyRoute, paper: "1MA1_NOV_2099_2H"})).toBe("unknown-paper");
    expect(emptyReason(catalogue, {...emptyRoute, paper: "1MA1_NOV_2023_2H"})).toBeNull();
  });

  it("a paper added whole keeps its own question order, ahead of anything already on the paper", () => {
    const coverage = catalogueCoverage(catalogue, {...emptyRoute, revision: "include"});
    const earlier = draftReducer(emptyDraft(), {type: "add", questions: paperQuestions(catalogue, "1MA1_JUN_2018_1H").slice(0, 6)});
    const shown = draftEntries(coverage, earlier).map(e => e.question.source);
    const draft = draftReducer(earlier, {type: "paper", questions: paperQuestions(catalogue, "1MA1_NOV_2023_2H"), visible: draftEntries(coverage, earlier).map(e => e.key)});
    const sources = draftEntries(coverage, draft).map(e => e.question.source);
    expect(sources.slice(0, 21)).toEqual(Array.from({length: 21}, (_, i) => `November 2023 2H Q${i + 1}`));
    // What was already on the paper keeps the order it had on screen.
    expect(sources.slice(21)).toEqual(shown);
  });
});

describe("typing a paper into the search box", () => {
  const papers = bankPapers(catalogue);
  const names = (text: string) => matchPapers(papers, text).map(paperName);
  it("understands the ways teachers write a paper", () => {
    for (const text of ["nov 23 2h", "N23 2H", "november 2023 2H", "Nov 2023 paper 2 higher", "1MA1 Nov 2023 2H", "1MA1_NOV_2023_2H"])
      expect(names(text), text).toEqual(["November 2023 2H"]);
    expect(names("june 2019 1f")).toEqual(["June 2019 1F"]);
    expect(names("mock set 6 2h")).toEqual(["Mock Set 6 2H"]);
    expect(names("MS6 3F")).toEqual(["Mock Set 6 3F"]);
    expect(names("nov 23 2")).toEqual(["November 2023 2F", "November 2023 2H"]);
    expect(names("2023")).toHaveLength(12);
    expect(names("2h")[0]).toBe("June 2026 2H");
  });
  it("leaves topic searches alone", () => {
    for (const text of ["U837", "box plots", "pythagoras", "", "2", "angles in a triangle", "M108"]) expect(names(text), text).toEqual([]);
  });
});
