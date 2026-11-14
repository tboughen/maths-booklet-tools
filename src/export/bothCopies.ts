/**
 * Pupil and answers copies in one download (improvement item U28). A teacher usually needs both:
 * the pupil copy for the sheet and the answers copy for slides or a mark scheme. This renders
 * each view on its own, so the editor's view and the saved document never change, and nothing is
 * revealed in the pupil files.
 */
import { zipSync } from "fflate";
import type { ToolId } from "../site/routes";
import { downloadBlob } from "./clipboard";
import { downloadName } from "./filenames";

export type CopyView = "pupil" | "answer";
/** One copy's print files: the portable SVG and its verified 600 ppi PNG. */
export interface CopyImages {
  svg: string;
  png: Blob;
}

export async function bothCopiesZip(tool: ToolId, resource: unknown, make: (view: CopyView) => Promise<CopyImages>) {
  const files: Record<string, Uint8Array> = {};
  for (const view of ["pupil", "answer"] as const) {
    const copy = await make(view),
      answers = view === "answer";
    files[downloadName(tool, "svg", { resource, answers })] = new TextEncoder().encode(copy.svg);
    files[downloadName(tool, "png", { resource, answers })] = new Uint8Array(await copy.png.arrayBuffer());
  }
  // PNGs are already compressed; level 0 keeps the ZIP fast.
  const zip = zipSync(files, { level: 0 });
  return new Blob([zip as Uint8Array<ArrayBuffer>], { type: "application/zip" });
}

export async function downloadBothCopies(tool: ToolId, resource: unknown, make: (view: CopyView) => Promise<CopyImages>) {
  downloadBlob(await bothCopiesZip(tool, resource, make), downloadName(tool, "zip", { resource }));
}
