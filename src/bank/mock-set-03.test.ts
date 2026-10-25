import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
import {emptyRoute,exportSelection,filterQuestions,verifyCatalogue} from "./model";
import {originalPaperCount,performanceFor,withPerformance} from "./performance";
const bank=withPerformance(verifyCatalogue(JSON.parse(readFileSync("public/bank/catalogue.json","utf8"))));
const questions=bank.questions.filter(q=>q.paperId.startsWith("1MA1_MOCK_SET_03_"));
describe("complete reviewed Mock Set 3",()=>{
 it("retains the exact six source inventories and reconciled explicit subparts",()=>{
  expect(questions).toHaveLength(144);
  expect(questions.reduce((n,q)=>n+q.marks,0)).toBe(480);
  expect(questions.reduce((n,q)=>n+q.parts.length,0)).toBe(216);
  for(const [component,count] of [["1F",27],["2F",26],["3F",27],["1H",20],["2H",22],["3H",22]] as const){
   const paper=questions.filter(q=>q.paperId===`1MA1_MOCK_SET_03_${component}`);
   expect(paper.map(q=>q.number)).toEqual(Array.from({length:count},(_,i)=>i+1));
   expect(paper.reduce((n,q)=>n+q.marks,0)).toBe(80);
   expect(originalPaperCount(paper[0].paperId)).toBe(count);
  }
  expect(questions.find(q=>q.id==="1MA1_MOCK_SET_03_2F_Q19")!.parts.map(p=>[p.label,p.marks])).toEqual([["19(a)(i)",2],["19(a)(ii)",1],["19(b)(i)",2],["19(b)(ii)",1]]);
 });
 it("classifies every Set 3 appearance honestly as estimated with complete counts",()=>{
  for(const q of questions){
   expect(q.performance?.kind,q.id).toBe("estimated");
   expect(Number.isFinite(q.performance?.percentage),q.id).toBe(true);
   expect(q.performance!.percentage).toBeGreaterThanOrEqual(0);expect(q.performance!.percentage).toBeLessThanOrEqual(100);
   expect(performanceFor({...q,paperId:"unknown_set_3_count"})).toBeUndefined();
   expect(q.writingSpacePolicy).toBe("source");
   expect(q.parts.every(p=>p.sourceCodes.length===0&&p.mappingStatus==="source-reviewed")).toBe(true);
  }
 });
 it("preserves all 18 common pairs under tier filters, direct links and either selection order",()=>{
  const shared=questions.filter(q=>q.tier==="F"&&q.equivalentId);expect(shared).toHaveLength(18);
  for(const f of shared){const h=questions.find(q=>q.id===f.equivalentId)!;
   expect(h.equivalentId).toBe(f.id);
   for(const q of [f,h])expect(filterQuestions(bank,{...emptyRoute,tier:q.tier,collection:"mock",code:q.codes[0],question:q.id}).some(x=>x.id===q.id)).toBe(true);
   expect(exportSelection(bank,[f.id,h.id]).questions.map(q=>q.id)).toEqual([f.id]);
   expect(exportSelection(bank,[h.id,f.id]).questions.map(q=>q.id)).toEqual([h.id]);
  }
 });
 it("retains source answer appendices and explicit source-scheme clarifications",()=>{
  expect(questions.filter(q=>q.schemeSourceNote)).toHaveLength(10);
  for(const [component,n,page] of [["1F",13,13],["1F",17,14],["1H",9,16],["1H",10,15],["1H",18,16]] as const){
   const q=questions.find(q=>q.id===`1MA1_MOCK_SET_03_${component}_Q${n}`)!;
   expect(q.schemeViews.some(v=>v.sourcePages.includes(page)),q.id).toBe(true);
  }
  expect(questions.find(q=>q.id==="1MA1_MOCK_SET_03_3H_Q5")!.schemeSourceNote).toContain("positive y-intercept +2");
 });
 it("keeps the explicit hexagon drawing area and physically sensitive source geometry",()=>{
  const hex=questions.find(q=>q.id==="1MA1_MOCK_SET_03_1F_Q5")!;
  expect(hex.questionViews[0].height).toBeGreaterThan(200);
  expect(questions.filter(q=>q.scaleSensitive).map(q=>q.id)).toEqual(["1MA1_MOCK_SET_03_1F_Q8","1MA1_MOCK_SET_03_3F_Q21","1MA1_MOCK_SET_03_3H_Q3"]);
 });
});
