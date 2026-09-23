import { PDFDocument, StandardFonts, PrintScaling, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { assetUrl } from "./pdf";
import type { BankQuestion } from "./model";

export interface ExportProgress { done: number; total: number; message: string; }
export interface ExportResult { questions: Blob; schemes: Blob; questionCount: number; marks: number; version: string; }

const plain = (text: string) => text.replace(/[–—]/g, "-").replace(/·/g, "|").replace(/[^\x20-\x7E]/g, " ");
const A4: [number, number] = [595.276, 841.89];
const LANDSCAPE: [number, number] = [841.89, 595.276];

function footer(page: PDFPage, number: number, font: PDFFont, version: string) {
  page.drawText(`Maths question bank | ${plain(version)} | ${number}`, {x: 24, y: 12, font, size: 8, color: rgb(.35,.4,.46)});
}

function noteLines(notes: {note:string}[] | undefined, font: PDFFont, width: number): string[] {
  const lines: string[] = [];
  for (const note of notes || []) {
    let line = "";
    for (const word of plain(note.note).split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(candidate, 8) > width) {lines.push(line); line = word;}
      else line = candidate;
    }
    if (line) lines.push(line);
  }
  return lines;
}

function abortIfNeeded(signal?: AbortSignal) { if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError"); }

async function fetchPdf(path: string, signal?: AbortSignal): Promise<Uint8Array> {
  const response = await fetch(assetUrl(path), {signal});
  if (!response.ok) throw new Error("A question or mark scheme could not be loaded. No incomplete paper has been produced.");
  return new Uint8Array(await response.arrayBuffer());
}

export async function makePapers(questions: BankQuestion[], version: string, preset: "compact" | "writing", onProgress: (progress: ExportProgress) => void, signal?: AbortSignal): Promise<ExportResult> {
  const snapshots = [...questions];
  if (!snapshots.length || new Set(snapshots.map(q => q.id)).size !== snapshots.length) throw new Error("The export must contain distinct questions.");
  const student = await PDFDocument.create(); const scheme = await PDFDocument.create();
  const sf = await student.embedFont(StandardFonts.Helvetica); const sb = await student.embedFont(StandardFonts.HelveticaBold);
  const mf = await scheme.embedFont(StandardFonts.Helvetica); const mb = await scheme.embedFont(StandardFonts.HelveticaBold);
  const marks = snapshots.reduce((n, q) => n + q.marks, 0);
  for (const [doc, name] of [[student, "Questions"], [scheme, "Mark schemes"]] as const) {
    doc.setTitle(`Maths question bank - ${name}`); doc.setSubject(`${snapshots.length} source questions, ${marks} mark${marks === 1 ? "" : "s"}. Catalogue ${version}.`);
    doc.setCreator("Maths Tools question bank"); doc.setLanguage("en-GB");
    doc.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
  }
  let studentPage: PDFPage | undefined;
  let sy = 0;
  const addStudent = () => {studentPage = student.addPage(A4); sy = A4[1] - 28; return studentPage;};
  for (let index = 0; index < snapshots.length; index++) {
    abortIfNeeded(signal);
    const q = snapshots[index];
    onProgress({done: index * 2, total: snapshots.length * 2, message: `Preparing question ${index + 1} of ${snapshots.length}`});
    // Print regions retain original scale and working grids. Compact uses the reviewed classroom views.
    const sourcePath = preset === "writing" || q.scaleSensitive ? q.printPdf : q.questionPdf;
    const questionPdf = await PDFDocument.load(await fetchPdf(sourcePath, signal));
    const pages = await student.embedPages(questionPdf.getPages());
    for (let p = 0; p < pages.length; p++) {
      abortIfNeeded(signal);
      const embedded = pages[p];
      const label = `${index + 1}${p ? " (continued)" : ""}. ${plain(q.source)} | ${q.marks} mark${q.marks === 1 ? "" : "s"}`;
      const notes = p === 0 ? noteLines(q.sourceErrata, sf, A4[0]-48) : [];
      const noteHeight = notes.length ? notes.length * 10 + 5 : 0;
      // Reserve the question heading and the footer/calibration area before
      // checking source scale. A new page cannot recover this reserved space.
      const availableHeight = A4[1] - 56 - (q.scaleSensitive ? 44 : 32) - noteHeight;
      const scale = q.scaleSensitive ? 1 : Math.min(1, (A4[0] - 48) / embedded.width, availableHeight / embedded.height);
      if (q.scaleSensitive && (embedded.width > A4[0] - 48 || embedded.height > availableHeight)) throw new Error(`The original scale of ${q.source} does not fit A4. Export this item separately from the source PDF.`);
      const h = embedded.height * scale;
      if (!studentPage || sy - h - 34 - noteHeight < 32 || preset === "writing") addStudent();
      studentPage!.drawText(label, {x: 24, y: sy - 11, size: 10, font: sb, color: rgb(.12,.22,.34)});
      sy -= 28;
      for (const note of notes) {
        studentPage!.drawText(note, {x:24, y:sy, size:8, font:sf, color:rgb(.35,.25,.1)});
        sy -= 10;
      }
      if (notes.length) sy -= 5;
      studentPage!.drawPage(embedded, {x: 24, y: sy - h, width: embedded.width * scale, height: h});
      sy -= h + 22;
      if (q.scaleSensitive) {
        studentPage!.drawText("Print at Actual size / 100%. Check this 5 cm line:", {x: 24, y: 34, size: 8, font: sf});
        studentPage!.drawLine({start: {x: 250,y: 37}, end: {x: 250 + 50 * 72 / 25.4,y: 37}, thickness: .7});
      }
    }
    if (preset === "writing") {
      let room = Math.max(100, Math.min(q.marks * 26, 208));
      if (sy - room < 42) addStudent();
      studentPage!.drawText(`Working space - question ${index + 1}`, {x: 24, y: sy - 8, size: 9, font: sf, color: rgb(.4,.45,.5)});
      sy -= 24; room -= 24;
      while (room >= 22) {studentPage!.drawLine({start: {x:24,y:sy}, end: {x:A4[0]-24,y:sy}, color: rgb(.83,.85,.88), thickness: .4}); sy -= 22; room -= 22;}
      sy -= 18;
    }
    abortIfNeeded(signal);
    onProgress({done: index * 2 + 1, total: snapshots.length * 2, message: `Preparing mark scheme ${index + 1} of ${snapshots.length}`});
    const markPdf = await PDFDocument.load(await fetchPdf(q.schemePdf, signal));
    const markPages = await scheme.embedPages(markPdf.getPages());
    for (let p = 0; p < markPages.length; p++) {
      const embedded = markPages[p]; const page = scheme.addPage(LANDSCAPE);
      const notes = q.schemeSourceNote ? noteLines([{note:q.schemeSourceNote}], mf, LANDSCAPE[0]-48) : [];
      const noteHeight = notes.length ? notes.length * 10 + 5 : 0;
      const scale = Math.min(1, (LANDSCAPE[0]-48)/embedded.width, (LANDSCAPE[1]-85-noteHeight)/embedded.height);
      page.drawText(`${index + 1}${p ? " (continued)" : ""}. ${plain(q.source)} | Mark scheme | ${q.marks} mark${q.marks === 1 ? "" : "s"}`, {x:24,y:LANDSCAPE[1]-30,font:mb,size:12,color:rgb(.12,.22,.34)});
      notes.forEach((note,i)=>page.drawText(note,{x:24,y:LANDSCAPE[1]-46-i*10,font:mf,size:8,color:rgb(.35,.25,.1)}));
      page.drawPage(embedded,{x:24,y:LANDSCAPE[1]-56-noteHeight-embedded.height*scale,width:embedded.width*scale,height:embedded.height*scale});
    }
  }
  for (const [index,page] of student.getPages().entries()) footer(page,index+1,sf,version);
  for (const [index,page] of scheme.getPages().entries()) footer(page,index+1,mf,version);
  abortIfNeeded(signal);
  onProgress({done:snapshots.length*2,total:snapshots.length*2,message:"Saving both PDFs"});
  const [qBytes,mBytes] = await Promise.all([student.save(),scheme.save()]);
  abortIfNeeded(signal);
  return {questions:new Blob([new Uint8Array(qBytes).buffer],{type:"application/pdf"}),schemes:new Blob([new Uint8Array(mBytes).buffer],{type:"application/pdf"}),questionCount:snapshots.length,marks,version};
}
