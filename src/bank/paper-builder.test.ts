import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalogueCoverage } from "./coverage";
import { draftEntries, draftReducer, emptyDraft } from "./paper-builder";
import { emptyRoute, questionIdentity, readRoute, routeQuery, verifyCatalogue, type BankCatalogue, type BankQuestion } from "./model";

const bank=verifyCatalogue(JSON.parse(readFileSync("public/bank/catalogue.json","utf8")));
const all=catalogueCoverage(bank,emptyRoute);
const q=(id:string,codes:string[],tier:"F"|"H"="F",other?:string)=>({id,order:Number(id.replace(/\D/g,""))||1,source:id,paperId:`series_1${tier}`,codes,tier,equivalentId:other,calculator:false,collection:"Exam",marks:4,parts:[{label:"a",codes,marks:4}]} as BankQuestion);
const f=q("q1",["U1"],"F","q2"),h=q("q2",["U2"],"H","q1"),shared=q("q3",["U1","U2"]),extra=q("q4",["U3"]);
const fixture={...bank,questions:[f,h,shared,extra],topics:["U1","U2","U3"].map(code=>({...bank.topics[0],code})),aliases:{OLD:"U1"}} as BankCatalogue;
const scope=catalogueCoverage(fixture,emptyRoute);
const tick=(code:string)=>({type:"code" as const,code,checked:true});

describe("shared paper draft",()=>{
  it("matches independent catalogue counts for every topic in all 27 filter combinations",()=>{
    for(const tier of ["all","F","H"] as const)for(const collection of ["all","past","mock"] as const)for(const calculator of ["all","yes","no"] as const){
      const filters={tier,collection,calculator},coverage=catalogueCoverage(bank,filters);
      for(const topic of bank.topics){
        const raw=bank.questions.filter(q=>(tier==="all"||q.tier===tier)&&(collection==="all"||(/^mock/i.test(q.collection)?"mock":"past")===collection)&&(calculator==="all"||q.calculator===(calculator==="yes"))&&q.codes.includes(topic.code));
        const expected=new Set(raw.map(q=>q.equivalentId?[q.id,q.equivalentId].sort().join("|"):q.id));
        expect(coverage.codes.get(topic.code)||new Set(),`${topic.code} ${JSON.stringify(filters)}`).toEqual(expected);
        const entries=draftEntries(coverage,draftReducer(emptyDraft(),tick(topic.code)));
        expect(new Set(entries.map(e=>e.key))).toEqual(expected);
        expect(entries.length).toBe(expected.size);
      }
    }
  });
  it("derives series and papers from component IDs",()=>{
    expect([all.examSeries,all.examPapers,all.mockSeries,all.mockPapers,all.groups.size]).toEqual([8,48,8,48,2034]);
  });
  it("combines overlapping codes and both crossover mappings, retaining an eligible source",()=>{
    const state=draftReducer(draftReducer(emptyDraft(),tick("U1")),tick("U2"));
    const entries=draftEntries(scope,state);
    expect(entries).toHaveLength(2);expect(entries[0].matchingCodes).toEqual(["U1","U2"]);
    expect(entries.reduce((n,e)=>n+e.question.marks,0)).toBe(8);
    const higher=draftEntries(catalogueCoverage(fixture,{...emptyRoute,tier:"H"}),state);
    expect(higher.map(e=>e.question.id)).toEqual(["q2"]);
    expect(draftEntries(catalogueCoverage(fixture,{...emptyRoute,tier:"F"}),draftReducer(emptyDraft(),tick("U2"))).map(e=>e.question.id)).toEqual(["q3"]);
  });
  it("keeps manual contributions on untick and excludes the identity across both tiers",()=>{
    let state=draftReducer(draftReducer(emptyDraft(),tick("U1")),{type:"question",question:h,checked:true});
    expect(draftEntries(scope,state).find(e=>e.key===questionIdentity(h))?.question.id).toBe("q2");
    state=draftReducer(state,{type:"code",code:"U1",checked:false});
    expect(draftEntries(scope,state).map(e=>e.question.id)).toEqual(["q2"]);
    state=draftReducer(state,{type:"question",question:f,checked:false});
    expect(draftEntries(catalogueCoverage(fixture,{...emptyRoute,tier:"H"}),state)).toEqual([]);
    state=draftReducer(state,{type:"restore"});expect(draftEntries(scope,state)).toHaveLength(1);
    state=draftReducer(draftReducer(state,{type:"exclude",key:questionIdentity(f)}),{type:"question",question:f,checked:true});
    expect(draftEntries(scope,state)[0].question.id).toBe("q1");
  });
  it("retains order when a filter hides and restores questions",()=>{
    let state=draftReducer(emptyDraft(),{type:"add",questions:[f,h,shared,extra]});
    const keys=draftEntries(scope,state).map(e=>e.key);
    state=draftReducer(state,{type:"remember",keys});
    state=draftReducer(state,{type:"move",key:keys[2],direction:-1,visible:keys});
    const expected=draftEntries(scope,state).map(e=>e.key);
    draftEntries(catalogueCoverage(fixture,{...emptyRoute,tier:"H"}),state);
    expect(draftEntries(scope,state).map(e=>e.key)).toEqual(expected);
    expect(expected).toEqual([keys[0],keys[2],keys[1]]);
  });
  it("reconciles aliases and removed questions when the catalogue changes",()=>{
    let state=draftReducer(draftReducer(emptyDraft("old"),tick("OLD")),{type:"add",questions:[h,extra]});
    state=draftReducer(state,{type:"reconcile",catalogue:{...fixture,version:"new",questions:[f,h,shared]}});
    expect(state.codes).toEqual(["U1"]);expect(state.version).toBe("new");expect(Object.values(state.manual)).toEqual(["q2"]);
  });
  it("preserves topics routes and defaults old direct links to the viewer",()=>{
    expect(readRoute("?tool=question-bank&code=U1&question=q1",fixture).bankView).toBe("questions");
    const route={...emptyRoute,bankView:"topics" as const,tier:"H" as const,collection:"mock" as const,calculator:"yes" as const};
    expect(readRoute(routeQuery(route),fixture)).toEqual(route);
  });
});
