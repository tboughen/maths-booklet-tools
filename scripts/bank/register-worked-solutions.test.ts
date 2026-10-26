// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { PDFDocument } from "pdf-lib";
import { Resvg } from "@resvg/resvg-js";
import { stageWorkedSolutions } from "./register-worked-solutions";
import { sha256, verifyCatalogueSolutionFiles } from "./solution-files";
import { prepareRelease } from "../cloudflare/release";

const roots: string[] = [];
afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
async function fixture() {
  const root=mkdtempSync(join(tmpdir(),"mathsdock-worked-test-"));roots.push(root);
  const publicRoot=join(root,"public"),path="bank/assets/solution/";
  mkdirSync(join(publicRoot,path),{recursive:true});
  const pdf=await PDFDocument.create();
  for(let i=0;i<2;i++)pdf.addPage([100,200]).drawText(`Target working ${i+1}`,{x:4,y:100,size:8});
  const bytes=await pdf.save();writeFileSync(join(publicRoot,path,"solution.pdf"),bytes);
  const png=new Resvg('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="200"><rect width="100" height="200" fill="white"/></svg>').render().asPng();
  writeFileSync(join(publicRoot,path,"page.png"),png);
  const solution={schemaVersion:1 as const,revision:"sol-1",basedOnQuestionRevision:"qrev",pdf:path+"solution.pdf",pdfSha256:sha256(bytes),
    views:[8,9].map((page,i)=>({id:`v${i}`,label:`Original page ${page}`,description:`Target only page ${page}`,page:i+1,width:100,height:200,preview:path+"page.png",sourcePages:[page]}))};
  const question={id:"Q1",revision:"qrev",questionPdf:solution.pdf,printPdf:solution.pdf,schemePdf:solution.pdf,questionViews:[],schemeViews:[]};
  const catalogue={version:"baseline",questions:[question,{...question,id:"Q2"}]};
  const files=[{path:solution.pdf,sha256:sha256(bytes)},{path:solution.views[0].preview,sha256:sha256(png)}];
  const registration={questionId:"Q1",expectedQuestionRevision:"qrev",solution,files,evidence:{sourcePdfSha256:"a".repeat(64),checkedPaperPdfSha256:"b".repeat(64),reviewRecordSha256:"c".repeat(64),targetOnly:true,fullOriginalPages:true}};
  const batch={schemaVersion:1,batchId:"batch-1",registrations:[registration]};
  const cataloguePath=join(root,"catalogue.json"),batchPath=join(root,"batch.json");
  writeFileSync(cataloguePath,JSON.stringify(catalogue));writeFileSync(batchPath,JSON.stringify(batch));
  return{root,publicRoot,cataloguePath,batchPath,output:join(root,"staged"),batch,catalogue,solution,files};
}

