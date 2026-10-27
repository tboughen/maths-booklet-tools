import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { preserveWorkedSolutions, validateWorkedSolution, type WorkedSolution } from "../../workedSolution";
import { catalogueAssetPaths } from "../../bankAssets";
import { verifyCatalogue, type BankCatalogue } from "./model";
import { questionResource } from "./resources";

const publishedCatalogue = JSON.parse(readFileSync("public/bank/catalogue.json", "utf8")) as BankCatalogue;
// Legacy/rebuild fixtures must omit attachments explicitly now that real bank
// questions can have solutions. Keep the production catalogue as a control.
const catalogue = structuredClone(publishedCatalogue);
for (const question of catalogue.questions) delete question.workedSolution;
const original = catalogue.questions[0];
export const solution: WorkedSolution = { schemaVersion: 1, revision: "solution-1", basedOnQuestionRevision: original.revision,
  pdf: "bank/assets/solution/solution.pdf", pdfSha256: "a".repeat(64),
  views: [8,9].map((page,index) => ({ id: `solution-${index+1}`, label: `Original page ${page}`, page: index+1, sourcePages: [page],
    width: 595.28, height: 841.89, preview: `bank/assets/solution/page-${index+1}.png`, description: `Target question only, original page ${page}` })) };

describe("optional authored worked solutions", () => {
  it("accepts individual question block composition and repeated source pages without relaxing legacy validation",()=>{
    const composed:WorkedSolution={...structuredClone(solution),layout:"individual-question"};
    composed.views[0].sourcePages=[8,9];composed.views[1].sourcePages=[9];
    composed.views[1].repeatedContext="Original page 9 continued after the composed first view.";
    expect(()=>validateWorkedSolution(composed,original.revision)).not.toThrow();
    const q={...original,workedSolution:composed};
    expect(questionResource(q,"worked-solution").views).toEqual(composed.views);
    for(const sourcePages of [[],[0],[9,8],[8,8],[1.5]]){
      const invalid=structuredClone(composed);invalid.views[0].sourcePages=sourcePages;
      expect(()=>validateWorkedSolution(invalid,original.revision)).toThrow();
    }
    expect(()=>validateWorkedSolution({...composed,layout:"full-crop"},original.revision)).toThrow();
  });
  it("accepts legacy catalogue without attachments and resolves question/scheme independently", () => {
    expect(verifyCatalogue(publishedCatalogue)).toBe(publishedCatalogue);
    expect(verifyCatalogue(catalogue)).toBe(catalogue);
    expect(questionResource(original,"question").pdf).toBe(original.questionPdf);
    expect(questionResource(original,"scheme").pdf).toBe(original.schemePdf);
    expect(() => questionResource(original,"worked-solution")).toThrow("not available");
  });
  it("validates the attachment and keeps derivative indexes separate from original page numbers", () => {
    const question = { ...original, workedSolution: structuredClone(solution) };
    expect(verifyCatalogue({ ...catalogue, questions: catalogue.questions.map(q => q.id===question.id?question:q) })).toBeTruthy();
    const resource = questionResource(question,"worked-solution");
    expect(resource.label).toBe("Worked solution");
    expect(resource.views.map(v=>v.page)).toEqual([1,2]);
    expect(resource.views.map(v=>v.sourcePages)).toEqual([[8],[9]]);
    expect(questionResource(question,"scheme").pdf).toBe(original.schemePdf);
    const paths = catalogueAssetPaths({questions:[question,question]});
    expect(paths.filter(p=>p.includes("/solution/"))).toHaveLength(3);
  });
  it.each([
    {views:[]}, {pdf:"bank/assets/../solution.pdf"}, {pdf:"https://example.com/a.pdf"}, {pdfSha256:"bad"},
    {basedOnQuestionRevision:"changed"}, {schemaVersion:2}, {views:[{...solution.views[0],page:8}]},
    {views:[{...solution.views[0],width:0}]}, {views:[{...solution.views[0],height:NaN}]},
    {views:[{...solution.views[0],preview:"bank/assets/a.pdf"}]},
    {views:[solution.views[0],{...solution.views[1],id:solution.views[0].id}]},
    {views:[solution.views[0],{...solution.views[1],sourcePages:[8]}]},
    {views:[{...solution.views[0],sourcePages:[8,9]}]}, {views:[{...solution.views[0],description:""}]},
  ])("rejects incomplete, stale or misleading solution metadata: %j", change => {
    const invalid = {...solution,...change};
    expect(()=>validateWorkedSolution(invalid,original.revision)).toThrow();
    expect(()=>catalogueAssetPaths({questions:[{...original,workedSolution:invalid as WorkedSolution}]})).toThrow();
  });
  it("preserves per-ID attachments on rebuild and fails rather than dropping or transferring them", () => {
    const attached = {...original,workedSolution:solution};
    expect(preserveWorkedSolutions([attached],[{...original}])[0].workedSolution).toEqual(solution);
    expect(()=>preserveWorkedSolutions([attached],[])).toThrow("remove");
    expect(()=>preserveWorkedSolutions([attached],[{...original,revision:"changed"}])).toThrow("different question revision");
    expect(()=>preserveWorkedSolutions([attached],[{...attached,workedSolution:{...solution,revision:"other"}}])).toThrow("conflicts");
    expect(preserveWorkedSolutions([attached],[{...original},{...original,id:"other-id"}])[1].workedSolution).toBeUndefined();
  });
});
