import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bankPapers, emptyReason, emptyRoute, filterQuestions, paperName, readRoute, routeQuery, type BankCatalogue, type BankListQuestion } from "./model";

const catalogue = JSON.parse(readFileSync("public/bank/catalogue.json", "utf8")) as BankCatalogue<BankListQuestion>;

describe("opening one paper", () => {
  it("lists all 138 papers: exam series newest first, then mock sets, each Foundation 1-3 then Higher 1-3", () => {
    const papers = bankPapers(catalogue);
    expect(papers).toHaveLength(138);
    expect(papers.reduce((n, p) => n + p.questions, 0)).toBe(catalogue.questions.length);
    const sets = [...new Set(papers.map(p => p.set))];
    expect(sets[0]).toBe("June 2025");
    expect(sets.slice(0, 3)).toEqual(["June 2025", "November 2024", "June 2024"]);
    expect(sets.indexOf("June 2017")).toBe(sets.findIndex(s => s.startsWith("Mock")) - 1);
    expect(sets.slice(-2)).toEqual(["Mock Set 7", "Mock Set 8"]);
    expect(papers.slice(0, 6).map(paperName)).toEqual(["June 2025 1F", "June 2025 2F", "June 2025 3F", "June 2025 1H", "June 2025 2H", "June 2025 3H"]);
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
});
