import { typesetForPrint } from "./typeset";
import { items as svgItems, countSpaces } from "./render";
import { cell, drawing, gap, items, LAST_PARAGRAPH, para, row, run, runs, stack, table, tw, writePackage, type DocxOptions, type WordCtx } from "./docx";
import { renderStarterRun, slotBoxes, slotContent, STARTER, starterHeaderSvg, starterIconSvg, withoutDiagramBackground, type StarterIssue } from "./starter-render";
import { isExtensionSlot, type StarterRun } from "./starter";
import { SIZE, styles } from "./style";

/**
 * Word (.docx) output for a run of silent starters: one A4 portrait page per starter, holding two
 * copies of its A5 card and a dashed cut line, at the same sizes as the PDF.
 *
 * - The header (title, run tracker, topic, logo) is a picture, so it prints exactly as on the PDF.
 * - The slots are one table with exact row heights; each slot is a cell holding the question's
 *   number, instruction and items as editable Word text, tables, equations and diagrams.
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

function band(width: number): string {
  const size = 9 * 0.3528;
  return table(
    [width],
    [row([cell(para(run("EXTENSION", { bold: true, color: "#ffffff", sizeMm: size }), { align: "center", line: SIZE.body * SIZE.lineHeight }), { width, shade: "#000000", vAlign: "center" })], { mm: S.extensionBand, exact: true })],
  );
}

function slotCell(run_: StarterRun, starter: number, slot: number, ctx: WordCtx<Where>): string {
  const doc = run_.document;
  const card = doc.starters[starter].cards[slot];
  const icon = doc.slots[slot]?.icon ?? "none";
  const place = slotContent(doc.template, slot, icon);
  const ext = isExtensionSlot(doc.template, slot);
  ctx.where = { starter: starter + 1, question: slot + 1 };
  // The same spare-height share as the SVG layout, so working spaces match the PDF.
  const quiet = { ...ctx, issues: [], diagrams: 0, inline: undefined };
  const natural = svgItems(card.items, place.w, quiet, 0).h;
  const spare = place.height - natural;
  const spaces = countSpaces(card.items);
  const extra = spare > 0 && spaces ? spare / spaces : 0;
  const used = natural + extra * spaces;
  const firstPicture = ctx.pictures.length;
  const label = run(`${slot + 1})`, { bold: true, color: S.colours.number, sizeMm: S.numberSize });
  const title = card.title.trim() ? run(" ", { sizeMm: SIZE.body }) + runs(card.title, { bold: true, color: "#000000", sizeMm: SIZE.body }, "bold", ctx.maths) : "";
  const parts: string[] = [];
  if (place.band) parts.push(band(place.box.w));
  parts.push(gap(S.padTop), para(label + title, { line: place.numberLine }), gap(SIZE.itemGap));
  const blocks = items(card.items, place.w, 0, ctx, extra);
  if (blocks.length) parts.push(stack(blocks, SIZE.itemGap));
  if (ext) for (const p of ctx.pictures.slice(firstPicture)) p.svg = withoutDiagramBackground(p.svg);
  const room = Math.max(0.36, place.height - used);
  if (icon !== "none") {
    // The icon picture has half a millimetre round it so its frame is never clipped; its line takes the picture's height.
    parts.push(gap(Math.max(0.36, room + 1.5 - 1.2)));
    parts.push(drawing({ svg: starterIconSvg(icon), widthMm: S.icon + 1, heightMm: S.icon + 1 }, place.w, 0, ctx).replace('<w:jc w:val="center"/>', '<w:jc w:val="right"/>'));
  } else parts.push(gap(0.36));
  return parts.join("");
}

function grid(run_: StarterRun, starter: number, ctx: WordCtx<Where>): string {
  const doc = run_.document;
  const boxes = slotBoxes(doc.template);
  const cols = doc.template === "four" ? 2 : 3;
  const widths = Array.from({ length: cols }, () => W / cols);
  const thin = { color: "#000000", width: S.slotRule };
  const thick = { color: "#000000", width: S.extensionRule };
  // Slot index for (row, column): four go in reading order, six down the columns.
  const index = (r: number, c: number) => (cols === 2 ? r * 2 + c : c * 2 + r);
  const rows = [0, 1].map((r) =>
    row(
      Array.from({ length: cols }, (_, c) => {
        const i = index(r, c);
        const ext = isExtensionSlot(doc.template, i);
        const right = c < cols - 1 ? (doc.template === "core-extension" && c === 1 ? thick : thin) : undefined;
        return cell(slotCell(run_, starter, i, ctx), {
          width: widths[c],
          borders: { ...(right ? { right } : {}), ...(r === 0 ? { bottom: thin } : {}) },
          shade: ext ? S.colours.tint : undefined,
          margin: { top: 0, bottom: 0, left: S.padX, right: S.padX },
        });
      }),
      { mm: boxes[0].h, exact: true },
    ),
  );
  return table(widths, rows);
}

function copy(run_: StarterRun, starter: number, ctx: WordCtx<Where>, issues: StarterIssue[]): string {
  const header = exactPicture(drawing({ svg: starterHeaderSvg(run_, starter + 1, issues), widthMm: W, heightMm: S.header }, W, 0, ctx), S.header);
  return header + grid(run_, starter, ctx);
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
  const which = options.only ? [options.only - 1] : doc.starters.map((_, i) => i);
  const pageBreak = `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="2"/></w:rPr><w:br w:type="page"/></w:r></w:p>`;
  const pages = which.map((i) => copy(run_, i, ctx, []) + cutGap() + copy(run_, i, ctx, []));
  for (const i of ctx.issues) if (!issues.some((j) => j.message === i.message)) issues.push(i);
  const P = S.sheet;
  const sect =
    `<w:sectPr><w:pgSz w:w="${tw(P.width)}" w:h="${tw(P.height)}"/>` +
    `<w:pgMar w:top="${tw(SHEET_GAP + S.margin)}" w:right="${tw(S.margin)}" w:bottom="${tw(3)}" w:left="${tw(S.margin)}" w:header="0" w:footer="0" w:gutter="0"/><w:cols w:space="0"/><w:docGrid w:linePitch="360"/></w:sectPr>`;
  const bytes = await writePackage({
    body: `${pages.join(pageBreak)}${LAST_PARAGRAPH}${sect}`,
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
