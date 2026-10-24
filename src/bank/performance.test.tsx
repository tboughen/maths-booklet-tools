import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PerformanceBadge } from "./PerformanceBadge";
import { compareAccessibility, estimatePercentage, percentageColour, performanceFor, withPerformance } from "./performance";
import { emptyRoute, filterQuestions, questionIdentity, verifyCatalogue } from "./model";
import { catalogueCoverage } from "./coverage";
import { draftEntries, draftReducer, emptyDraft } from "./paper-builder";
import data from "./performance-data.json";

const bank = withPerformance(verifyCatalogue(JSON.parse(readFileSync("public/bank/catalogue.json","utf8"))));
afterEach(cleanup);
const q = (id:string, percentage?:number, tier:"F"|"H"="F") => ({...bank.questions[0], id, tier, equivalentId:undefined, order:Number(id), performance:percentage===undefined?undefined:{percentage,kind:"measured" as const}});

describe("automatic accessibility",()=>{
  it("weights source parts by their marks and rejects a mismatched question",()=>{
    const question=bank.questions.find(q=>q.id==="1MA1_JUN_2017_1H_Q1")!;
    expect(question.performance?.percentage).toBeCloseTo(95.6);
    expect(performanceFor({...question,marks:6})?.kind).toBe("estimated");
    expect(bank.questions.find(q=>q.id==="1MA1_NOV_2018_3F_Q19")?.performance?.kind).toBe("estimated");
    expect(bank.questions.find(q=>q.id==="1MA1_JUN_2017_2F_Q5")?.performance?.kind).toBe("estimated");
  });
  it("orders within tiers, preserves real zero and places missing data last",()=>{
    const questions=[q("1",0),q("2",undefined),q("3",73),q("4",98,"H"),q("5",73)];
    expect(questions.sort(compareAccessibility).map(q=>q.id)).toEqual(["3","5","1","2","4"]);
  });
  it("interpolates between points, clamps endpoints and keeps curves nonincreasing",()=>{
    expect(estimatePercentage(.5,[{position:.2,percentage:80},{position:.8,percentage:20}])).toBeCloseTo(50);
    expect(estimatePercentage(0,data.curves.F)).toBe(data.curves.F[0].percentage);
    expect(estimatePercentage(1,data.curves.H)).toBe(data.curves.H.at(-1)?.percentage);
    for(const tier of ["F","H"] as const)for(let i=1;i<data.curves[tier].length;i++)expect(data.curves[tier][i].percentage).toBeLessThanOrEqual(data.curves[tier][i-1].percentage);
    expect(performanceFor({...q("99"),paperId:"new_partial",number:2})).toBeUndefined();
    expect(performanceFor({...q("99"),paperId:"new_partial",number:2},24)?.kind).toBe("estimated");
  });
  it("enriches every appearance without mutating catalogue content or Sparx mappings",()=>{
    const raw=JSON.parse(readFileSync("public/bank/catalogue.json","utf8"));
    expect(bank.questions).toHaveLength(1933);
    expect(bank.questions.every(q=>q.performance&&q.performance.percentage>=0&&q.performance.percentage<=100)).toBe(true);
    expect(bank.questions.filter(q=>q.performance?.kind==="measured")).toHaveLength(1334);
    expect(bank.questions.map(({performance,...question})=>{void performance;return question;})).toEqual(raw.questions);
  });
  it("filters before deduplication, retains both tier scores and preferred direct links",()=>{
    const f=bank.questions.find(q=>q.id==="1MA1_JUN_2017_1F_Q21")!, h=bank.questions.find(q=>q.id===f.equivalentId)!;
    expect(f.performance?.percentage).toBeCloseTo(77.6);expect(h.performance?.percentage).toBeCloseTo(95.6);
    const code=f.codes.find(code=>h.codes.includes(code))!;
    const result=filterQuestions(bank,{...emptyRoute,code,tier:"F"});
    expect(result.find(q=>questionIdentity(q)===questionIdentity(f))?.id).toBe(f.id);
    expect(filterQuestions(bank,{...emptyRoute,code,question:h.id}).filter(q=>questionIdentity(q)===questionIdentity(f)).map(q=>q.id)).toEqual([h.id]);
  });
  it("sorts new additions automatically until manual order is chosen",()=>{
    const low=q("1",20),high=q("2",90),mid=q("3",60);
    const fixture={...bank,questions:[low,high,mid]},coverage=catalogueCoverage(fixture,emptyRoute);
    let state=draftReducer(emptyDraft(),{type:"add",questions:[low,high]});
    let keys=draftEntries(coverage,state).map(e=>e.key);
    state=draftReducer(state,{type:"remember",keys});
    state=draftReducer(state,{type:"add",questions:[mid]});
    expect(draftEntries(coverage,state).map(e=>e.question.id)).toEqual(["2","3","1"]);
    keys=draftEntries(coverage,state).map(e=>e.key);
    state=draftReducer(state,{type:"move",key:keys[2],direction:-1,visible:keys});
    expect(draftEntries(coverage,state).map(e=>e.question.id)).toEqual(["2","1","3"]);
  });
});

it("shows measured tier percentages in pastel and estimates in grey",()=>{
  const estimated={...q("1",46),performance:{kind:"estimated" as const,percentage:46}};
  render(<PerformanceBadge question={estimated}/>);
  expect(screen.getByText("Estimated 46%")).toHaveClass("qb-performance-estimated");
  cleanup();render(<PerformanceBadge question={q("1",72)}/>);
  expect(screen.getByText("72%")).toHaveStyle({backgroundColor:percentageColour(72)});
});

it("maintains readable contrast across the complete pastel gradient",()=>{
  const luminance=(rgb:number[])=>rgb.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((n,x,i)=>n+x*[.2126,.7152,.0722][i],0);
  for(let p=0;p<=100;p++){
    const background=percentageColour(p).match(/\d+/g)!.map(Number);
    expect((luminance(background)+.05)/(luminance([36,49,58])+.05)).toBeGreaterThan(4.5);
  }
});
