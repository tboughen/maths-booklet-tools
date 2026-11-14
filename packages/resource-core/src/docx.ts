import { zipSync, strToU8 } from "fflate";
import { drawDiagram } from "../../diagram-core/src/registry";
import { answerNeed, card as measureCard, isReminder, columnBoxes, HEADER_RIGHT, overflowMessage, paperSvg, planColumn, renderResource, scoreBox, STAGE_BAND, stageLetters, tooWideMessage, type Ctx, type Issue, type View } from "./render";
import { diagramEnvelope, type Card, type Cell, type Diagram, type Item, type Leaf, type Resource } from "./schema";
import { SIZE, styles, type HouseStyle } from "./style";
import { ANSWER_SLOT_GAP, answerHasFraction, packAnswerLines, stubFits, FRAC_ANSWER_EXTRA, FRAC_CIRCLE_ROW, FRAC_TABLE_ROW, FRAC_FOOT, FRAC_LINE, fracStyle, stackAnswerText, hasFraction, lineWidth, parseRuns, plainWidth, wrap, type Run } from "./text";

/**
 * Word (.docx) output for the A3 worksheet, built from the same source and the same layout as the
 * SVG pages. The file is made so that it cannot reflow between computers:
 *
 * - each side is one fixed-layout table: header, stage headings, then one cell per strand column;
 * - each question card is a bordered table cell whose height is pinned (at least) to the height the
 *   SVG layout measured, with line breaks predicted from Inter's own advance widths at a slightly
 *   narrower width than Word has, so Word never needs more lines than the prediction;
 * - text lines have exact line spacing; working space, answer rows and table rows have exact heights;
 * - Inter is embedded in the file (obfuscated as Word requires), so the layout holds on a computer
 *   without Inter;
 * - diagrams are SVG pictures (text outlined) with a high-resolution PNG fallback, at printed size.
 *
 * Word grows a card rather than overlapping text when a teacher adds words, so an edit pushes
 * content down and never hides it. Nothing is shrunk to fit. docs/content/WORD-OUTPUT.md has the
 * evidence for each rule. This module has no Node or browser imports: the caller supplies the font
 * bytes and a function that turns a diagram's SVG into an outlined SVG plus a PNG.
 */

export interface DocxFonts {
  regular: Uint8Array;
  semiBold: Uint8Array;
  italic: Uint8Array;
}
/** A diagram ready for Word: SVG with its text as outlines, and a PNG of the same picture. */
export interface DocxPicture {
  svg: string;
  png: Uint8Array;
}
export type DocxPictureMaker = (svg: string, widthMm: number, heightMm: number) => DocxPicture | Promise<DocxPicture>;
export interface DocxOptions {
  view?: View;
  fonts: DocxFonts;
  picture: DocxPictureMaker;
  /** Saved in the file's properties, e.g. a source hash or the renderer version. */
  version?: string;
}
export interface RenderedDocx {
  bytes: Uint8Array;
  /** Layout problems; the file is still written so the problem can be seen. */
  issues: Issue[];
}

const S = SIZE;
/**
 * Word's text area in each card is this much wider than the width the layout measured, so Word
 * never needs more lines than the prediction (the right padding is this much smaller).
 */
export const WORD_WRAP_SLACK_MM = 1;
/**
 * Word's bottom page margin is this much smaller than the layout's, so a card that Word draws a
 * fraction taller than predicted never pushes its column onto another page. Content still ends
 * where the PDF's does.
 */
export const WORD_FOOT_MM = 3;
/**
 * How much smaller Word prints the parts of an in-line fraction than their font size: in Word 16,
 * 11 pt parts printed at 8 pt (real-Word check, 11 November 2026).
 */
export const WORD_INLINE_FRACTION = 8 / 11;
/** The paragraph Word requires after a nested table: 1 pt high. */
const END_MM = 0.36;
/**
 * An answer row is two exact rows in Word: the writing row, whose bottom border is the answer
 * line, and the space below the line. Word draws a 0.3 mm bottom border with its centre about
 * 0.2 mm below the row's edge and makes the pair about 0.08 mm taller than asked, so these put the
 * line 7.2 mm down a 9 mm row, as on the SVG page (layout probe P8, real Word, 11 November 2026).
 * A single row with a bottom cell margin printed each row about 1.3 mm taller (probe P7).
 */
const ANSWER_WRITE_MM = S.answerRow - 2.6 + 0.8 - 0.2;
const ANSWER_BELOW_MM = S.answerRow - ANSWER_WRITE_MM - 0.08;
/** The writing row of an answer row holding a stacked fraction (maths notation): one exact line fills it. */
const FRAC_WRITE_MM = ANSWER_WRITE_MM + FRAC_ANSWER_EXTRA;
/**
 * Space under a stacked fraction on an answer line, so its denominator clears the line. 0.8 (set in
 * LibreOffice) left real Word's denominator 0.4 mm above the line; 1.4 gives 0.55 mm, with the
 * whole number within 0.2 mm of the PDF's (real Word 16, 14 November 2026).
 */
const FRAC_WORD_LIFT = 1.4;
/** The thin space either side of a Word fraction, as a share of the text size (see fraction()). */
const WORD_FRACTION_PAD = 0.55;

const tw = (mm: number) => Math.round((mm * 1440) / 25.4);
const emu = (mm: number) => Math.round(mm * 36000);
/** Font size in half-points from a size in millimetres. */
const hp = (mm: number) => Math.round((mm / 0.3528) * 2);
/** Border width in eighths of a point from millimetres (Word allows 2 to 96). */
const b8 = (mm: number) => Math.max(2, Math.min(96, Math.round((mm / 0.3528) * 8)));
const hex = (c: string) => c.replace("#", "").toUpperCase();
const x = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const lineBox = (size: number) => size * S.lineHeight;

const FONT = "Inter";
const FONT_BOLD = "Inter SemiBold";

// ---------------------------------------------------------------- runs and paragraphs

