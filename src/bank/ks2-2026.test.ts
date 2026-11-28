import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
import {verifyCatalogue,verifyQuestionDetail,emptyRoute,filterQuestions,bankPapers,paperName,matchPapers,levelLabel,readRoute,routeQuery} from "./model";
const bank=verifyCatalogue(JSON.parse(readFileSync("public/bank/catalogue.json","utf8")));
const questions=bank.questions.filter(q=>q.collection==="ks2");
describe("KS2 2026 tests (pilot)",()=>{
  it("keeps all 80 questions, 88 parts and 110 marks of the three papers",()=>{
    expect(questions).toHaveLength(80);
    expect(questions.reduce((n,q)=>n+q.parts.length,0)).toBe(88);
    for(const [paper,count,marks] of [["P1",36,40],["P2",23,35],["P3",21,35]] as const){
      const qs=questions.filter(q=>q.paperId===`KS2_2026_${paper}`);
      expect(qs.map(q=>q.number).sort((a,b)=>a-b)).toEqual(Array.from({length:count},(_,i)=>i+1));
      expect(qs.reduce((n,q)=>n+q.marks,0)).toBe(marks);
    }
    for(const q of questions){
      verifyQuestionDetail(q);
      expect(q.calculator).toBe(false);
      expect(q.questionPdf.startsWith(`bank/assets/ks2-2026/${q.id}/`)).toBe(true);
      for(const p of q.parts){
        expect(p.objectives?.length).toBeGreaterThan(0);
        expect(p.sourceCodes.length).toBeGreaterThan(0);
      }
    }
  });
  it("files each part under the Sparx topics of its objective",()=>{
    const q=questions.find(q=>q.id==="KS2_2026_P3_Q8")!;
    expect(q.parts.map(p=>[p.label,p.objectives,p.needsUpTo])).toEqual([["8a",["SP8.02"],["NP2.02"]],["8b",["SP8.02"],[]]]);
    expect(q.cuts?.map(c=>c.id)).toEqual(["stem","a","b"]);
    const code=q.codes[0];
    expect(filterQuestions(bank,{...emptyRoute,code}).some(x=>x.id===q.id)).toBe(true);
    expect(filterQuestions(bank,{...emptyRoute,code,collection:"past"}).some(x=>x.id===q.id)).toBe(false);
    expect(filterQuestions(bank,{...emptyRoute,code,collection:"ks2"}).every(x=>x.collection==="ks2")).toBe(true);
    expect(levelLabel(q)).toBe("KS2");
  });
  it("names, finds and links the KS2 papers",()=>{
    const papers=bankPapers(bank);
    const p2=papers.find(p=>p.id==="KS2_2026_P2")!;
    expect(paperName(p2)).toBe("KS2 2026 Paper 2");
    expect(matchPapers(papers,"KS2 2026 paper 2").map(p=>p.id)).toEqual(["KS2_2026_P2"]);
    expect(matchPapers(papers,"ks2").map(p=>p.id).sort()).toEqual(["KS2_2026_P1","KS2_2026_P2","KS2_2026_P3"]);
    expect(matchPapers(papers,"nov 2023 2h").some(p=>p.ks2)).toBe(false);
    const route={...emptyRoute,code:"U851",collection:"ks2" as const};
    expect(readRoute(routeQuery(route),bank).collection).toBe("ks2");
  });
});
