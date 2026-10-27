import { createHash } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { PDFDocument, PDFName } from "pdf-lib";
import { validateWorkedSolution, type WorkedSolution } from "../../workedSolution.ts";

export const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
export interface CheckedSolutionFile { path: string; sha256: string; bytes: number; data: Buffer; }

export async function verifySolutionFiles(publicRoot: string, solution: WorkedSolution, questionRevision: string): Promise<CheckedSolutionFile[]> {
  validateWorkedSolution(solution, questionRevision);
  const root = realpathSync(publicRoot);
  const files = [...new Set([solution.pdf, ...solution.views.map(v => v.preview)])].map(path => {
    const absolute = realpathSync(resolve(root, path));
    if (!absolute.startsWith(root + sep) || !statSync(absolute).isFile()) throw new Error(`Solution asset escapes public directory: ${path}`);
    const data = readFileSync(absolute);
    return { path, sha256: sha256(data), bytes: data.length, data };
  });
  const pdfFile = files.find(f => f.path === solution.pdf)!;
  if (pdfFile.sha256 !== solution.pdfSha256) throw new Error("Worked solution PDF hash differs from its registration.");
  const pdf = await PDFDocument.load(pdfFile.data);
  if (pdf.getPageCount() !== solution.views.length) throw new Error("Worked solution PDF page count differs from its views.");
  const pngReader = await PDFDocument.create();
  for (const [index, view] of solution.views.entries()) {
    const page = pdf.getPage(index);
    const media = page.getMediaBox(), crop = page.getCropBox();
    if (page.getRotation().angle !== 0 || (page.node.get(PDFName.of("UserUnit"))?.toString() || "1") !== "1"
        || (Object.keys(media) as (keyof typeof media)[]).some(key => Math.abs(media[key]-crop[key]) > .01)
        || Math.abs(page.getWidth() - view.width) > .01 || Math.abs(page.getHeight() - view.height) > .01) throw new Error("Worked solution PDF page geometry differs from its views or crops the full page.");
    const image = await pngReader.embedPng(files.find(f => f.path === view.preview)!.data);
    // A native renderer rounds each pixel axis upwards independently. For a
    // short, wide question, <1px of height rounding can exceed 1.1px horizontally.
    // Accept that case only when both integer dimensions admit ONE uniform scale.
    const nativePixelRounding = solution.layout === "individual-question"
      && Math.max((image.width - 1) / view.width, (image.height - 1) / view.height)
        <= Math.min(image.width / view.width, image.height / view.height) + 1e-9;
    if (Math.abs(image.width - image.height * view.width / view.height) > 1.1 && !nativePixelRounding) throw new Error("Worked solution PNG geometry differs from its PDF page.");
  }
  return files;
}

export async function verifyCatalogueSolutionFiles(publicRoot: string, catalogue: { questions: { revision?: string; workedSolution?: WorkedSolution }[] }): Promise<void> {
  for (const question of catalogue.questions) {
    if (question.workedSolution !== undefined) await verifySolutionFiles(publicRoot, question.workedSolution, question.revision || "");
  }
}