interface RunStyle {
  bold?: boolean;
  italic?: boolean;
  color?: string;
  sizeMm?: number;
  shade?: string;
  border?: string;
  underline?: boolean;
}
function rPr(o: RunStyle): string {
  const font = o.bold ? FONT_BOLD : FONT;
  const p: string[] = [];
  if (o.bold) p.push(`<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}" w:eastAsia="${font}"/>`);
  if (o.italic) p.push("<w:i/><w:iCs/>");
  if (o.color) p.push(`<w:color w:val="${hex(o.color)}"/>`);
  if (o.sizeMm !== undefined) p.push(`<w:sz w:val="${hp(o.sizeMm)}"/><w:szCs w:val="${hp(o.sizeMm)}"/>`);
  if (o.underline) p.push(`<w:u w:val="single" w:color="${hex(o.color ?? "#000000")}"/>`);
  if (o.border) p.push(`<w:bdr w:val="single" w:sz="${b8(0.3)}" w:space="0" w:color="${hex(o.border)}"/>`);
  if (o.shade) p.push(`<w:shd w:val="clear" w:color="auto" w:fill="${hex(o.shade)}"/>`);
  return p.length ? `<w:rPr>${p.join("")}</w:rPr>` : "";
}
const run = (text: string, o: RunStyle = {}) => `<w:r>${rPr(o)}<w:t xml:space="preserve">${x(text)}</w:t></w:r>`;
const tab = (o: RunStyle = {}) => `<w:r>${rPr(o)}<w:tab/></w:r>`;
/**
 * A stacked fraction as a native Word equation, so a teacher can change it with Word's equation
 * editor. Its parts are "normal text" in the sheet's own font (Inter), not Cambria Math, so the
 * digits match the rest of the sheet; letters are italic, as in the SVG pages.
 */
function fraction(f: { num: string; den: string }, o: RunStyle): string {
  // Word sets an in-line fraction's parts smaller than the text; the parts are enlarged by the
  // same factor so they print at body size, as the layout measured them.
  const size = (o.sizeMm ?? S.body) / WORD_INLINE_FRACTION;
  const part = (s: string) =>
    [...s]
      .map((c) => {
        const r = rPr({ color: o.color, sizeMm: size, italic: fracStyle(c) === "italic" });
        return `<m:r><m:rPr><m:nor/></m:rPr>${r}<m:t xml:space="preserve">${x(c)}</m:t></m:r>`;
      })
      .join("");
  // Word set fractions tight against their neighbours ("2½." touched), while the pages pad a
  // fraction 0.8 mm each side. A thin space at 0.55 of the text size either side, plus Word's own
  // equation spacing, puts every character within 0.2 mm of the PDF's position (real Word 16,
  // three rounds, 14 November 2026; docs/content/WORD-OUTPUT.md).
  const pad = `<m:r><m:rPr><m:nor/></m:rPr>${rPr({ color: o.color, sizeMm: (o.sizeMm ?? S.body) * WORD_FRACTION_PAD })}<m:t xml:space="preserve">\u2009</m:t></m:r>`;
  return `<m:oMath>${pad}<m:f><m:num>${part(f.num)}</m:num><m:den>${part(f.den)}</m:den></m:f>${pad}</m:oMath>`;
}
/** Marked-up text (**bold**, *italic*, and {3/4} with maths notation on) as Word runs. */
const runs = (source: string, o: RunStyle = {}, base: Run["style"] = "regular", maths = false) =>
  parseRuns(source, base, maths)
    .map((r) => (r.frac ? fraction(r.frac, o) : run(r.text, { ...o, bold: o.bold || r.style === "bold", italic: o.italic || r.style === "italic" })))
    .join("");

/**
 * Marked-up text holding stacked fractions as one Word equation: text as normal-text maths runs in
 * the sheet's font, fractions as m:f. boxed draws a box round it (a chosen circle-one option).
 */
function mathRuns(source: string, o: RunStyle, boxed: boolean): string {
  const inner = parseRuns(source, o.bold ? "bold" : "regular", true)
    .map((r) =>
      r.frac
        ? fraction(r.frac, o).replace(/^<m:oMath>|<\/m:oMath>$/g, "")
        : `<m:r><m:rPr><m:nor/></m:rPr>${rPr({ ...o, bold: o.bold || r.style === "bold", italic: r.style === "italic" })}<m:t xml:space="preserve">${x(r.text)}</m:t></m:r>`,
    )
    .join("");
  return `<m:oMath>${boxed ? `<m:borderBox><m:e>${inner}</m:e></m:borderBox>` : inner}</m:oMath>`;
}

interface ParaStyle {
  /** Exact line height in millimetres; omitted = exact body line. */
  line?: number;
  /** Auto line spacing (pictures). */
  atLeast?: boolean;
  /** A paragraph holding an equation: every line is exactly the fraction line height. */
  grow?: boolean;
  before?: number;
  after?: number;
  left?: number;
  right?: number;
  hanging?: number;
  align?: "left" | "center" | "right";
  tabs?: { pos: number; align?: "left" | "right"; leader?: "underscore" }[];
  borderLeft?: { color: string; width: number; space: number };
  keep?: boolean;
  /** Paragraph mark size (affects the height of empty and picture paragraphs). */
  markMm?: number;
}
function para(content: string, o: ParaStyle = {}): string {
  const p: string[] = [];
  if (o.keep) p.push("<w:keepLines/>");
  if (o.borderLeft) p.push(`<w:pBdr><w:left w:val="single" w:sz="${b8(o.borderLeft.width)}" w:space="${Math.round(o.borderLeft.space / 0.3528)}" w:color="${hex(o.borderLeft.color)}"/></w:pBdr>`);
  if (o.tabs?.length)
    p.push(`<w:tabs>${o.tabs.map((t) => `<w:tab w:val="${t.align ?? "left"}"${t.leader ? ` w:leader="${t.leader}"` : ""} w:pos="${tw(t.pos)}"/>`).join("")}</w:tabs>`);
  const line = o.grow ? S.body * FRAC_LINE : (o.line ?? lineBox(S.body));
  p.push(
    `<w:spacing w:before="${tw(o.before ?? 0)}" w:after="${tw(o.after ?? 0)}" w:line="${o.atLeast ? 240 : tw(line)}" w:lineRule="${o.atLeast ? "auto" : "exact"}"/>`,
  );
  if (o.left || o.right || o.hanging)
    p.push(`<w:ind w:left="${tw(o.left ?? 0)}" w:right="${tw(o.right ?? 0)}"${o.hanging ? ` w:hanging="${tw(o.hanging)}"` : ""}/>`);
  if (o.align && o.align !== "left") p.push(`<w:jc w:val="${o.align}"/>`);
  if (o.markMm) p.push(`<w:rPr><w:sz w:val="${Math.max(2, hp(o.markMm))}"/></w:rPr>`);
  return `<w:p><w:pPr>${p.join("")}</w:pPr>${content}</w:p>`;
}
/** An empty paragraph exactly `mm` high: gaps between items, and the end of a cell. */
const gap = (mm: number, left = 0) => para("", { line: Math.max(mm, 0.36), markMm: 0.36, left });
/**
 * Space at the end of a cell. Word does not print the last paragraph of a cell when it follows a
 * nested table (layout probe P4, real Word, 11 November 2026), so the space is two paragraphs.
 */
const endGap = (mm: number) => gap(mm - END_MM) + gap(END_MM);

// ---------------------------------------------------------------- tables

