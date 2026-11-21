import { typesetForPrint } from "./typeset";
import { items as svgItems, countSpaces } from "./render";
import { cell, drawing, gap, items, LAST_PARAGRAPH, para, row, run, runs, stack, table, tw, writePackage, type DocxOptions, type WordCtx } from "./docx";
import { cardLayout, renderStarterRun, starterTooWide, slotBoxes, slotContent, STARTER, starterHeaderSvg, starterIconSvg, type StarterIssue } from "./starter-render";
import { isExtensionSlot, type StarterRun } from "./starter";
import { SIZE, styles } from "./style";

/**
 * Word (.docx) output for a run of silent starters: one A4 portrait page per starter, holding two
 * copies of its A5 card and a dashed cut line, at the same sizes as the PDF.
 *
 * - The header (title, run tracker, topic, logo) is a picture, so it prints exactly as on the PDF.
 * - The cards are one table with exact row heights: a shaded header strip (number, instruction,
 *   EXTENSION) over a cell holding the items as editable Word text, tables, equations and diagrams.
 * - Spare height goes to working spaces, measured by the SVG layout, so Word matches the PDF.
 */
export interface RenderedStarterDocx {
  bytes: Uint8Array;
  issues: StarterIssue[];
}
type Where = { starter: number; question?: number };

const S = STARTER;
const W = S.card.width - 2 * S.margin;
/** Space before the first copy, as on the PDF sheet: the cards are centred in each half of the A4. */
const SHEET_GAP = (S.sheet.height / 2 - S.card.height) / 2;

/** A picture paragraph exactly `height` tall (pictures otherwise take auto line spacing). */
const exactPicture = (xml: string, height: number, align: "center" | "right" = "center") =>
  xml.replace(/w:line="240" w:lineRule="auto"/, `w:line="${tw(height)}" w:lineRule="exact"`).replace('<w:jc w:val="center"/>', align === "center" ? '<w:jc w:val="center"/>' : '<w:jc w:val="right"/>');

/** A card's header strip as one Word paragraph: number and instruction, with EXTENSION at a right tab. */
function stripCell(run_: StarterRun, starter: number, slot: number, ctx: WordCtx<Where>): string {
  const doc = run_.document;
  const card = doc.starters[starter].cards[slot];
  const box = slotBoxes(doc.template)[slot];
  const ext = isExtensionSlot(doc.template, slot);
  const ink = ext ? "#ffffff" : styles.mathsdock.navy;
  const title = cardLayout(doc.template, slot, card, !!ctx.maths).stripTitle;
  let content = run(String(slot + 1), { bold: true, color: ink, sizeMm: S.numberSize });
  if (title) content += run("  ", { sizeMm: SIZE.body }) + runs(title, { bold: true, color: ink, sizeMm: SIZE.body }, "bold", ctx.maths);
  if (ext) content += `<w:r><w:tab/></w:r>` + run("EXTENSION", { bold: true, color: "#ffffff", sizeMm: S.tagSize });
  const tab = `<w:tabs><w:tab w:val="right" w:pos="${tw(box.w - 2 * S.padX)}"/></w:tabs>`;
  return para(content, { line: S.strip }).replace("<w:pPr>", `<w:pPr>${tab}`);
}

function slotCell(run_: StarterRun, starter: number, slot: number, ctx: WordCtx<Where>): string {
  const doc = run_.document;
  const card = doc.starters[starter].cards[slot];
  const icon = doc.slots[slot]?.icon ?? "none";
  const place = slotContent(doc.template, slot, icon);
  ctx.where = { starter: starter + 1, question: slot + 1 };
  // The same spare-height share as the SVG layout, so working spaces match the PDF.
  const quiet = { ...ctx, issues: [], diagrams: 0, inline: undefined };
  const list = cardLayout(doc.template, slot, card, !!ctx.maths).items;
  const natural = svgItems(list, place.w, quiet, 0).h;
  const spare = place.height - natural;
  const spaces = countSpaces(list);
  const extra = spare > 0 && spaces ? spare / spaces : 0;
  const used = natural + extra * spaces;
  const parts: string[] = [gap(S.padTop)];
  const blocks = items(list, place.w, 0, ctx, extra);
  if (blocks.length) parts.push(stack(blocks, SIZE.itemGap));
  const room = Math.max(0.36, place.height - used);
  if (icon !== "none") {
    // The icon picture has half a millimetre round it so its frame is never clipped; its line takes the picture's height.
    // Placed as on the PDF: frame top 1.5 mm below the question area, frame right edge 0.5 mm into the padding.
    parts.push(gap(Math.max(0.36, room + 1.0)));
    parts.push(drawing({ svg: starterIconSvg(icon), widthMm: S.icon + 1, heightMm: S.icon + 1 }, place.w, 0, ctx).replace('<w:jc w:val="center"/>', `<w:ind w:right="${-tw(1)}"/><w:jc w:val="right"/>`));
  } else parts.push(gap(0.36));
  return parts.join("");
}

/**
 * The cards as one table: card columns with narrow gap columns between, and for each row of cards a
 * header-strip row and a body row, then a gap row. Word has no rounded corners, so the frames are square.
 */
