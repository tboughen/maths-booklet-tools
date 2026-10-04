import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Blob as NodeBlob } from "node:buffer";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFArray, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { makePapers } from "./export";
import { verifyCatalogue, type BankQuestion } from "./model";
vi.mock("./pdf",()=>({assetUrl:(p:string)=>p}));
const catalogue=verifyCatalogue(JSON.parse(await readFile("public/bank/catalogue.json","utf8")));
const q=catalogue.questions.find(q=>q.id==="1MA1_NOV_2021_2H_Q5")!;
beforeEach(()=>{
  vi.stubGlobal("Blob",NodeBlob);
  vi.stubGlobal("fetch",vi.fn(async(p:string)=>{
    const bytes=await readFile(path.join("public",p));return {ok:true,arrayBuffer:async()=>new Uint8Array(bytes).buffer};
  }));
});
afterEach(()=>vi.unstubAllGlobals());
const pages=async(blob:Blob)=>(await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()))).getPageCount();
it("uses source working space once and preserves legacy generated space",async()=>{
  expect(q).toBeDefined();
  const source=await makePapers([{...q,writingSpacePolicy:"source"}],catalogue.version,"writing",()=>{});
  const legacy=await makePapers([q],catalogue.version,"writing",()=>{});
  const generated=await makePapers([{...q,writingSpacePolicy:"generated"}],catalogue.version,"writing",()=>{});
  const none=await makePapers([{...q,writingSpacePolicy:"none"}],catalogue.version,"writing",()=>{});
  expect(await pages(source.questions)).toBe(q.printPages.length);
  expect(await pages(legacy.questions)).toBe(q.printPages.length+1);
  expect(await pages(generated.questions)).toBe(await pages(legacy.questions));
  expect(await pages(none.questions)).toBe(await pages(source.questions));
  expect(await pages(source.schemes)).toBe(q.schemeViews.length);
});
it("keeps mixed writing policies independent and refuses unknown policy values",async()=>{
  const result=await makePapers([{...q,writingSpacePolicy:"source"},{...q,id:"GENERATED",writingSpacePolicy:"generated"}],catalogue.version,"writing",()=>{});
  expect(result.marks).toBe(q.marks*2);
  expect(await pages(result.questions)).toBe(3);
  expect(await pages(result.schemes)).toBe(q.schemeViews.length*2);
  expect(()=>verifyCatalogue({...catalogue,questions:[{...q,writingSpacePolicy:"invalid"} as unknown as BankQuestion]})).toThrow("writing-space policy");
});
it("preserves multipart pages and physical scale in a mixed-policy booklet",async()=>{
  const multi=catalogue.questions.find(item=>item.printPages.length>1)!;
  const physical=catalogue.questions.find(item=>item.id==="1MA1_NOV_2019_1H_Q8")!;
  expect(multi).toBeDefined();expect(physical.scaleSensitive).toBe(true);
  const selected:BankQuestion[]=[{...q,writingSpacePolicy:"source"},{...q,id:"GENERATED",writingSpacePolicy:"generated"},
    {...multi,writingSpacePolicy:"source"},{...physical,writingSpacePolicy:"source"}];
  const writing=await makePapers(selected,catalogue.version,"writing",()=>{});
  const compact=await makePapers(selected,catalogue.version,"compact",()=>{});
  expect(writing.marks).toBe(selected.reduce((total,item)=>total+item.marks,0));
  const pdf=await PDFDocument.load(new Uint8Array(await writing.questions.arrayBuffer()));
  expect(pdf.getPageCount()).toBe(selected.reduce((total,item)=>total+item.printPages.length,0)+1);
  const contents=pdf.getPage(pdf.getPageCount()-1).node.Contents() as PDFArray;
  const raw=Array.from({length:contents.size()},(_,index)=>new TextDecoder().decode(
    decodePDFRawStream(contents.lookup(index,PDFRawStream)).decode())).join("\n");
  const matrices=[...raw.matchAll(/([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) cm/g)]
    .map(match=>match.slice(1,5).map(Number));
  expect(matrices.length).toBeGreaterThan(0);expect(matrices.every(matrix=>matrix.join(",")==="1,0,0,1")).toBe(true);
  expect(await pages(writing.schemes)).toBe(selected.reduce((total,item)=>total+item.schemeViews.length,0));
  expect(await pages(compact.schemes)).toBe(await pages(writing.schemes));
});