interface CellOpts {
  width: number;
  span?: number;
  borders?: Partial<Record<"top" | "left" | "bottom" | "right", { color: string; width: number }>>;
  shade?: string;
  margin?: Partial<Record<"top" | "left" | "bottom" | "right", number>>;
  vAlign?: "top" | "center" | "bottom";
}
function cell(content: string, o: CellOpts): string {
  const p: string[] = [`<w:tcW w:w="${tw(o.width)}" w:type="dxa"/>`];
  if (o.span && o.span > 1) p.push(`<w:gridSpan w:val="${o.span}"/>`);
  const sides = ["top", "left", "bottom", "right"] as const;
  p.push(
    `<w:tcBorders>${sides
      .map((s) => {
        const b = o.borders?.[s];
        return b ? `<w:${s} w:val="single" w:sz="${b8(b.width)}" w:space="0" w:color="${hex(b.color)}"/>` : `<w:${s} w:val="nil"/>`;
      })
      .join("")}</w:tcBorders>`,
  );
  if (o.shade) p.push(`<w:shd w:val="clear" w:color="auto" w:fill="${hex(o.shade)}"/>`);
  if (o.margin) p.push(`<w:tcMar>${sides.map((s) => `<w:${s} w:w="${tw(o.margin?.[s] ?? 0)}" w:type="dxa"/>`).join("")}</w:tcMar>`);
  if (o.vAlign && o.vAlign !== "top") p.push(`<w:vAlign w:val="${o.vAlign}"/>`);
  // A cell must end with a paragraph.
  const body = content.endsWith("</w:p>") ? content : content + gap(END_MM);
  return `<w:tc><w:tcPr>${p.join("")}</w:tcPr>${body}</w:tc>`;
}
const row = (cells: string[], height?: { mm: number; exact?: boolean }, cantSplit = false) =>
  `<w:tr><w:trPr>${cantSplit ? "<w:cantSplit/>" : ""}${height ? `<w:trHeight w:val="${tw(height.mm)}" w:hRule="${height.exact ? "exact" : "atLeast"}"/>` : ""}</w:trPr>${cells.join("")}</w:tr>`;
/** A fixed-layout table with zero cell margins unless a cell sets its own. */
function table(grid: number[], rows: string[], indent = 0): string {
  const total = grid.reduce((a, b) => a + b, 0);
  return (
    `<w:tbl><w:tblPr><w:tblW w:w="${tw(total)}" w:type="dxa"/><w:tblInd w:w="${tw(indent)}" w:type="dxa"/>` +
    `<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>` +
    `<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar>` +
    `<w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/></w:tblPr>` +
    `<w:tblGrid>${grid.map((g) => `<w:gridCol w:w="${tw(g)}"/>`).join("")}</w:tblGrid>${rows.join("")}</w:tbl>`
  );
}

// ---------------------------------------------------------------- pictures

