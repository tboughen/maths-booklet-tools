import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Blob as NodeBlob } from "node:buffer";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFName, PDFArray, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { makePapers } from "./export";
import { verifyCatalogue } from "./model";
vi.mock("./pdf",()=>({assetUrl:(p:string)=>p}));
const root=path.resolve(process.cwd());
const catalogue=verifyCatalogue(JSON.parse(await readFile("public/bank/catalogue.json","utf8")));
beforeEach(()=>{
  vi.stubGlobal("Blob",NodeBlob);
  vi.stubGlobal("fetch",vi.fn(async(p:string)=>{const bytes=await readFile(path.join("public",p));return{ok:true,arrayBuffer:async()=>new Uint8Array(bytes).buffer};}));
});
afterEach(()=>vi.unstubAllGlobals());
describe("native PDF export and reviewed assets",()=>{
  it("exports the complete released catalogue in both layouts with aligned answers and full marks",async()=>{
    expect(catalogue.questions).toHaveLength(catalogue.scope.publishedQuestions);
    const dir=process.env.BANK_EXPORT_DIR||path.join(root,"coverage/bank-exports",catalogue.version);
    await mkdir(dir,{recursive:true});
    const evidence=[];
    for(const preset of ["compact","writing"] as const){
      const result=await makePapers(catalogue.questions,catalogue.version,preset,()=>undefined);
      expect(result.questionCount).toBe(catalogue.questions.length);
      expect(result.marks).toBe(catalogue.questions.reduce((n,q)=>n+q.marks,0));
      const qbytes=new Uint8Array(await result.questions.arrayBuffer());
      const mbytes=new Uint8Array(await result.schemes.arrayBuffer());
      const q=await PDFDocument.load(qbytes);
      const m=await PDFDocument.load(mbytes);
      expect(q.getPageCount()).toBeGreaterThan(0);
      expect(m.getPageCount()).toBe(catalogue.questions.reduce((n,q)=>n+q.schemeViews.length,0));
      expect(q.catalog.getOrCreateViewerPreferences().getPrintScaling()).toBe("None");
      expect(q.getPages().every(p=>p.node.Resources()?.has(PDFName.of("XObject")))).toBe(true);
      await writeFile(path.join(dir,`${preset}-questions.pdf`),qbytes);
      await writeFile(path.join(dir,`${preset}-mark-schemes.pdf`),mbytes);
      evidence.push({preset,questionCount:result.questionCount,marks:result.marks,questionPages:q.getPageCount(),schemePages:m.getPageCount(),questionOrder:catalogue.questions.map(q=>q.id)});
    }
    await writeFile(path.join(dir,"checks.json"),JSON.stringify({version:catalogue.version,exports:evidence},null,2));
  },60000);
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
