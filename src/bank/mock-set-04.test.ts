import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
import {emptyRoute,exportSelection,filterQuestions,verifyCatalogue} from "./model";
import {originalPaperCount,performanceFor,withPerformance} from "./performance";
const bank=withPerformance(verifyCatalogue(JSON.parse(readFileSync("public/bank/catalogue.json","utf8"))));
const questions=bank.questions.filter(q=>q.paperId.startsWith("1MA1_MOCK_SET_04_"));
describe("complete reviewed Mock Set 4",()=>{
 it("matches all six original source inventories and nested printed parts",()=>{
  expect(questions).toHaveLength(151);
  expect(questions.reduce((n,q)=>n+q.marks,0)).toBe(480);
  expect(questions.reduce((n,q)=>n+q.parts.length,0)).toBe(219);
  for(const [component,count] of [["1F",30],["2F",27],["3F",29],["1H",21],["2H",21],["3H",23]] as const){
   const paper=questions.filter(q=>q.paperId===`1MA1_MOCK_SET_04_${component}`);
   expect(paper.map(q=>q.number)).toEqual(Array.from({length:count},(_,i)=>i+1));
   expect(paper.reduce((n,q)=>n+q.marks,0)).toBe(80);expect(originalPaperCount(paper[0].paperId)).toBe(count);
  }
  expect(questions.find(q=>q.id==="1MA1_MOCK_SET_04_2F_Q13")!.parts.map(p=>[p.label,p.marks])).toEqual([["13(a)",1],["13(b)",2],["13(c)(i)",2],["13(c)(ii)",1]]);
  expect(questions.find(q=>q.id==="1MA1_MOCK_SET_04_2H_Q2")!.parts.map(p=>[p.label,p.marks])).toEqual([["2(a)(i)",1],["2(a)(ii)",1],["2(a)(iii)",1],["2(b)",2]]);
 });
 it("labels every appearance estimated and preserves original working space",()=>{
  for(const q of questions){expect(q.performance?.kind,q.id).toBe("estimated");expect(Number.isFinite(q.performance?.percentage)).toBe(true);expect(q.performance!.percentage).toBeGreaterThanOrEqual(0);expect(q.performance!.percentage).toBeLessThanOrEqual(100);expect(performanceFor({...q,paperId:"unknown_set4_count"})).toBeUndefined();expect(q.writingSpacePolicy).toBe("source");expect(q.parts.every(p=>p.sourceCodes.length===0&&p.mappingStatus==="source-reviewed")).toBe(true);}
 });
 it("retains all 23 reciprocal common identities under tier filters and either selection order",()=>{
  const shared=questions.filter(q=>q.tier==="F"&&q.equivalentId);expect(shared).toHaveLength(23);
  for(const f of shared){const h=questions.find(q=>q.id===f.equivalentId)!;expect(h.equivalentId).toBe(f.id);for(const q of [f,h])expect(filterQuestions(bank,{...emptyRoute,tier:q.tier,collection:"mock",code:q.codes[0],question:q.id}).some(x=>x.id===q.id)).toBe(true);expect(exportSelection(bank,[f.id,h.id]).questions.map(q=>q.id)).toEqual([f.id]);expect(exportSelection(bank,[h.id,f.id]).questions.map(q=>q.id)).toEqual([h.id]);}
 });
 it("keeps the official marking material alongside eight explicit source clarifications",()=>{
  expect(questions.filter(q=>q.schemeSourceNote)).toHaveLength(8);
  expect(questions.find(q=>q.id==="1MA1_MOCK_SET_04_3F_Q27")!.schemeSourceNote).toContain("(0,1)");
  expect(questions.find(q=>q.id==="1MA1_MOCK_SET_04_3H_Q2")!.schemeSourceNote).toContain("(a)(i)");
  expect(questions.find(q=>q.id==="1MA1_MOCK_SET_04_2F_Q7")!.schemeSourceNote).toContain("6 more adults");
  expect(questions.find(q=>q.id==="1MA1_MOCK_SET_04_1H_Q14")!.schemeViews).toHaveLength(2);
 });
 it("preserves the five actual measurement/construction tasks and their drawing targets",()=>{
  expect(questions.filter(q=>q.scaleSensitive).map(q=>q.id)).toEqual(["1MA1_MOCK_SET_04_1F_Q13","1MA1_MOCK_SET_04_1F_Q25","1MA1_MOCK_SET_04_2F_Q5","1MA1_MOCK_SET_04_3F_Q10","1MA1_MOCK_SET_04_1H_Q5"]);
  const drawing=questions.find(q=>q.id==="1MA1_MOCK_SET_04_2F_Q5")!;expect(drawing.questionViews[0].height).toBeGreaterThan(350);
 });
});
