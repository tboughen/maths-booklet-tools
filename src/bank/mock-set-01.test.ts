import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
import {verifyCatalogue,emptyRoute,filterQuestions,exportSelection} from "./model";
import {withPerformance} from "./performance";
const bank=withPerformance(verifyCatalogue(JSON.parse(readFileSync("public/bank/catalogue.json","utf8"))));
const questions=bank.questions.filter(q=>q.set==="Mock Set 1");
describe("complete reviewed Mock Set 1",()=>{
  it("retains all original questions, marks and independently measured percentages",()=>{
    expect(questions).toHaveLength(146);
    expect(questions.reduce((n,q)=>n+q.marks,0)).toBe(480);
    expect(questions.reduce((n,q)=>n+q.parts.length,0)).toBe(207);
    for(const [component,count] of [["1F",24],["2F",29],["3F",27],["1H",24],["2H",21],["3H",21]] as const){
      const paper=questions.filter(q=>q.paperId===`1MA1_MOCK_SET_01_${component}`);
      expect(paper.map(q=>q.number)).toEqual(Array.from({length:count},(_,i)=>i+1));
      expect(paper.reduce((n,q)=>n+q.marks,0)).toBe(80);
      expect(paper.every(q=>q.performance?.kind==="measured"&&q.writingSpacePolicy==="source")).toBe(true);
    }
    for(const [component,number,value] of [["1F",10,29],["1F",24,100*.67/3],["3H",3,38],["3H",19,5.6]] as const)
      expect(questions.find(q=>q.id===`1MA1_MOCK_SET_01_${component}_Q${number}`)?.performance?.percentage).toBeCloseTo(value);
    expect(questions.filter(q=>q.schemeSourceNote)).toHaveLength(7);
    expect(questions.every(q=>q.parts.every(p=>p.sourceCodes.length===0&&p.mappingStatus==="source-reviewed"))).toBe(true);
    expect(questions.filter(q=>q.scaleSensitive).map(q=>q.id)).toEqual(["1MA1_MOCK_SET_01_3F_Q10"]);
  });
  it("keeps both crossover appearances and tier-specific measured data",()=>{
    const shared=questions.filter(q=>q.tier==="F"&&q.equivalentId);
    expect(shared).toHaveLength(20);
    for(const f of shared){
      const h=questions.find(q=>q.id===f.equivalentId)!;
      for(const q of [f,h]){
        expect(filterQuestions(bank,{...emptyRoute,tier:q.tier,collection:"mock",code:q.codes[0],question:q.id}).some(x=>x.id===q.id)).toBe(true);
        expect(q.performance?.kind).toBe("measured");
      }
      expect(exportSelection(bank,[f.id,h.id]).questions.map(q=>q.id)).toEqual([f.id]);
      expect(exportSelection(bank,[h.id,f.id]).questions.map(q=>q.id)).toEqual([h.id]);
    }
  });
});