interface Media {
  name: string;
  bytes: Uint8Array;
}
interface WordCtx extends Ctx<{ side: number; column: number; question?: number }> {
  media: Media[];
  rels: { id: string; target: string; type: string }[];
  pictures: { svg: string; widthMm: number; heightMm: number; id: number; png: string; vector: string; alt: string }[];
}
function picture(d: Diagram, w: number, indent: number, ctx: WordCtx): string {
  let drawn: ReturnType<typeof drawDiagram>;
  try {
    drawn = drawDiagram(d.tool, diagramEnvelope(d), ctx.view === "answers" ? "answer" : "pupil");
  } catch (error) {
    ctx.issues.push({ ...ctx.where, message: `A diagram could not be drawn: ${error instanceof Error ? error.message : "unknown problem"}` });
    return gap(END_MM, indent);
  }
  const room = w + 2 * (S.cardPad - 0.6);
  if (drawn.widthMm > room + 0.01) ctx.issues.push({ ...ctx.where, message: tooWideMessage(d.tool, drawn.widthMm, room) });
  return drawing(drawn, w, indent, ctx);
}
/** Grid paper: the same SVG as the page, as a picture at its printed size. */
function paper(item: Extract<Leaf, { type: "paper" }>, w: number, indent: number, ctx: WordCtx): string {
  const { widthMm, heightMm } = item;
  const alt = `Blank ${item.style === "graph" ? "graph paper" : `${item.style} paper`}${item.axes ? " with blank axes" : ""}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${widthMm}mm" height="${heightMm}mm" viewBox="0 0 ${widthMm} ${heightMm}" font-family="Inter" role="img" aria-label="${alt}">${paperSvg(item, ctx.st)}</svg>`;
  return drawing({ svg, widthMm, heightMm }, w, indent, ctx);
}
function drawing(drawn: { svg: string; widthMm: number; heightMm: number }, w: number, indent: number, ctx: WordCtx): string {
  const id = ctx.pictures.length + 1;
  const png = `rIdImg${id}p`,
    vector = `rIdImg${id}s`;
  const alt = drawn.svg.match(/aria-label="([^"]*)"/)?.[1] ?? `Diagram ${id}`;
  ctx.pictures.push({ svg: drawn.svg, widthMm: drawn.widthMm, heightMm: drawn.heightMm, id, png, vector, alt });
  const cx = emu(drawn.widthMm),
    cy = emu(drawn.heightMm);
  const pic =
    `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${id}" name="Diagram ${id}" descr="${x(alt)}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="diagram${id}.png" descr="${x(alt)}"/><pic:cNvPicPr><a:picLocks noChangeAspect="1" noChangeArrowheads="1"/></pic:cNvPicPr></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${png}"><a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}"><asvg:svgBlip r:embed="${vector}"/></a:ext></a:extLst></a:blip><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr bwMode="auto"><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  // A diagram may use the card's padding, like the SVG page: negative indents widen the paragraph.
  const spill = Math.max(0, (drawn.widthMm - w) / 2);
  return para(pic, { atLeast: true, align: "center", markMm: 0.36, left: indent - spill, right: -spill });
}

// ---------------------------------------------------------------- items

/** Flowing question text: maths notation applies, and a paragraph holding a fraction may grow. */
const mt = (source: string, ctx: WordCtx, o: RunStyle = {}, base: Run["style"] = "regular") => runs(source, o, base, ctx.maths);
const grows = (ctx: WordCtx, ...sources: string[]) => !!ctx.maths && sources.some((t) => parseRuns(t, "regular", true).some((r) => r.frac));

type Block = string;
/** Joins blocks with exact gaps; adjacent tables are always separated by a paragraph. */
const stack = (blocks: Block[], gapMm: number, indent = 0) => blocks.join(gap(gapMm, indent));

function answerCells(lines: Extract<Leaf, { type: "answerLine" }>[], w: number, ctx: WordCtx): { grid: number[]; cells: string[] } {
  const slot = (w - (lines.length - 1) * ANSWER_SLOT_GAP) / lines.length;
  const grid: number[] = [];
  const cells: string[] = [];
  const size = S.body;
  // Maths notation: fractions on answer lines print stacked, as in the SVG page.
  const maths = !!ctx.maths;
  const shownText = (s: string) => (maths ? stackAnswerText(s) : s);
  // Plain sheets keep their saved measurements exactly.
  const widthOf = (s: string) => (maths ? lineWidth(parseRuns(shownText(s), "regular", true), size) : plainWidth(s, size));
  lines.forEach((l, i) => {
    if (i) {
      grid.push(ANSWER_SLOT_GAP);
      cells.push(cell(gap(END_MM), { width: ANSWER_SLOT_GAP }));
    }
    const pre = l.prefix ? widthOf(l.prefix) + 1.8 : 0;
    const post = l.suffix ? widthOf(l.suffix) + 1.8 : 0;
    const mid = slot - pre - post;
    if (mid < 18) ctx.issues.push({ ...ctx.where, message: "An answer line is shorter than 18 mm." });
    const text = (s: string, o: RunStyle = {}) =>
      answerHasFraction(s, maths)
        ? // A stacked fraction sits on a small gap so its denominator clears the line (LibreOffice check, 14 Nov 2026).
          para(runs(shownText(s), o, "regular", maths), { line: FRAC_WRITE_MM - FRAC_WORD_LIFT }) + gap(FRAC_WORD_LIFT)
        : para(runs(shownText(s), o, "regular", maths), { line: lineBox(size) });
    if (pre) {
      grid.push(pre);
      cells.push(cell(text(l.prefix), { width: pre, vAlign: "bottom" }));
    }
    grid.push(mid);
    const shown = ctx.view === "answers" && l.answer;
    cells.push(
      cell(shown ? text(l.answer, { color: ctx.st.answer }) : gap(END_MM), {
        width: mid,
        vAlign: "bottom",
        borders: { bottom: { color: ctx.st.ink, width: 0.3 } },
        margin: { left: 2 },
      }),
    );
    if (post) {
      grid.push(post);
      cells.push(cell(text(l.suffix), { width: post, vAlign: "bottom", margin: { left: 1.8 } }));
    }
  });
  return { grid, cells };
}
function answerRow(lines: Extract<Leaf, { type: "answerLine" }>[], w: number, indent: number, ctx: WordCtx): Block {
  const { grid, cells } = answerCells(lines, w, ctx);
  const below = grid.map((g) => cell(gap(END_MM), { width: g }));
  // A row holding a stacked fraction is taller, in both copies, as on the SVG page.
  const tall = lines.some((l) => [l.prefix, l.suffix, l.answer].some((s) => answerHasFraction(s, !!ctx.maths)));
  return table(grid, [row(cells, { mm: tall ? FRAC_WRITE_MM : ANSWER_WRITE_MM, exact: true }), row(below, { mm: ANSWER_BELOW_MM, exact: true })], indent);
}

function dataTable(item: Extract<Leaf, { type: "table" }>, w: number, indent: number, ctx: WordCtx): Block {
  const size = S.body;
  const st = ctx.st;
  const cellText = (c: Cell) => (c.state === "supplied" || (c.state === "hidden" && ctx.view === "answers") ? c.text : "");
  // Maths notation: fractions in cells and headings print stacked, as on the SVG page.
  const maths = !!ctx.maths;
  const shown = (t: string) => (maths ? stackAnswerText(t) : t);
  const cellWidth = (t: string, bold = false) =>
    maths ? lineWidth(parseRuns(shown(t), bold ? "bold" : "regular", true), size) : plainWidth(t, size, bold ? "bold" : "regular");
  const tall = (texts: string[]) => texts.some((t) => answerHasFraction(t, maths));
  const natural = item.columns.map((head, j) => Math.max(cellWidth(head, true), ...item.rows.map((r) => cellWidth(r[j]?.text ?? ""))) + 5);
  const total = natural.reduce((a, b) => a + b, 0);
  if (total > w + 0.01) ctx.issues.push({ ...ctx.where, message: `A table needs ${Math.round((total - w) * 100) / 100} mm more width than the column has.` });
  const widths = natural.map((v) => (v * w) / total);
  const rule = { color: st.rule, width: 0.35 };
  const border = { top: rule, left: rule, bottom: rule, right: rule };
  const rowXml = (texts: { text: string; bold?: boolean; color?: string }[], h: number, head: boolean) =>
    row(
      texts.map((t, j) =>
        cell(
          para(t.text ? runs(shown(t.text), { bold: t.bold, color: t.color }, "regular", maths) : "", {
            align: j === 0 ? "left" : "center",
            // A stacked fraction needs the whole row as its line.
            ...(answerHasFraction(t.text, maths) ? { line: h - 0.2 } : {}),
          }),
          {
          width: widths[j],
          borders: border,
          shade: head ? st.tableHead : undefined,
          vAlign: "center",
          margin: { left: j === 0 ? 2 : 0.5, right: 0.5 },
          },
        ),
      ),
      { mm: h, exact: true },
      true,
    );
  const rows = [rowXml(item.columns.map((t) => ({ text: t, bold: true })), tall(item.columns) ? FRAC_TABLE_ROW : S.tableRow, true)];
  for (const r of item.rows) {
    const h = r.some((c) => c.state !== "supplied") ? S.tableAnswerRow : S.tableRow;
    rows.push(rowXml(r.map((c) => ({ text: cellText(c), color: c.state === "hidden" ? st.answer : undefined })), tall(r.map((c) => c.text)) ? Math.max(h, FRAC_TABLE_ROW) : h, false));
  }
  return table(widths, rows, indent);
}

/** A tick box drawn as a bordered run of non-breaking spaces; shaded in the answers copy when chosen. */
const box = (color: string, filled?: string) => run("\u00a0\u00a0\u00a0", { border: color, shade: filled, sizeMm: S.body });

function choice(item: Extract<Leaf, { type: "choice" }>, w: number, indent: number, ctx: WordCtx): Block {
  const size = S.body;
  const st = ctx.st;
  const show = ctx.view === "answers" ? item.answer : null;
  if (item.mode === "circle") {
    // Maths notation: a fraction option prints stacked; a chosen one is boxed as a Word equation.
    const maths = !!ctx.maths;
    const tallRow = item.options.some((o) => answerHasFraction(o, maths));
    let pos = indent + 2;
    const tabs: { pos: number }[] = [];
    const parts: string[] = [];
    item.options.forEach((o, i) => {
      tabs.push({ pos });
      const border = show === i ? st.answer : undefined;
      parts.push(tab(), answerHasFraction(o, maths) ? mathRuns(stackAnswerText(o), { bold: true }, !!border) : runs(o, { bold: true, border }));
      pos += (maths ? lineWidth(parseRuns(stackAnswerText(o), "bold", true), size) : plainWidth(o, size, "bold")) + 9;
    });
    if (pos - 9 - indent > w) ctx.issues.push({ ...ctx.where, message: "Circle-one options are wider than the card." });
    return para(parts.join(""), { line: tallRow ? FRAC_CIRCLE_ROW : 8.5, tabs, left: indent });
  }
  if (item.mode === "tick") {
    return item.options
      .map((o, i) =>
        para(box(st.ink, show === i ? st.answer : undefined) + tab() + mt(o, ctx), {
          grow: grows(ctx, o),
          left: indent + S.tickBox + 2.6,
          hanging: S.tickBox + 2.6,
          after: i < item.options.length - 1 ? 1.2 : 0,
        }),
      )
      .join("");
  }
  // Lettered options for hinge questions: one row when they fit, otherwise two columns or one.
  const r = 2.5,
    g = 1.8;
  const widths = item.options.map((o) => 2 * r + g + plainWidth(o, size));
  const perRow = widths.reduce((a, b) => a + b, 0) + (item.options.length - 1) * 6 <= w ? item.options.length : Math.max(...widths) * 2 + 6 <= w ? 2 : 1;
  const slot = perRow === item.options.length ? 0 : (w - (perRow - 1) * 6) / perRow;
  const rows: string[] = [];
  let grid: number[] = [];
  for (let start = 0; start < item.options.length; start += perRow) {
    const cells: string[] = [];
    const g2: number[] = [];
    for (let j = 0; j < perRow; j++) {
      const i = start + j;
      const cw = (slot || widths[i] || slot) + (j < perRow - 1 ? 6 : 0);
      g2.push(cw);
      if (i >= item.options.length) {
        cells.push(cell(gap(END_MM), { width: cw }));
        continue;
      }
      const mark = show === i;
      const letter = run(`\u00a0${String.fromCharCode(65 + i)}\u00a0`, { bold: true, color: mark ? "#ffffff" : st.navy, border: mark ? st.answer : st.navy, shade: mark ? st.answer : undefined });
      // A row holding a fraction keeps FRAC_FOOT below it, as the layout does, so Word does not
      // clip the denominators at the foot of the cell.
      const foot = item.options.slice(start, start + perRow).some((o) => grows(ctx, o)) ? gap(FRAC_FOOT) : "";
      cells.push(
        cell(para(letter + tab() + mt(item.options[i], ctx), { left: 2 * r + g, hanging: 2 * r + g, grow: grows(ctx, item.options[i]) }) + foot, {
          width: cw,
          margin: { top: start ? 1.6 : 0, right: j < perRow - 1 ? 6 : 0 },
        }),
      );
    }
    if (!grid.length) grid = g2;
    rows.push(row(cells));
  }
  return table(grid, rows, indent);
}

function leaf(item: Leaf, w: number, indent: number, ctx: WordCtx, extra: number): Block {
  const st = ctx.st;
  switch (item.type) {
    case "text":
      return para(mt(item.text, ctx), { left: indent, grow: grows(ctx, item.text) });
    case "info": {
      const pad = 2.4;
      return table(
        [w],
        [
          row([
            cell(para(mt(item.text, ctx), { grow: grows(ctx, item.text) }), {
              width: w,
              shade: st.tint,
              borders: { left: { color: st.navy, width: 0.9 } },
              margin: { top: pad, left: pad, bottom: pad, right: pad - WORD_WRAP_SLACK_MM },
            }),
          ]),
        ],
        indent,
      );
    }
    case "claim":
      return para(mt(`“${item.text}”`, ctx, {}, "italic"), {
        grow: grows(ctx, item.text),
        left: indent + 4.2,
        before: 0.5,
        after: 0.5,
        borderLeft: { color: st.navy, width: 0.8, space: 3 },
      });
    case "bullets":
      return item.items.map((b) => para(run("•") + tab() + mt(b, ctx), { left: indent + 5, hanging: 5, grow: grows(ctx, b) })).join("");
    case "table":
      return dataTable(item, w, indent, ctx);
    case "choice":
      return choice(item, w, indent, ctx);
    case "answerLine":
      return answerRow([item], w, indent, ctx);
    case "space":
      // Working and drawing space: one empty paragraph of exact height.
      return gap(item.heightMm + extra, indent);
    case "diagram":
      return picture(item.diagram, w, indent, ctx);
    case "paper":
      return paper(item, w, indent, ctx);
    case "steps": {
      const labels = item.steps.map((s, i) => (s.label.trim() || `Step ${i + 1}`) + ":");
      const hang = Math.min(Math.max(...labels.map((l) => plainWidth(l, S.body, "bold"))) + 2, w * 0.35);
      return item.steps
        .map((s, i) =>
          para(run(labels[i], { bold: true, color: st.navy }) + tab() + mt(s.text, ctx), {
            grow: grows(ctx, s.text),
            left: indent + hang,
            hanging: hang,
            after: i < item.steps.length - 1 ? 1.2 : 0,
          }),
        )
        .join("");
    }
    case "checklist":
      return item.items
        .map((t, i) =>
          para(box(st.navy) + tab() + mt(t, ctx), {
            grow: grows(ctx, t),
            left: indent + S.tickBox + 2.6,
            hanging: S.tickBox + 2.6,
            after: i < item.items.length - 1 ? 0.8 : 0,
          }),
        )
        .join("");
  }
}

function items(list: Item[], w: number, indent: number, ctx: WordCtx, extra: number): Block[] {
  const blocks: Block[] = [];
  let part = 0;
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    if (it.type === "answerLine" && it.inline) {
      const group = [it];
      while (list[i + 1]?.type === "answerLine" && (list[i + 1] as typeof it).inline) group.push(list[++i] as typeof it);
      // Rows hold as many lines as fit, as on the SVG page.
      for (const rowLines of (ctx.maths ? packAnswerLines(group, w, (l) => answerNeed(l, true)) : [group])) blocks.push(answerRow(rowLines, w, indent, ctx));
    } else if (it.type === "part") {
      const label = `${String.fromCharCode(97 + part++)})`;
      const textW = w - S.partIndent;
      const only = it.items.length === 1 && it.items[0].type === "answerLine" && !it.items[0].inline ? it.items[0] : null;
      const wrapped = wrap(it.text, S.body, textW, "regular", ctx.maths);
      const lastW = lineWidth(wrapped[wrapped.length - 1], S.body);
      const head = { left: indent + S.partIndent, hanging: S.partIndent };
      if (only && !only.prefix && !wrapped.some(hasFraction) && ![only.suffix, only.answer].some((t) => answerHasFraction(t, !!ctx.maths)) && stubFits(textW - lastW - 3 - (only.suffix ? plainWidth(only.suffix, S.body) + 1.8 : 0), only.answer, S.body, !!ctx.maths)) {
        // A short answer goes on the question's last line, which grows to a full answer row.
        const lift = S.answerRow - lineBox(S.body);
        const post = only.suffix ? plainWidth(only.suffix, S.body) + 1.8 : 0;
        const answer = ctx.view === "answers" && only.answer ? run("\u00a0") + runs(only.answer, { color: ctx.st.answer, underline: true }) : "";
        const line = run("\u00a0") + answer + tab({ color: ctx.st.ink }) + (only.suffix ? run("\u00a0") + runs(only.suffix) : "");
        blocks.push(
          para(run(label) + tab() + mt(it.text, ctx) + line, {
            grow: grows(ctx, it.text),
            ...head,
            before: lift,
            tabs: [{ pos: indent + w - post, align: "left", leader: "underscore" }],
          }),
        );
        continue;
      }
      const top = para(run(label) + tab() + mt(it.text, ctx), { ...head, grow: grows(ctx, it.text) });
      const sub = it.items.length ? items(it.items, w - S.partIndent, indent + S.partIndent, ctx, extra) : [];
      blocks.push(sub.length ? top + gap(S.itemGap, indent) + stack(sub, S.itemGap, indent + S.partIndent) : top);
    } else blocks.push(leaf(it, w, indent, ctx, extra));
  }
  return blocks;
}

/** One framed question card: a bordered single-cell table, pinned to at least `height`. */
function wordCard(c: Card, number: number | null, w: number, ctx: WordCtx, extra: number, height: number): Block {
  const st = ctx.st,
    pad = S.cardPad;
  const inner = w - pad * 2;
  const titleRuns = runs(c.title, { bold: true, color: st.navy, sizeMm: S.cardTitle });
  const titleCell = (width: number) => cell(para(titleRuns, { line: lineBox(S.cardTitle) }), { width, vAlign: "center" });
  const titleRow =
    number === null
      ? table([inner], [row([titleCell(inner)], { mm: S.tile, exact: true })])
      : table(
          [S.tile, 2.8, inner - S.tile - 2.8],
          [
            row(
              [
                cell(para(run(String(number), { bold: true, color: "#ffffff", sizeMm: S.cardTitle }), { align: "center", line: lineBox(S.cardTitle) }), {
                  width: S.tile,
                  shade: st.navy,
                  vAlign: "center",
                }),
                cell(gap(END_MM), { width: 2.8 }),
                titleCell(inner - S.tile - 2.8),
              ],
              { mm: S.tile, exact: true },
            ),
          ],
        );
  if (plainWidth(c.title, S.cardTitle, "bold") > inner - (number === null ? 0 : S.tile + 2.8)) ctx.issues.push({ ...ctx.where, message: "The card title is wider than the card." });
  const rule = { color: st.rule, width: 0.45 };
  // The card's top and bottom padding are exact empty paragraphs, not cell margins: Word adds a
  // cell's top and bottom margins to a minimum row height (real-Word check, 11 November 2026),
  // which made every card about 5.5 mm taller than the layout.
  const body = gap(pad - rule.width) + stack([titleRow, ...items(c.items, inner, 0, ctx, extra)], S.itemGap) + endGap(pad - rule.width);
  // Word prints a card's top and bottom borders outside its minimum height (probe P1), and its
  // right border outside the cell, where the column cell cuts it off (probes P9 and P10). So the
  // card is one border narrower and two borders shorter, and its outside matches the SVG card.
  const cw = w - rule.width;
  return table(
    [cw],
    [
      row(
        [
          cell(body, {
            width: cw,
            borders: { top: rule, left: rule, bottom: rule, right: rule },
            // The padding paragraphs give the top and bottom borders' width back.
            margin: { top: 0, left: pad, bottom: 0, right: pad - rule.width - WORD_WRAP_SLACK_MM },
          }),
        ],
        { mm: height - 2 * rule.width },
      ),
    ],
  );
}

// ---------------------------------------------------------------- page

/** A stage tile and heading: a one-row table exactly one tile high. */
function stageTable(letter: string, heading: string, w: number, st: HouseStyle): string {
  return table(
    [S.tile, 2.8, w - S.tile - 2.8],
    [
      row(
        [
          cell(para(run(letter, { bold: true, color: "#ffffff", sizeMm: S.columnHeading }), { align: "center", line: lineBox(S.columnHeading) }), {
            width: S.tile,
            shade: st.navy,
            vAlign: "center",
          }),
          cell(gap(END_MM), { width: 2.8 }),
          cell(para(runs(heading, { bold: true, color: st.navy, sizeMm: S.columnHeading }), { line: lineBox(S.columnHeading) }), {
            width: w - S.tile - 2.8,
            vAlign: "center",
          }),
        ],
        { mm: S.tile, exact: true },
      ),
    ],
  );
}

/** "Score ____ / 18" then "Side 1 of 2", placed as in the PDF by tab stops. */
function scoreLine(score: number, sideNumber: number, rightW: number, st: HouseStyle): string {
  const box = scoreBox(score, sideNumber);
  const end = rightW - box.lineEnd;
  const o = { sizeMm: S.objective };
  const start = end - box.lineMm - 1.2 - plainWidth(box.label, S.objective);
  return para(
    run(box.label, o) + tab(o) + tab(o) + run(`\u00a0${box.total}`, o) + tab(o) + run(`Side ${sideNumber} of 2`, { ...o, color: st.muted }),
    {
      line: 4.8,
      tabs: [
        { pos: end - box.lineMm, align: "left" },
        { pos: end, align: "left", leader: "underscore" },
        { pos: rightW, align: "right" },
      ],
      left: start,
    },
  );
}

function side(resource: Resource, s: number, ctx: WordCtx, firstNumber: number, letters: ReturnType<typeof stageLetters>): { xml: string; next: number } {
  const doc = resource.document;
  const sideData = doc.sides[s];
  const st = ctx.st;
  const P = S.page,
    m = S.margin;
  const width = P.width - 2 * m;
  const boxes = columnBoxes(sideData);
  const rightW = HEADER_RIGHT;
  // Header: title, objective and instruction left; group, name line and side right; a hairline below.
  const left = [
    para(runs(doc.title, { bold: true, color: st.navy, sizeMm: S.title }), { line: 8.47 }),
    para(runs([doc.code, doc.objective].filter(Boolean).join(" • "), { color: st.muted, sizeMm: S.objective }), { line: 4.8 }),
    para(sideData.instruction ? runs(sideData.instruction, { color: st.ink, sizeMm: S.objective }) : "", { line: 4.8 }),
  ].join("");
  const right = [
    para(doc.group ? runs(`\u00a0\u00a0${doc.group}\u00a0\u00a0`, { bold: true, color: st.navy, sizeMm: S.objective, shade: st.tint }) : "", { line: 7, align: "right" }),
    para(doc.nameLine ? run("Name", { sizeMm: S.objective }) + run("\u00a0") + tab({ sizeMm: S.objective }) : "", {
      line: 6,
      left: rightW - 76,
      tabs: [{ pos: rightW, align: "right", leader: "underscore" }],
    }),
    sideData.score === null
      ? para(run(`Side ${s + 1} of 2`, { color: st.muted, sizeMm: S.objective }), { line: 4.8, align: "right" })
      : scoreLine(sideData.score, s + 1, rightW, st),
  ].join("");
  const hairline = { bottom: { color: st.rule, width: 0.3 } };
  const header = table(
    [width - rightW, rightW],
    [row([cell(left, { width: width - rightW, borders: hairline }), cell(right, { width: rightW, borders: hairline })], { mm: S.headerHeight - 1.3, exact: true })],
  );

  // Stage headings (A to F across both sides), then one tall cell per strand column.
  const grid = boxes.flatMap((b, c) => (c ? [S.gutter, b.w] : [b.w]));
  const spacer = (h?: number) => cell(gap(h ?? END_MM), { width: S.gutter });
  const bands: string[] = [];
  const columns: string[] = [];
  const avail = P.height - m - (m + S.headerHeight + S.columnHeadingBand + 2.5);
  let number = firstNumber;
  sideData.columns.forEach((col, c) => {
    if (c) {
      bands.push(spacer());
      columns.push(spacer());
    }
    const colW = boxes[c].w;
    bands.push(cell(stageTable(letters.columns[s][c], col.heading, colW, st), { width: colW, margin: { top: (S.columnHeadingBand - S.tile) / 2 } }));
    const numbers = col.cards.map((cd) => (isReminder(cd) ? null : ++number));
    ctx.where = { side: s + 1, column: c + 1, question: 0 };
    const { spare, extra, stretch } = planColumn(col.cards, numbers, colW, avail, ctx, resource.document.spareSpace === "share");
    if (spare < -0.01) ctx.issues.push({ side: s + 1, column: c + 1, message: overflowMessage(s, c, spare) });
    const quiet = { ...ctx, issues: [], diagrams: 0 };
    // Cards with exact gaps between them; a card that starts a stage has its band in the gap.
    const half = (S.columnHeadingBand - S.tile) / 2;
    const parts: string[] = [];
    col.cards.forEach((cd, i) => {
      ctx.where = { side: s + 1, column: c + 1, question: numbers[i] ?? undefined };
      const h = measureCard(cd, numbers[i], colW, quiet, extra, stretch(i)).h;
      const letter = letters.cards[s][c][i];
      if (i) parts.push(gap(S.cardGap + (letter ? half : 0)));
      if (letter) parts.push(stageTable(letter, cd.stage ?? "", colW, st), gap(STAGE_BAND - S.tile - half));
      parts.push(wordCard(cd, numbers[i], colW, ctx, extra, h));
    });
    columns.push(cell(parts.length ? parts.join("") : gap(END_MM), { width: colW }));
  });
  const body = table(grid, [row(bands, { mm: S.columnHeadingBand + 2.5, exact: true }), row(columns, { mm: avail })]);
  return { xml: header + gap(1.3) + body, next: number };
}

// ---------------------------------------------------------------- package

/** A stable pseudo-GUID from bytes (FNV-1a), so the same worksheet always makes the same file. */
function guid(bytes: Uint8Array, salt: number): string {
  const parts: string[] = [];
  for (let k = 0; k < 4; k++) {
    let h = (0x811c9dc5 ^ (salt * 16777619 + k)) >>> 0;
    for (let i = 0; i < bytes.length; i += 7) h = Math.imul(h ^ bytes[i], 16777619) >>> 0;
    parts.push(h.toString(16).padStart(8, "0").toUpperCase());
  }
  const s = parts.join("");
  return `{${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}}`;
}
/**
 * Word's embedded-font obfuscation (ECMA-376 Part 1, 17.8.1): the first 32 bytes of the font are
 * XORed with the font key, read as 16 bytes from the end of the GUID string.
 */
export function obfuscateFont(font: Uint8Array, key: string): Uint8Array {
  const hexKey = key.replace(/[{}-]/g, "");
  const k = Array.from({ length: 16 }, (_, i) => parseInt(hexKey.slice(30 - i * 2, 32 - i * 2), 16));
  const out = new Uint8Array(font);
  for (let i = 0; i < 32; i++) out[i] ^= k[i % 16];
  return out;
}

const NS =
  'xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" ' +
  'xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" ' +
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" ' +
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" ' +
  'xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" mc:Ignorable="w14"';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function stylesXml(st: HouseStyle): string {
  const fonts = `<w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}" w:eastAsia="${FONT}"/>`;
  return (
    XML +
    `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:docDefaults><w:rPrDefault><w:rPr>${fonts}<w:color w:val="${hex(st.ink)}"/><w:sz w:val="${hp(S.body)}"/><w:szCs w:val="${hp(S.body)}"/><w:lang w:val="en-GB"/></w:rPr></w:rPrDefault>` +
    `<w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0" w:line="${tw(lineBox(S.body))}" w:lineRule="exact"/></w:pPr></w:pPrDefault></w:docDefaults>` +
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>` +
    `<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>` +
    `</w:styles>`
  );
}

/** The Word file for one view of a worksheet. */
export async function writeWorksheetDocx(resource: Resource, options: DocxOptions): Promise<RenderedDocx> {
  const view = options.view ?? "pupil";
  const st = styles.mathsdock;
  // The SVG layout's own checks come first: Word output never hides a problem the pages have.
  const issues = [...renderResource(resource, { view }).issues];
  const ctx: WordCtx = { st, view, diagrams: 0, issues: [], where: { side: 0, column: 0 }, media: [], rels: [], pictures: [], maths: resource.document.notation === "maths" };
  const letters = stageLetters(resource);
  let number = 0;
  const sides: string[] = [];
  for (let s = 0; s < 2; s++) {
    const r = side(resource, s, ctx, number, letters);
    number = r.next;
    sides.push(r.xml);
  }
  for (const i of ctx.issues) if (!issues.some((j) => j.message === i.message && j.side === i.side && j.column === i.column)) issues.push(i);

  const P = S.page;
  const pageBreak = `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="2"/></w:rPr><w:br w:type="page"/></w:r></w:p>`;
  const sect =
    `<w:sectPr><w:pgSz w:w="${tw(P.width)}" w:h="${tw(P.height)}" w:orient="landscape"/>` +
    `<w:pgMar w:top="${tw(S.margin)}" w:right="${tw(S.margin)}" w:bottom="${tw(S.margin - WORD_FOOT_MM)}" w:left="${tw(S.margin)}" w:header="0" w:footer="0" w:gutter="0"/><w:cols w:space="0"/><w:docGrid w:linePitch="360"/></w:sectPr>`;
  // The page settings are the body's own last child. Inside a paragraph they would end a section
  // there, and Word would start another at its default (A4 portrait) size for the rest of the body.
  const last = `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr></w:p>`;
  const document = `${XML}<w:document ${NS}><w:body>${sides[0]}${pageBreak}${sides[1]}${last}${sect}</w:body></w:document>`;

  // Pictures: outlined SVG plus PNG fallback.
  const files: Record<string, Uint8Array> = {};
  const docRels: string[] = [
    `<Relationship Id="rIdStyles" Type="${REL}/styles" Target="styles.xml"/>`,
    `<Relationship Id="rIdSettings" Type="${REL}/settings" Target="settings.xml"/>`,
    `<Relationship Id="rIdFonts" Type="${REL}/fontTable" Target="fontTable.xml"/>`,
  ];
  for (const p of ctx.pictures) {
    const made = await options.picture(p.svg, p.widthMm, p.heightMm);
    files[`word/media/diagram${p.id}.png`] = made.png;
    files[`word/media/diagram${p.id}.svg`] = strToU8(made.svg);
    docRels.push(`<Relationship Id="${p.png}" Type="${REL}/image" Target="media/diagram${p.id}.png"/>`);
    docRels.push(`<Relationship Id="${p.vector}" Type="${REL}/image" Target="media/diagram${p.id}.svg"/>`);
  }

  // Inter, embedded and obfuscated as Word requires.
  const embedded = [
    { name: FONT, kind: "embedRegular", bytes: options.fonts.regular, file: "font1.odttf" },
    { name: FONT, kind: "embedItalic", bytes: options.fonts.italic, file: "font2.odttf" },
    { name: FONT_BOLD, kind: "embedRegular", bytes: options.fonts.semiBold, file: "font3.odttf" },
  ];
  const fontRels: string[] = [];
  const fontEntries = new Map<string, string[]>();
  embedded.forEach((f, i) => {
    const key = guid(f.bytes, i + 1);
    files[`word/fonts/${f.file}`] = obfuscateFont(f.bytes, key);
    fontRels.push(`<Relationship Id="rIdFont${i + 1}" Type="${REL}/font" Target="fonts/${f.file}"/>`);
    const list = fontEntries.get(f.name) ?? [];
    list.push(`<w:${f.kind} r:id="rIdFont${i + 1}" w:fontKey="${key}"/>`);
    fontEntries.set(f.name, list);
  });
  const fontTable =
    XML +
    `<w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="${REL}">` +
    [...fontEntries]
      .map(([name, embeds]) => `<w:font w:name="${name}"><w:charset w:val="00"/><w:family w:val="swiss"/><w:pitch w:val="variable"/>${embeds.join("")}</w:font>`)
      .join("") +
    `<w:font w:name="Cambria Math"><w:charset w:val="00"/><w:family w:val="roman"/><w:pitch w:val="variable"/></w:font></w:fonts>`;

  const settings =
    XML +
    `<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">` +
    `<w:embedTrueTypeFonts/><w:defaultTabStop w:val="709"/><w:characterSpacingControl w:val="doNotCompress"/>` +
    `<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>` +
    `<m:mathPr><m:mathFont m:val="Cambria Math"/><m:smallFrac m:val="0"/><m:dispDef/><m:lMargin m:val="0"/><m:rMargin m:val="0"/><m:defJc m:val="left"/><m:intLim m:val="subSup"/><m:naryLim m:val="undOvr"/></m:mathPr>` +
    `</w:settings>`;

  const doc = resource.document;
  const title = `${doc.title}${view === "answers" ? " (answers)" : ""}`;
  const core =
    XML +
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>${x(title)}</dc:title><dc:subject>${x([doc.code, doc.objective].filter(Boolean).join(" "))}</dc:subject><dc:creator>MathsDock</dc:creator>` +
    `<cp:keywords>${x(["MathsDock worksheet", doc.code, doc.group, view === "answers" ? "answers" : "pupil"].filter(Boolean).join("; "))}</cp:keywords>` +
    `<dc:description>${x(`Made by MathsDock from the worksheet source. Edit the source and remake this file to keep the pupil and answer copies in step.`)}</dc:description>` +
    `${options.version ? `<cp:version>${x(options.version)}</cp:version>` : ""}</cp:coreProperties>`;
  const app = `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>MathsDock</Application><Pages>2</Pages></Properties>`;

  files["[Content_Types].xml"] = strToU8(
    XML +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>` +
      `<Default Extension="png" ContentType="image/png"/><Default Extension="svg" ContentType="image/svg+xml"/>` +
      `<Default Extension="odttf" ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"/>` +
      `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
      `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
      `<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>` +
      `<Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>` +
      `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
      `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
  );
  files["_rels/.rels"] = strToU8(
    XML +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/>` +
      `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
      `<Relationship Id="rId3" Type="${REL}/extended-properties" Target="docProps/app.xml"/></Relationships>`,
  );
  files["word/document.xml"] = strToU8(document);
  files["word/styles.xml"] = strToU8(stylesXml(st));
  files["word/settings.xml"] = strToU8(settings);
  files["word/fontTable.xml"] = strToU8(fontTable);
  files["word/_rels/document.xml.rels"] = strToU8(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${docRels.join("")}</Relationships>`);
  files["word/_rels/fontTable.xml.rels"] = strToU8(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${fontRels.join("")}</Relationships>`);
  files["docProps/core.xml"] = strToU8(core);
  files["docProps/app.xml"] = strToU8(app);

  // A fixed date keeps the bytes the same for the same worksheet.
  const mtime = new Date(Date.UTC(2026, 0, 1));
  const ordered = ["[Content_Types].xml", "_rels/.rels", ...Object.keys(files).filter((k) => k !== "[Content_Types].xml" && k !== "_rels/.rels").sort()];
  const zip: Record<string, [Uint8Array, { mtime: Date; level: 0 | 6 }]> = {};
  for (const k of ordered) zip[k] = [files[k], { mtime, level: k.endsWith(".png") ? 0 : 6 }];
  return { bytes: zipSync(zip), issues };
}

/** The guide's file name with a .docx extension: [code]_[objective]_A3.docx, _Answers before _A3. */
export const docxFileName = (pdfName: string) => pdfName.replace(/\.pdf$/, ".docx");
