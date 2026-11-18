import { renderStarterRun, starterFileName, type StarterRun, type View } from "../../packages/resource-core/src/index";
import { downloadBlob } from "../export/clipboard";
import { pagesPdf } from "../worksheet/export";
import { DOCX_TYPE, wordKit } from "../export/word";

/** Downloads for a run of silent starters, written in the browser with the connector's writers. */
const refuse = (count: number) => {
  if (count) throw Error("Fix the layout checks before downloading: a question does not fit its slot yet.");
};

/** The A4 sheets (two cards each, with the cut line) as a vector PDF: every starter, or just `only` (1-based). */
export async function downloadStarterPdf(run: StarterRun, view: View, only?: number) {
  const r = renderStarterRun(run, { view });
  refuse(r.issues.filter((i) => !only || i.starter === only || i.starter === 0).length);
  const sheets = only ? [r.sheets[only - 1]] : r.sheets;
  downloadBlob(await pagesPdf(sheets, `${run.document.title}, silent starters`), starterFileName(run, view, only));
}

/** The Word file: one A4 page per starter with two copies of its card, or just `only` (1-based). */
export async function downloadStarterWord(run: StarterRun, view: View, only?: number) {
  const [{ writeStarterDocx }, kit] = await Promise.all([import("../../packages/resource-core/src/starter-docx"), wordKit()]);
  const r = await writeStarterDocx(run, { view, only, fonts: kit.fonts, picture: kit.picture, version: "MathsDock silent starter renderer, Word output 1" });
  refuse(r.issues.filter((i) => !only || i.starter === only || i.starter === 0).length);
  downloadBlob(new Blob([r.bytes as BlobPart], { type: DOCX_TYPE }), starterFileName(run, view, only, "docx"));
}

export const editableName = (run: StarterRun) => starterFileName(run).replace(/\.pdf$/, ".json");
export function downloadEditable(run: StarterRun) {
  downloadBlob(new Blob([JSON.stringify(run, null, 2)], { type: "application/json" }), editableName(run));
}