describe("worked solution registration and release closure",()=>{
  it("runs the real Node CLI without writing to its input catalogue",async()=>{
    const f=await fixture();
    const result=execFileSync(process.execPath,[resolve("scripts/bank/register-worked-solutions.ts"),`--catalogue=${f.cataloguePath}`,`--batch=${f.batchPath}`,`--public=${f.publicRoot}`,`--output=${f.output}`],{encoding:"utf8",windowsHide:true});
    expect(JSON.parse(result)).toEqual({state:"staged_not_published",added:1,unchanged:0,assets:2});
    expect(JSON.parse(readFileSync(f.cataloguePath,"utf8"))).toEqual(f.catalogue);
  });
  it("detects concurrent catalogue changes instead of sealing a stale proposal",async()=>{
    const f=await fixture();
    const pending=stageWorkedSolutions(f);
    writeFileSync(f.cataloguePath,JSON.stringify({...f.catalogue,version:"concurrent-update"}));
    await expect(pending).rejects.toThrow("changed during validation");expect(existsSync(f.output)).toBe(false);
  });
  it("stages native pages atomically, preserves unrelated records and repeats without overwriting",async()=>{
    const f=await fixture(),before=readFileSync(f.cataloguePath);
    const receipt=await stageWorkedSolutions(f);
    expect(receipt.state).toBe("staged_not_published");expect(receipt.registrations[0].action).toBe("added");
    const proposed=JSON.parse(readFileSync(join(f.output,"public/bank/catalogue.json"),"utf8"));
    expect(proposed.questions[1]).toEqual(f.catalogue.questions[1]);
    expect(readFileSync(f.cataloguePath)).toEqual(before);
    expect(readFileSync(join(f.output,"public",f.solution.pdf))).toEqual(readFileSync(join(f.publicRoot,f.solution.pdf)));
    const repeated=await stageWorkedSolutions({...f,cataloguePath:join(f.output,"public/bank/catalogue.json"),output:join(f.root,"repeat")});
    expect(repeated.registrations[0].action).toBe("unchanged");expect(repeated.version).toBe(receipt.version);
    await expect(stageWorkedSolutions(f)).rejects.toThrow("already exists");
    await verifyCatalogueSolutionFiles(f.publicRoot,proposed);
    writeFileSync(join(f.publicRoot,"bank/catalogue.json"),JSON.stringify(proposed));
    const release=prepareRelease(f.publicRoot,"commit"),q=JSON.parse(release.catalogueJson).questions[0];
    expect(q.workedSolution.pdf).toBe(`bank/assets/sha256/${f.solution.pdfSha256}.pdf`);
    expect(q.workedSolution.views[0].preview).toMatch(/^bank\/assets\/sha256\/[a-f0-9]{64}\.png$/);
    expect(release.manifest.assets).toHaveLength(2);
  });
  it.each(["revision","hash","page-count","pdf-geometry","pdf-crop","png-geometry","missing-file","file-manifest","review","duplicate","conflict"])("rejects %s before publishing any proposal",async(kind)=>{
    const f=await fixture();
    const entry=f.batch.registrations[0];
    if(kind==="revision")entry.expectedQuestionRevision="changed";
    if(kind==="hash")entry.solution.pdfSha256="0".repeat(64);
    if(kind==="page-count")entry.solution.views.pop();
    if(kind==="pdf-geometry")entry.solution.views[0].width=101;
    if(kind==="pdf-crop"){const pdf=await PDFDocument.load(readFileSync(join(f.publicRoot,entry.solution.pdf)));pdf.getPage(0).setCropBox(0,100,100,100);const data=await pdf.save();writeFileSync(join(f.publicRoot,entry.solution.pdf),data);entry.solution.pdfSha256=sha256(data);entry.files[0].sha256=sha256(data);}
    if(kind==="png-geometry"){const png=new Resvg('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>').render().asPng();writeFileSync(join(f.publicRoot,f.files[1].path),png);}
    if(kind==="missing-file")entry.solution.views[0].preview="bank/assets/missing.png";
    if(kind==="file-manifest")entry.files[1].sha256="0".repeat(64);
    if(kind==="review")entry.evidence.reviewRecordSha256="bad";
    if(kind==="duplicate")f.batch.registrations.push(structuredClone(entry));
    if(kind==="conflict")writeFileSync(f.cataloguePath,JSON.stringify({...f.catalogue,questions:[{...f.catalogue.questions[0],workedSolution:{...f.solution,revision:"other"}}]}));
    writeFileSync(f.batchPath,JSON.stringify(f.batch));
    await expect(stageWorkedSolutions(f)).rejects.toThrow();expect(existsSync(f.output)).toBe(false);
  });
  it("guards a catalogue rebuild against silent attachment loss or a changed question",async()=>{
    const f=await fixture();await stageWorkedSolutions(f);
    const proposed=join(f.root,"rebuilt.json");writeFileSync(proposed,JSON.stringify(f.catalogue));
    const receipt=await stageWorkedSolutions({...f,cataloguePath:join(f.output,"public/bank/catalogue.json"),proposedCataloguePath:proposed,output:join(f.root,"rebuilt")});
    expect(receipt.registrations[0].action).toBe("unchanged");
    f.catalogue.questions[0].revision="changed";writeFileSync(proposed,JSON.stringify(f.catalogue));
    await expect(stageWorkedSolutions({...f,cataloguePath:join(f.output,"public/bank/catalogue.json"),proposedCataloguePath:proposed,output:join(f.root,"bad-rebuild")})).rejects.toThrow();
  });
});
