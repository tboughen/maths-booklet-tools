import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Blob as NodeBlob } from "node:buffer";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFArray, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { makePapers } from "./export";
import { auditPaperPdf } from "../../packages/resource-core/src/pdf-audit";
import { exportSelection, verifyCatalogue } from "./model";
vi.mock("./pdf",()=>({assetUrl:(p:string)=>p}));
const root=path.resolve(process.cwd());
const catalogue=verifyCatalogue(JSON.parse(await readFile("public/bank/catalogue.json","utf8")));
beforeEach(()=>{
  vi.stubGlobal("Blob",NodeBlob);
  vi.stubGlobal("fetch",vi.fn(async(p:string)=>{const bytes=await readFile(path.join("public",p));return{ok:true,arrayBuffer:async()=>new Uint8Array(bytes).buffer};}));
});
afterEach(()=>vi.unstubAllGlobals());
describe("native PDF export and reviewed assets",()=>{
  it("generates one question and aligned scheme when both crossover appearances were requested",async()=>{
    const ids=["1MA1_NOV_2019_1F_Q23","1MA1_NOV_2019_1H_Q4"];
    const selection=exportSelection(catalogue,ids);
    for(const preset of ["compact","writing"] as const){
      const result=await makePapers(selection.questions,catalogue.version,preset,()=>undefined);
      expect(result.questionCount).toBe(1);
      expect(result.marks).toBe(2);
      const question=await PDFDocument.load(new Uint8Array(await result.questions.arrayBuffer()));
      const scheme=await PDFDocument.load(new Uint8Array(await result.schemes.arrayBuffer()));
      expect(question.getPageCount()).toBe(1);
      expect(scheme.getPageCount()).toBe(1);
      const dir=process.env.CROSSOVER_EXPORT_DIR;
      if(dir){
        await mkdir(dir,{recursive:true});
        await writeFile(path.join(dir,`${preset}-questions.pdf`),new Uint8Array(await result.questions.arrayBuffer()));
        await writeFile(path.join(dir,`${preset}-mark-schemes.pdf`),new Uint8Array(await result.schemes.arrayBuffer()));
      }
    }
  });
  it("prints only the chosen parts with the stem and earlier part they need",async()=>{
    const stemmed=catalogue.questions.find(q=>q.id==="1MA1_JUN_2017_1F_Q14")!,needing=catalogue.questions.find(q=>q.id==="1MA1_JUN_2018_2H_Q5")!;
    const marks=(q:typeof needing,labels:string[])=>q.parts.filter(p=>labels.includes(p.label)).reduce((n,p)=>n+p.marks,0);
    for(const preset of ["compact","writing"] as const){
      const result=await makePapers([stemmed,needing],catalogue.version,preset,()=>undefined,undefined,{[stemmed.id]:["14b"],[needing.id]:["c"]});
      expect(result.marks).toBe(marks(stemmed,["14b"])+marks(needing,["b","c"]));
      const pdf=await PDFDocument.load(new Uint8Array(await result.questions.arrayBuffer()));
      expect(pdf.getSubject()).toContain(`${result.marks} marks`);
      // A cut follows on under the one before it when it fits (Q5 (b) and (c)); one too tall for the rest
      // of the page (Q14 (b) under its stem) starts a new page under a "continued" heading, at full size.
      const one=`${stemmed.source} (b) | 1 mark`;
      expect(marks(stemmed,["14b"])).toBe(1);
      expect(result.headings).toEqual([`1. ${one}`,`1 (continued). ${one}`,`2. ${needing.source} (b) and (c) | ${marks(needing,["b","c"])} marks`]);
      const scheme=await PDFDocument.load(new Uint8Array(await result.schemes.arrayBuffer()));
      expect(scheme.getPageCount()).toBeGreaterThanOrEqual(2);
    }
  });
  it("supports writing space and keeps the scale drawing at a 1:1 matrix",async()=>{
    const question=catalogue.questions.find(q=>q.id==="1MA1_NOV_2019_1H_Q8")!;
    const result=await makePapers([question],catalogue.version,"writing",()=>undefined);
    const pdf=await PDFDocument.load(new Uint8Array(await result.questions.arrayBuffer()));
    expect(pdf.getPageCount()).toBe(2);
    const streams=pdf.getPage(0).node.Contents() as PDFArray;
    const raw=Array.from({length:streams.size()},(_,i)=>new TextDecoder().decode(decodePDFRawStream(streams.lookup(i,PDFRawStream)).decode())).join("\n");
    const matrices=[...raw.matchAll(/([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) cm/g)].map(m=>m.slice(1,5).map(Number));
    expect(matrices.length).toBeGreaterThan(0);
    expect(matrices.every(m=>m.join(",")==="1,0,0,1")).toBe(true);
    expect(raw).toContain(`${250+50*72/25.4} 37 l`);
    const dir=path.join(root,"coverage/bank-exports");
    await mkdir(dir,{recursive:true});
    await writeFile(path.join(dir,"scale-writing-check.pdf"),new Uint8Array(await result.questions.arrayBuffer()));
  });
  it("produces no partial result after cancellation or a missing source",async()=>{
    const controller=new AbortController();controller.abort();
    await expect(makePapers(catalogue.questions,catalogue.version,"compact",()=>undefined,controller.signal)).rejects.toThrow("cancelled");
    vi.stubGlobal("fetch",vi.fn(async()=>({ok:false})));
    await expect(makePapers([catalogue.questions[0]],catalogue.version,"compact",()=>undefined)).rejects.toThrow("No incomplete paper");
  });
  it("prints an explicit source erratum alongside the reconciled mark allocation",async()=>{
    const original=catalogue.questions[0];
    const question={...original,sourceErrata:[{note:`Source correction: use ${original.marks} marks, as awarded in the mark scheme.`}]};
    const result=await makePapers([question],catalogue.version,"compact",()=>undefined);
    expect(result.marks).toBe(original.marks);
    const pdf=await PDFDocument.load(new Uint8Array(await result.questions.arrayBuffer()));
    const streams=pdf.getPage(0).node.Contents() as PDFArray;
    const raw=Array.from({length:streams.size()},(_,i)=>new TextDecoder().decode(decodePDFRawStream(streams.lookup(i,PDFRawStream)).decode())).join("\n");
    expect(raw).toContain(Buffer.from("Source correction:").toString("hex").toUpperCase());
  });
  it("rejects a scale drawing that would overlap the heading or calibration footer",async()=>{
    const source=await PDFDocument.create();source.addPage([500,760]);
    const bytes=await source.save();
    vi.stubGlobal("fetch",vi.fn(async()=>({ok:true,arrayBuffer:async()=>new Uint8Array(bytes).buffer})));
    const question={...catalogue.questions[0],scaleSensitive:true};
    await expect(makePapers([question],catalogue.version,"compact",()=>undefined)).rejects.toThrow("does not fit A4");
  });
  it("checks both papers after saving: pages, sizes, vector pages and headings in order (L23)",async()=>{
    const source=await PDFDocument.create();source.addPage([400,300]).drawRectangle({x:10,y:10,width:50,height:50});
    const bytes=await source.save();
    vi.stubGlobal("fetch",vi.fn(async()=>({ok:true,arrayBuffer:async()=>new Uint8Array(bytes).buffer})));
    const questions=catalogue.questions.filter(q=>!q.scaleSensitive).slice(0,3);
    const result=await makePapers(questions,catalogue.version,"compact",()=>undefined);
    const read=async(blob:Blob)=>new Uint8Array(await blob.arrayBuffer());
    const q=await read(result.questions),m=await read(result.schemes);
    const marks=(n:number)=>`${n} mark${n===1?"":"s"}`;
    const headings=questions.map((x,i)=>`${i+1}. ${x.source.replace(/[–—]/g,"-").replace(/·/g,"|").replace(/[^\x20-\x7E]/g," ")}`);
    expect(await auditPaperPdf(q,{pages:(await PDFDocument.load(q)).getPageCount(),widthMm:210,heightMm:297,headings:headings.map((h,i)=>`${h} | ${marks(questions[i].marks)}`)})).toEqual([]);
    expect(await auditPaperPdf(m,{pages:3,widthMm:297,heightMm:210,headings:headings.map((h,i)=>`${h} | Mark scheme | ${marks(questions[i].marks)}`)})).toEqual([]);
    // The papers are checked against each other's headings too: a mark-scheme heading is not on the questions PDF.
    expect(await auditPaperPdf(q,{pages:(await PDFDocument.load(q)).getPageCount(),widthMm:210,heightMm:297,headings:[`${headings[0]} | Mark scheme`]})).toHaveLength(1);
  });
  it("puts a replacement scheme's source note in the teacher PDF only",async()=>{
    const note="The original scheme omits this question. This is the verified common-question scheme.";
    const result=await makePapers([{...catalogue.questions[0],schemeSourceNote:note}],catalogue.version,"compact",()=>undefined);
    const raw=async(blob:Blob)=>{
      const pdf=await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()));
      const streams=pdf.getPage(0).node.Contents() as PDFArray;
      return Array.from({length:streams.size()},(_,i)=>new TextDecoder().decode(decodePDFRawStream(streams.lookup(i,PDFRawStream)).decode())).join("\n");
    };
    const marker=Buffer.from("The original scheme").toString("hex").toUpperCase();
    expect(await raw(result.schemes)).toContain(marker);
    expect(await raw(result.questions)).not.toContain(marker);
  });
});
