import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { preserveWorkedSolutions, validateWorkedSolution, workedDataPath, type WorkedSolution } from "../../workedSolution";
import { catalogueAssetPaths } from "../../bankAssets";
import { verifyCatalogue, type BankCatalogue, type BankQuestion } from "./model";
import { questionResource } from "./resources";
import { workedPlan } from "./worked";
import { servedParts } from "./cuts";

const publishedCatalogue = JSON.parse(readFileSync("public/bank/catalogue.json", "utf8")) as BankCatalogue;
const catalogue = structuredClone(publishedCatalogue);
for (const question of catalogue.questions) delete question.workedSolution;
const original = catalogue.questions[0];
export const solution: WorkedSolution = { schemaVersion: 2, revision: "solution-1", basedOnQuestionRevision: original.revision,
  data: workedDataPath(original.id, "solution-1"), dataSha256: "a".repeat(64) };

describe("worked solutions as data", () => {
  it("accepts the catalogue without attachments and resolves question and scheme independently", () => {
    expect(verifyCatalogue(publishedCatalogue)).toBe(publishedCatalogue);
    expect(verifyCatalogue(catalogue)).toBe(catalogue);
    expect(questionResource(original, "question").pdf).toBe(original.questionPdf);
    expect(questionResource(original, "scheme").pdf).toBe(original.schemePdf);
    expect(() => questionResource(original, "worked-solution")).toThrow("not available");
  });
  it("validates the attachment and draws over the question's own pages", () => {
    const question = { ...original, workedSolution: structuredClone(solution) };
    expect(verifyCatalogue({ ...catalogue, questions: catalogue.questions.map(q => q.id === question.id ? question : q) })).toBeTruthy();
    const resource = questionResource(question, "worked-solution");
    expect(resource.label).toBe("Worked solution");
    expect(resource.views).toBe(question.questionViews);
    expect(catalogueAssetPaths({ questions: [question, question] }).filter(p => p.includes("/worked/"))).toEqual([solution.data]);
  });
  it.each([
    { data: "bank/assets/../solution.json" }, { data: "https://example.com/a.json" }, { data: "bank/assets/worked/a.pdf" },
    { data: "bank/assets/other/a.json" }, { dataSha256: "bad" }, { basedOnQuestionRevision: "changed" }, { schemaVersion: 1 },
    { revision: "has space" }, { pdf: "bank/assets/a.pdf" }, { views: [] },
  ])("rejects incomplete, stale or old-style metadata: %j", change => {
    const invalid = { ...solution, ...change };
    expect(() => validateWorkedSolution(invalid, original.revision)).toThrow();
    expect(() => catalogueAssetPaths({ questions: [{ ...original, workedSolution: invalid as WorkedSolution }] })).toThrow();
  });
  it("preserves per-ID attachments on rebuild and fails rather than dropping or transferring them", () => {
    const attached = { ...original, workedSolution: solution };
    expect(preserveWorkedSolutions([attached], [{ ...original }])[0].workedSolution).toEqual(solution);
    expect(() => preserveWorkedSolutions([attached], [])).toThrow("remove");
    expect(() => preserveWorkedSolutions([attached], [{ ...original, revision: "changed" }])).toThrow("different question revision");
    expect(() => preserveWorkedSolutions([attached], [{ ...attached, workedSolution: { ...solution, revision: "other" } }])).toThrow("conflicts");
    expect(preserveWorkedSolutions([attached], [{ ...original }, { ...original, id: "other-id" }])[1].workedSolution).toBeUndefined();
  });
});

describe("what a worked solution is drawn over", () => {
  const cut = catalogue.questions.find(q => q.cuts?.some(c => c.kind === "stem") && q.cuts.filter(c => c.kind === "part").length > 1) as BankQuestion;
  const uncut = catalogue.questions.find(q => !q.cuts?.length && q.questionViews.length > 1) as BankQuestion;
  it("stacks every cut of a whole question with its total, since the cuts leave it out", () => {
    const plan = workedPlan(cut, undefined);
    expect(plan.items.map(i => i.view.id)).toEqual(cut.cuts!.flatMap(c => c.views.map(v => v.id)));
    expect(plan.total).toEqual({ question: cut.number, marks: cut.marks });
  });
  it("shows only the served part's cuts, with no total, in part view", () => {
    const last = cut.cuts!.filter(c => c.kind === "part").at(-1)!;
    const served = servedParts(cut, last.parts)!;
    const plan = workedPlan(cut, served);
    expect(plan.total).toBeUndefined();
    expect(plan.items.map(i => i.pdf)).toEqual(served.cuts.flatMap(s => s.cut.views.map(() => s.cut.pdf)));
  });
  it("uses the question's own views for an uncut question", () => {
    const plan = workedPlan(uncut, undefined);
    expect(plan.items.map(i => i.view)).toEqual(uncut.questionViews);
    expect(plan.total).toBeUndefined();
  });
});
