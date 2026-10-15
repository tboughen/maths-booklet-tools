import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, PDFName } from 'pdf-lib';
import { makePapers } from '../src/bank/export';
import { verifyCatalogue } from '../src/bank/model';
vi.mock('../src/bank/pdf',()=>({assetUrl:(p:string)=>p}));
const root=path.resolve(process.cwd());
const catalogue=verifyCatalogue(JSON.parse(await readFile('public/bank/catalogue.json','utf8')));
beforeEach(()=>{vi.stubGlobal('Blob',NodeBlob);vi.stubGlobal('fetch',vi.fn(async(p:string)=>{const bytes=await readFile(path.join('public',p));return{ok:true,arrayBuffer:async()=>new Uint8Array(bytes).buffer};}));});
afterEach(()=>vi.unstubAllGlobals());
describe('complete released catalogue integration',()=>{
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
  },300000);
});
