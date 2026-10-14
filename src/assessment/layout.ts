import type { BankQuestion } from "../bank/model";
import type { Practice } from "./types";

export const A4 = { width: 595.276, height: 841.89 };
export const MARGIN = 28, TOP = 80, BOTTOM = 30, WIDTH = A4.width - MARGIN * 2;
export interface Placement {
  page: number; y: number; height: number; entry: number; kind: "question" | "scheme" | "working";
  assetPage: number; width: number; artworkHeight: number; scale: number; path: string; headingHeight: number;
}
export interface Layout { pages: number; usedPages: number; placements: Placement[]; valid: boolean }
export const questionPath = (q: BankQuestion) => q.scaleSensitive || q.writingSpacePolicy === "source" ? q.printPdf : q.questionPdf;
export function splitHeading(value: string, length: number): string[] {
  const lines: string[] = []; let line = "";
  for (const word of value.split(/\s+/)) {
    if (line.length + word.length + 1 > length) { if (line) lines.push(line); line = ""; }
    let rest = word;
    while (rest.length > length) { lines.push(rest.slice(0, length)); rest = rest.slice(length); }
    line = line ? line + " " + rest : rest;
  }
  if (line) lines.push(line); return lines;
}
export function blockHeading(practice: Practice, entry: number, assetPage: number, scheme: boolean): { text: string; size: number; bold: boolean }[] {
  const q = practice.question, lines = [];
  const title = `${scheme ? "Answers " : ""}${entry + 1}. ${q.marks} marks${assetPage ? " (continued)" : ""} | ${q.source}`;
  for (const text of splitHeading(title, 60)) lines.push({ text, size: scheme ? 8 : 9, bold: true });
  for (const text of splitHeading(`Follow-up to ${practice.references.join(", ")} | Sparx ${practice.codes.join(", ")}`, 65)) lines.push({ text, size: scheme ? 7 : 8, bold: false });
  const notes = [...(q.sourceErrata || []).map(n => n.note), ...(scheme && q.schemeSourceNote ? [q.schemeSourceNote] : [])];
  for (const text of splitHeading(notes.join(" "), 70)) lines.push({ text, size: 7, bold: false });
  return lines;
}

/** The selector and renderer consume exactly the same point-based placements. */
export function layoutPack(entries: Practice[], limit: number | null): Layout {
  const placements: Placement[] = []; let page = 0, y = TOP, valid = true;
  const add = (block: Omit<Placement, "page" | "y">) => {
    if (!Number.isFinite(block.height) || block.height <= 0 || block.height > A4.height - TOP - BOTTOM) { valid = false; return; }
    if (y + block.height > A4.height - BOTTOM) { page++; y = TOP; }
    placements.push({ ...block, page, y }); y += block.height;
  };
  for (const [entry, practice] of entries.entries()) {
    const q = practice.question, source = questionPath(q) === q.printPdf;
    const views = source ? q.printPages : q.questionViews;
    if (!views.length || !q.schemeViews.length) { valid = false; continue; }
    for (const [assetPage, view] of views.entries()) {
      const scale = q.scaleSensitive ? 1 : Math.min(1, WIDTH / view.width);
      if (!Number.isFinite(scale) || view.width <= 0 || view.height <= 0 || scale < .8 || view.width * scale > WIDTH + .01) { valid = false; continue; }
      const artworkHeight = view.height * scale;
      const headingHeight = blockHeading(practice, entry, assetPage, false).reduce((n, line) => n + line.size + 2, 10);
      add({ entry, kind: "question", assetPage, width: view.width, artworkHeight, scale, path: questionPath(q), headingHeight, height: artworkHeight + headingHeight + 10 });
    }
    if (q.writingSpacePolicy === undefined || q.writingSpacePolicy === "generated") {
      const height = Math.min(160, Math.max(52, q.marks * 24));
      // Keep at least the first two writing lines with the final question region.
      const last = placements.at(-1);
      if (last?.entry === entry && last.kind === "question" && last.height + 52 < A4.height - TOP - BOTTOM && last.y + last.height + 52 > A4.height - BOTTOM) {
        page++; last.page = page; last.y = TOP; y = TOP + last.height;
      }
      add({ entry, kind: "working", assetPage: 0, width: WIDTH, artworkHeight: 0, scale: 1, path: "", height, headingHeight: 0 });
    }
  }
  // Schemes are compact but retain the entire source. No half-width table crops.
  // A conservative 2/3 floor keeps the wide original scheme rows readable.
  for (const [entry, practice] of entries.entries()) {
    for (const [assetPage, view] of practice.question.schemeViews.entries()) {
      const scale = Math.min(.72, WIDTH / view.width);
      if (!Number.isFinite(scale) || view.width <= 0 || view.height <= 0 || scale < .66) { valid = false; continue; }
      const artworkHeight = view.height * scale;
      const headingHeight = blockHeading(practice, entry, assetPage, true).reduce((n, line) => n + line.size + 2, 10);
      add({ entry, kind: "scheme", assetPage, width: view.width, artworkHeight, scale, path: practice.question.schemePdf, headingHeight, height: artworkHeight + headingHeight + 10 });
    }
  }
  const usedPages = entries.length ? page + 1 : 1;
  return { pages: limit ?? usedPages, usedPages, placements, valid: valid && (limit === null || usedPages <= limit) };
}