function grid(run_: StarterRun, starter: number, ctx: WordCtx<Where>): string {
  const doc = run_.document;
  const boxes = slotBoxes(doc.template);
  const cols = doc.template === "four" ? 2 : 3;
  const cw = boxes[0].w;
  const widths = Array.from({ length: cols * 2 - 1 }, (_, k) => (k % 2 ? S.cardGap : cw));
  const spacer = (w: number) => cell(gap(0.36), { width: w });
  const rows: string[] = [];
  for (let r = 0; r < 2; r++) {
    const slot = (c: number) => r * cols + c;
    const edge = (c: number) => (isExtensionSlot(doc.template, slot(c)) ? { color: styles.mathsdock.navy, width: 0.5 } : { color: S.colours.edge, width: 0.35 });
    const fill = (c: number) => (isExtensionSlot(doc.template, slot(c)) ? styles.mathsdock.navy : S.colours.pale);
    const line = (make: (c: number) => string) => widths.map((w, k) => (k % 2 ? spacer(w) : make(k / 2)));
    rows.push(row(line((c) => cell(stripCell(run_, starter, slot(c), ctx), { width: cw, shade: fill(c), borders: { top: edge(c), left: edge(c), right: edge(c) }, margin: { top: 0, bottom: 0, left: S.padX, right: S.padX } })), { mm: S.strip, exact: true }));
    rows.push(row(line((c) => cell(slotCell(run_, starter, slot(c), ctx), { width: cw, borders: { left: edge(c), right: edge(c), bottom: edge(c) }, margin: { top: 0, bottom: 0, left: S.padX, right: S.padX } })), { mm: boxes[0].h - S.strip, exact: true }));
    if (r === 0) rows.push(row(widths.map((w) => spacer(w)), { mm: S.cardGap, exact: true }));
  }
  return table(widths, rows);
}

function copy(run_: StarterRun, starter: number, ctx: WordCtx<Where>, issues: StarterIssue[]): string {
  const header = exactPicture(drawing({ svg: starterHeaderSvg(run_, starter + 1, issues), widthMm: W, heightMm: S.header }, W, 0, ctx), S.header);
  return header + gap(S.headerGap) + grid(run_, starter, ctx);
}

/** The dashed cut line across the whole sheet, halfway down, with the gap the PDF leaves around it. */
function cutGap(): string {
  const half = S.margin + SHEET_GAP;
  const line = `<w:p><w:pPr><w:pBdr><w:bottom w:val="dashed" w:sz="4" w:space="0" w:color="8A8A8A"/></w:pBdr><w:spacing w:before="0" w:after="0" w:line="${tw(half)}" w:lineRule="exact"/><w:ind w:left="${-tw(S.margin)}" w:right="${-tw(S.margin)}"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr></w:p>`;
  return line + gap(half);
}

/** The Word file for one view of a run: one A4 page per starter (or just `only`, 1-based). */
export async function writeStarterDocx(saved: StarterRun, options: DocxOptions & { only?: number }): Promise<RenderedStarterDocx> {
  const run_ = typesetForPrint(saved);
  const doc = run_.document;
  const view = options.view ?? "pupil";
  // The PDF layout's checks come first: Word never hides a problem the cards have.
  const issues = [...renderStarterRun(run_, { view }).issues];
  const ctx: WordCtx<Where> = { st: styles.mathsdock, view, diagrams: 0, issues: [], where: { starter: 1 }, media: [], rels: [], pictures: [], maths: doc.notation === "maths" };
  ctx.tooWide = starterTooWide(ctx);
  const which = options.only ? [options.only - 1] : doc.starters.map((_, i) => i);
  // Each page after the first starts at its first header, so nothing on it sits lower than on page 1.
  const breakBefore = (xml: string) => xml.replace("<w:pPr>", "<w:pPr><w:pageBreakBefore/>");
  const pages = which.map((i, k) => (k ? breakBefore(copy(run_, i, ctx, [])) : copy(run_, i, ctx, [])) + cutGap() + copy(run_, i, ctx, []));
  const key = (i: StarterIssue) => `${i.starter}|${i.question ?? ""}|${i.message}`;
  for (const i of ctx.issues) if (!issues.some((j) => key(j) === key(i))) issues.push(i);
  const P = S.sheet;
  const sect =
    `<w:sectPr><w:pgSz w:w="${tw(P.width)}" w:h="${tw(P.height)}"/>` +
    `<w:pgMar w:top="${tw(SHEET_GAP + S.margin)}" w:right="${tw(S.margin)}" w:bottom="${tw(3)}" w:left="${tw(S.margin)}" w:header="0" w:footer="0" w:gutter="0"/><w:cols w:space="0"/><w:docGrid w:linePitch="360"/></w:sectPr>`;
  const bytes = await writePackage({
    body: `${pages.join("")}${LAST_PARAGRAPH}${sect}`,
    ctx,
    options,
    title: `${doc.title}, silent starters${view === "answers" ? " (answers)" : ""}`,
    subject: doc.topic,
    keywords: ["MathsDock silent starters", doc.group, view === "answers" ? "answers" : "pupil"].filter(Boolean).join("; "),
    description: "Made by MathsDock from the silent starter source. Edit the source and remake this file to keep the pupil and answer copies in step.",
    pages: which.length,
  });
  return { bytes, issues };
}
