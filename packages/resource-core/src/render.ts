import { typesetForPrint } from "./typeset";
import { drawDiagram, svgSizeMm } from "../../diagram-core/src/registry";
import { answerLeaks } from "../../diagram-core/src/answer-leaks";
import { diagramEnvelope, LAYOUTS, tableRows, type Card, type Cell, type Diagram, type Item, type Leaf, type Resource, type Side } from "./schema";
import { SIZE, styles, type HouseStyle, type StyleId } from "./style";
import { ANSWER_LINE_MIN, ANSWER_SLOT_GAP, answerFrame, loneSlot, answerHasFraction, esc, packAnswerLines, stubFits, FRAC_ANSWER_EXTRA, FRAC_ANSWER_RAISE, FRAC_CIRCLE_ROW, FRAC_TABLE_ROW, FRAC_FOOT, FRAC_LINE, hasFraction, stackAnswerText, inlineFraction, lineWidth, n, parseRuns, plainWidth, textSvg, wrap, type Line } from "./text";
import { measuredWidths, type FontStyle } from "./metrics";
import { ratioBottomBaselineMm } from "../../ratio-table-core/src/svg";

export type View = "pupil" | "answers";
export interface Issue {
  side: number;
  column: number;
  /** Question number, when the issue belongs to one card. */
  question?: number;
  message: string;
}
export interface RenderOptions {
  view?: View;
  style?: StyleId;
  /** Optional @font-face CSS embedded in each page so it renders standalone. */
  fontCss?: string;
}
export interface Rendered {
  /** One SVG per printed side, 420 mm × 297 mm, user units in millimetres. */
  pages: string[];
  /** Layout problems. Nothing is shrunk to hide them. */
  issues: Issue[];
  /**
   * Advice, not layout problems: the sheet is still print-ready. Columns that are mostly blank (no
   * question number), and questions with a fraction that will not print stacked (with one).
   */
  notes: Issue[];
}

/** A laid-out piece of a page: its height in millimetres and its SVG at the origin. */
export type Frag = { h: number; svg: string; first?: number };
/** Layout state shared by the worksheet and booklet renderers. `where` locates each issue. */
export interface Ctx<W extends object = { side: number; column: number; question: number }> {
  st: HouseStyle;
  view: View;
  diagrams: number;
  issues: (W & { message: string })[];
  where: W;
  /** Maths notation in flowing text: {3/4} prints as a stacked fraction (worksheet `notation: "maths"`). */
  maths?: boolean;
  /** Collects one note per question whose flowing text holds a fraction that will not print stacked. */
  inline?: Map<string, Issue>;
  /** Parts print i), ii)…: set while drawing a lettered booklet question, so no label mixes a letter and a number (N1). */
  romanParts?: boolean;
  /** The message for a diagram wider than its room, when the worksheet's advice does not apply (silent starter slots). */
  tooWide?: (tool: string, width: number, room: number) => string;
}

const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii"];
/** A part's label: a), b)… or, in a lettered question, i), ii)… */
export const partLabel = (k: number, roman?: boolean) => (roman ? ROMAN[k] ?? String(k + 1) : String.fromCharCode(97 + k)) + ")";

const S = SIZE;
const lineBox = (size: number) => size * S.lineHeight;
const baseline = (size: number) => (lineBox(size) - size) / 2 + size * 0.82;
export const at = (f: Frag, x: number, y: number) => (f.svg ? `<g transform="translate(${n(x)},${n(y)})">${f.svg}</g>` : "");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtx = Ctx<any>;
const issue = (ctx: AnyCtx, message: string) => ctx.issues.push({ ...ctx.where, message });

/**
 * A paragraph holding a stacked fraction sets every line at the fraction line height, so Word can
 * give it exact line spacing too: its layout is then as fixed as ordinary text.
 */
export const fractionLine = (size: number) => size * FRAC_LINE;
/** Baseline within a fraction line: the ordinary gap below it, and the extra height above. */
export const fractionBaseline = (size: number) => fractionLine(size) - (lineBox(size) - baseline(size)) - size * 0.55;

/** Stacked fractions are the rule on worksheets, so a fraction typed inline gets a note. */
export const fractionMessage = (question: number, found: string, maths: boolean) =>
  found.startsWith("{")
    ? `Question ${question} has ${found}, which prints with its braces because document.notation is not "maths". Set notation "maths" so it prints as a stacked fraction.`
    : `Question ${question} writes the fraction ${found} inline. Fractions print stacked: write it as ${/\d/.test(found) ? `{${found.replace(/ /g, "")}}` : "{numerator/denominator}"}${maths ? "" : ' and set document.notation to "maths"'} (a mixed number as 2{1/2}).`;

function noteInline(source: string, ctx: AnyCtx) {
  if (!ctx.inline || !ctx.where.question) return;
  const key = `${ctx.where.side}.${ctx.where.column}.${ctx.where.question}`;
  if (ctx.inline.has(key)) return;
  const found = inlineFraction(source, !!ctx.maths);
  if (found) ctx.inline.set(key, { side: ctx.where.side, column: ctx.where.column, question: ctx.where.question, message: fractionMessage(ctx.where.question, found, !!ctx.maths) });
}

function para(source: string, width: number, ctx: AnyCtx, opts: { size?: number; fill?: string; base?: FontStyle; x?: number } = {}): Frag {
  noteInline(source, ctx);
  const size = opts.size ?? S.body;
  const lines = wrap(source, size, width, opts.base, ctx.maths);
  const lh = lineBox(size);
  // W12: with maths notation on, fraction markup that did not parse is reported even when the text
  // has no stacked fraction: an unmatched brace, or braces round a slash that is not a fraction.
  // Set notation such as {1, 2, 3}, {1/2, 1/4} or {x : x/2 > 1} stays allowed in text without fractions.
  const loose = lines.map((l) => l.filter((r) => !r.frac).map((r) => r.text).join("")).join(" ");
  const unparsed = (loose.match(/\{/g)?.length ?? 0) !== (loose.match(/\}/g)?.length ?? 0) || /\{[^{}:,]*\/[^{}:,]*\}/.test(loose);
  if (ctx.maths && !lines.some(hasFraction) && unparsed) issue(ctx, "A brace is not part of a fraction. Write a stacked fraction as {3/4}.");
  if (!lines.some(hasFraction)) {
    const svg = lines.map((l, i) => textSvg(l, opts.x ?? 0, i * lh + baseline(size), size, opts.fill ?? ctx.st.ink)).join("");
    return { h: lines.length * lh, svg };
  }
  if (lines.some((l) => l.some((r) => !r.frac && /[{}]/.test(r.text)))) issue(ctx, "A brace is not part of a fraction. Write a stacked fraction as {3/4}.");
  const fh = fractionLine(size),
    fb = fractionBaseline(size);
  const svg = lines.map((l, i) => textSvg(l, opts.x ?? 0, i * fh + fb, size, opts.fill ?? ctx.st.ink)).join("");
  // Labels, bullets and tick boxes beside this text line up with its first baseline.
  return { h: lines.length * fh, svg, first: fb };
}

function table(item: Extract<Leaf, { type: "table" }>, w: number, ctx: AnyCtx): Frag {
  const size = S.body;
  const cellText = (c: Cell) => (c.state === "supplied" || (c.state === "hidden" && ctx.view === "answers") ? c.text : "");
  // Maths notation: fractions in cells and headings print stacked (1/3, 2½, {1/3}), and a row
  // holding one is one fraction line high in both copies. Plain sheets print exactly as before.
  const maths = !!ctx.maths;
  const shown = (t: string) => (maths ? stackAnswerText(t) : t);
  const cellWidth = (t: string, bold = false) =>
    maths ? lineWidth(parseRuns(shown(t), bold ? "bold" : "regular", true), size) : plainWidth(t, size, bold ? "bold" : "regular");
  const tall = (texts: string[]) => texts.some((t) => answerHasFraction(t, maths));
  const { head, body } = tableRows(item);
  const rowH = (r: Cell[]) => {
    const h = r.some((c) => c.state !== "supplied") ? S.tableAnswerRow : S.tableRow;
    return tall(r.map((c) => c.text)) ? Math.max(h, FRAC_TABLE_ROW) : h;
  };
  const headH = rowH(head);
  const natural = head.map((h, j) =>
    Math.max(cellWidth(h.text, true), ...body.map((r) => cellWidth(r[j]?.text ?? ""))) + 5,
  );
  const total = natural.reduce((a, b) => a + b, 0);
  if (total > w + 0.01) issue(ctx, `A table needs ${n(total - w)} mm more width than the column has.`);
  const roomy = natural.map((v) => Math.max(v, 14));
  // A table keeps its natural width (cells at least 14 mm), every cell centred, on worksheets as
  // in booklets (Tim, 16 Nov 2026); only a table too wide for that is stretched to the column.
  const compact = roomy.reduce((a, b) => a + b, 0) <= w;
  const widths = compact ? roomy : natural.map((v) => (v * w) / total);
  w = compact ? roomy.reduce((a, b) => a + b, 0) : w;
  const xs = widths.map((_, j) => widths.slice(0, j).reduce((a, b) => a + b, 0));
  const out: string[] = [];
  let y = 0;
  const row = (cells: { text: string; bold?: boolean; fill?: string }[], h: number, header: boolean) => {
    if (header) out.push(`<rect x="0" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${ctx.st.tableHead}"/>`);
    cells.forEach((c, j) => {
      if (!c.text) return;
      const line: Line = parseRuns(shown(c.text), c.bold ? "bold" : "regular", maths);
      const left = j === 0 && !compact;
      const cx = left ? xs[j] + 2 : xs[j] + widths[j] / 2;
      out.push(textSvg(line, cx, y + h / 2 + size * 0.34, size, c.fill ?? ctx.st.ink, left ? "start" : "middle"));
    });
    y += h;
  };
  // The heading row is bold; a hidden answer in it prints like any other, in the answer colour.
  row(head.map((c) => ({ text: cellText(c), bold: c.state === "supplied", fill: c.state === "hidden" ? ctx.st.answer : undefined })), headH, true);
  for (const r of body)
    row(
      r.map((c) => ({ text: cellText(c), fill: c.state === "hidden" ? ctx.st.answer : undefined })),
      rowH(r),
      false,
    );
  const grid: string[] = [`M0,0H${n(w)}V${n(y)}H0Z`];
  let yy = headH;
  grid.push(`M0,${n(yy)}H${n(w)}`);
  for (const r of body.slice(0, -1)) {
    yy += rowH(r);
    grid.push(`M0,${n(yy)}H${n(w)}`);
  }
  for (const x of xs.slice(1)) grid.push(`M${n(x)},0V${n(y)}`);
  out.push(`<path d="${grid.join("")}" fill="none" stroke="${ctx.st.rule}" stroke-width="0.35"/>`);
  return { h: y, svg: out.join("") };
}

/**
 * W12: a diagram that cannot be drawn stays on the page as a dashed box holding its specific
 * problem, so the teacher sees where it is and what to fix. The issue blocks every export.
 */
function brokenDiagram(message: string, w: number, ctx: AnyCtx): Frag {
  issue(ctx, message);
  const pad = 3;
  const text = para(`${message} Fix it in its editor, or replace it.`, w - 2 * pad, ctx, { size: S.body, x: pad });
  const h = Math.max(24, text.h + 2 * pad);
  return {
    h,
    svg: `<g data-broken-diagram="true"><rect x="0.3" y="0.3" width="${n(w - 0.6)}" height="${n(h - 0.6)}" fill="none" stroke="${ctx.st.ink}" stroke-width="0.6" stroke-dasharray="2 1.5"/><g transform="translate(0 ${n(pad)})">${text.svg}</g></g>`,
  };
}

function diagram(d: Diagram, w: number, ctx: AnyCtx): Frag {
  // The larger of the pupil and answer sizes is reserved so both views share one layout.
  let drawn: ReturnType<typeof drawDiagram>;
  try {
    const envelope = diagramEnvelope(d);
    drawn = drawDiagram(d.tool, envelope, ctx.view === "answers" ? "answer" : "pupil");
    // W90: a pupil copy never shows a saved answer.
    if (ctx.view !== "answers") for (const leak of answerLeaks(d.tool, envelope, drawn.svg)) issue(ctx, leak.message);
  } catch (error) {
    return brokenDiagram(`A diagram could not be drawn: ${error instanceof Error ? error.message : "unknown problem"}`, w, ctx);
  }
  let svg = drawn.svg;
  const open = svg.match(/^<svg[^>]*>/)?.[0] ?? "";
  const { widthMm: width, heightMm: height } = drawn;
  const own = svgSizeMm(svg);
  if (!(width > 0 && height > 0)) return brokenDiagram("A diagram did not report its physical size.", w, ctx);
  // A diagram may use the card's padding, but is never shrunk to fit.
  const room = w + 2 * (S.cardPad - 0.6);
  if (width > room + 0.01) issue(ctx, ctx.tooWide?.(d.tool, width, room) ?? tooWideMessage(d.tool, width, room, drawn.artworkWidthMm <= room + 0.01));
  const k = `d${++ctx.diagrams}-`;
  svg = svg
    .replace(/ id="/g, ` id="${k}`)
    .replace(/url\(#/g, `url(#${k}`)
    .replace(/href="#/g, `href="#${k}`)
    // Worksheet user units are millimetres, whatever unit the family's own SVG states.
    .replace(open, open.replace(/\swidth="[^"]*"/, ` width="${n(own.width)}"`).replace(/\sheight="[^"]*"/, ` height="${n(own.height)}" x="${n((w - own.width) / 2)}"`));
  return { h: height, svg };
}

/** Width (mm) one inline answer line needs: prefix, suffix and a line that holds its saved answer. */
export function answerNeed(l: Extract<Leaf, { type: "answerLine" }>, maths: boolean) {
  const widthOf = (s: string) => (maths ? lineWidth(parseRuns(stackAnswerText(s), "regular", true), S.body) : plainWidth(s, S.body));
  if (l.blanks) return answerFrame(widthOf, l.prefix, l.blanks, l.suffix).width;
  const pre = l.prefix ? widthOf(l.prefix) + 1.8 : 0;
  const post = l.suffix ? widthOf(l.suffix) + 1.8 : 0;
  return pre + post + Math.max(ANSWER_LINE_MIN, l.answer ? widthOf(l.answer) + 2 : 0);
}
/** Inset of model working inside a working space (answers copy). */
export const SPACE_WORKING = { x: 2, top: 1.5 } as const;
/** The lines of model working in a space: one paragraph per line break, blank lines dropped. */
export const workingLines = (answer: string) =>
  answer
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
/** Model working in a working space on the answers copy; reported when it needs more height than the space has. */
function spaceWorking(answer: string, w: number, h: number, ctx: AnyCtx): string {
  const out: string[] = [];
  let y = SPACE_WORKING.top;
  for (const line of workingLines(answer)) {
    const f = para(line, w - 2 * SPACE_WORKING.x, ctx, { fill: ctx.st.answer, x: SPACE_WORKING.x });
    out.push(at(f, 0, y));
    y += f.h;
  }
  if (y > h + 0.01) issue(ctx, `The model working in a space needs ${n(y)} mm but the space is ${n(h)} mm high. Make the space taller or the working shorter.`);
  return out.join("");
}

/** The texts on an answer line that may hold a stacked fraction. */
export const answerTexts = (l: Extract<Leaf, { type: "answerLine" }>) => [l.prefix, l.suffix, l.answer, ...(l.blanks ?? []).flatMap((b) => [b.before, b.answer])];

/** `lone`: a single inline line with no inline neighbours, printed short (rule P3). */
function answerRow(lines: Extract<Leaf, { type: "answerLine" }>[], w: number, ctx: AnyCtx, lone = false): Frag {
  const size = S.body;
  // Maths notation: fractions in the prefix, suffix and saved answer print stacked, and a row that
  // holds one is taller in both copies. Plain (older) sheets print exactly as before.
  const maths = !!ctx.maths;
  const runsOf = (s: string) => parseRuns(maths ? stackAnswerText(s) : s, "regular", maths);
  // Plain sheets keep their saved measurements exactly.
  const widthOf = (s: string) => (maths ? lineWidth(runsOf(s), size) : plainWidth(s, size));
  const tall = lines.some((l) => answerTexts(l).some((s) => answerHasFraction(s, maths)));
  const h = S.answerRow + (tall ? FRAC_ANSWER_EXTRA : 0);
  const base = h - 2.6;
  const one = lone ? lines[0] : null;
  const slot = one?.blanks
    ? Math.min(w, answerNeed(one, maths))
    : one
    ? loneSlot(one.prefix ? widthOf(one.prefix) + 1.8 : 0, one.suffix ? widthOf(one.suffix) + 1.8 : 0, one.answer ? widthOf(one.answer) : 0, w)
    : (w - (lines.length - 1) * ANSWER_SLOT_GAP) / lines.length;
  const out: string[] = [];
  lines.forEach((l, i) => {
    const x0 = i * (slot + ANSWER_SLOT_GAP);
    if (l.blanks) {
      out.push(frameSvg(l, x0, base, ctx));
      if (answerNeed(l, maths) > slot + 0.01) issue(ctx, `An answer frame needs ${n(answerNeed(l, maths) - slot)} mm more width than its row has. Give it a row of its own or a wider column.`);
      return;
    }
    const pre = l.prefix ? widthOf(l.prefix) + 1.8 : 0;
    const post = l.suffix ? widthOf(l.suffix) + 1.8 : 0;
    if (l.prefix) out.push(textSvg(runsOf(l.prefix), x0, base, size, ctx.st.ink));
    const x1 = x0 + pre,
      x2 = x0 + slot - post;
    if (x2 - x1 < ANSWER_LINE_MIN) issue(ctx, "An answer line is shorter than 18 mm.");
    // The saved answer is written on the line in the answers copy; it must not run past it.
    const answerW = l.answer ? widthOf(l.answer) : 0;
    if (l.answer && answerW + 2 > x2 - x1 + 0.01)
      issue(ctx, `A saved answer is ${n(answerW + 2 - (x2 - x1))} mm wider than its answer line, so it would run past the line in the answers copy. Shorten it or give it a longer line.`);
    out.push(`<line x1="${n(x1)}" y1="${n(base + 0.8)}" x2="${n(x2)}" y2="${n(base + 0.8)}" stroke="${ctx.st.ink}" stroke-width="0.3"/>`);
    if (l.suffix) out.push(textSvg(runsOf(l.suffix), x2 + 1.8, base, size, ctx.st.ink));
    // A stacked fraction answer is raised so its denominator clears the line.
    if ((ctx.view === "answers" || l.given) && l.answer)
      out.push(textSvg(runsOf(l.answer), x1 + 2, base - 0.6 - (answerHasFraction(l.answer, maths) ? FRAC_ANSWER_RAISE : 0), size, l.given ? ctx.st.ink : ctx.st.answer));
  });
  return { h, svg: out.join("") };
}

/**
 * An answer frame from x0 on the baseline: its fixed text and short blanks. The answers copy writes
 * each saved answer centred on its blank, in the answer colour; the pupil copy has the blanks only.
 */
function frameSvg(l: Extract<Leaf, { type: "answerLine" }>, x0: number, base: number, ctx: AnyCtx): string {
  const size = S.body;
  const maths = !!ctx.maths;
  const runsOf = (s: string) => parseRuns(maths ? stackAnswerText(s) : s, "regular", maths);
  const widthOf = (s: string) => (maths ? lineWidth(runsOf(s), size) : plainWidth(s, size));
  return answerFrame(widthOf, l.prefix, l.blanks ?? [], l.suffix)
    .pieces.map((p) => {
      if (p.kind === "text") return textSvg(runsOf(p.text), x0 + p.x, base, size, ctx.st.ink);
      const line = `<line x1="${n(x0 + p.x)}" y1="${n(base + 0.8)}" x2="${n(x0 + p.end)}" y2="${n(base + 0.8)}" stroke="${ctx.st.ink}" stroke-width="0.3"/>`;
      if ((ctx.view !== "answers" && !l.given) || !p.answer) return line;
      return line + textSvg(runsOf(p.answer), x0 + (p.x + p.end) / 2, base - 0.6 - (answerHasFraction(p.answer, maths) ? FRAC_ANSWER_RAISE : 0), size, l.given ? ctx.st.ink : ctx.st.answer, "middle");
    })
    .join("");
}

function choice(item: Extract<Leaf, { type: "choice" }>, w: number, ctx: AnyCtx): Frag {
  const size = S.body;
  const show = ctx.view === "answers" ? item.answer : null;
  const out: string[] = [];
  if (item.mode === "circle") {
    // Maths notation: a fraction option prints stacked, in a taller row with a taller ring.
    const maths = !!ctx.maths;
    const tall = item.options.some((o) => answerHasFraction(o, maths));
    const runsOf = (o: string) => parseRuns(maths ? stackAnswerText(o) : o, "bold", maths);
    let x = 2;
    const y = tall ? FRAC_CIRCLE_ROW - 3.6 : 6;
    item.options.forEach((o, i) => {
      const ow = maths ? lineWidth(runsOf(o), size) : plainWidth(o, size, "bold");
      out.push(textSvg(runsOf(o), x, y, size, ctx.st.ink));
      const frac = answerHasFraction(o, maths);
      if (show === i)
        out.push(
          `<ellipse cx="${n(x + ow / 2)}" cy="${n(y - size * (frac ? 0.27 : 0.33))}" rx="${n(ow / 2 + 2.2)}" ry="${n(frac ? 4.2 : size * 0.9)}" fill="none" stroke="${ctx.st.answer}" stroke-width="0.4"/>`,
        );
      x += ow + 9;
    });
    if (x - 9 > w) issue(ctx, "Circle-one options are wider than the card.");
    return { h: tall ? FRAC_CIRCLE_ROW : 8.5, svg: out.join("") };
  }
  if (item.mode === "letters") return letters(item, w, ctx, show);
  let y = 0;
  item.options.forEach((o, i) => {
    const f = para(o, w - S.tickBox - 2.6, ctx, { x: S.tickBox + 2.6 });
    const by = (lineBox(size) - S.tickBox) / 2 + (f.first ?? baseline(size)) - baseline(size);
    out.push(`<g transform="translate(0,${n(y)})"><rect x="0" y="${n(by)}" width="${S.tickBox}" height="${S.tickBox}" fill="none" stroke="${ctx.st.ink}" stroke-width="0.3"/>${f.svg}`);
    if (show === i)
      out.push(`<path d="M0.8,${n(by + 2.1)}L1.8,${n(by + 3.2)}L3.4,${n(by + 0.8)}" fill="none" stroke="${ctx.st.answer}" stroke-width="0.5"/>`);
    out.push("</g>");
    y += f.h + 1.2;
  });
  return { h: y - 1.2, svg: out.join("") };
}

/** Lettered options (A to D) for hinge questions (booklet standard N6, Tim 17 November 2026). */
export const LETTERS = {
  /** The letter's ring. */
  r: 2.5,
  /** From the ring to the option. */
  gap: 1.8,
  /** Between columns. */
  colGap: 6,
  /** Between rows, so pupils can circle an option without touching the one below. */
  rowGap: 4,
  /** Narrower than this (options beside a diagram), options that do not fit one row take one column. */
  narrow: 60,
} as const;
/**
 * How many equal columns lettered options take: all in one row when each fits a slot of that
 * width, otherwise two columns, otherwise one. Equal slots spread the options across the card.
 */
export function letterColumns(widths: number[], w: number): number {
  const L = LETTERS;
  const fits = (k: number) => Math.max(...widths) <= (w - (k - 1) * L.colGap) / k;
  // In a narrow space (options beside a diagram) a 2 by 2 block crowds the letters together, so
  // they go one under another, each with room to circle.
  return fits(widths.length) ? widths.length : w >= LETTERS.narrow && fits(2) ? 2 : 1;
}
/** An option's printed width on one line, its letter ring included. */
export const letterOptionWidth = (o: string, maths: boolean) => 2 * LETTERS.r + LETTERS.gap + lineWidth(wrap(o, S.body, 1e6, "regular", maths)[0] ?? [], S.body);

/**
 * Lettered options in equal columns. In each row every letter and every option sits on one
 * baseline, and a stacked fraction is centred on that line, so nothing goes up and down.
 */
function letters(item: Extract<Leaf, { type: "choice" }>, w: number, ctx: AnyCtx, show: number | null): Frag {
  const size = S.body,
    { r, gap, colGap, rowGap } = LETTERS;
  const out: string[] = [];
  const perRow = letterColumns(
    item.options.map((o) => letterOptionWidth(o, !!ctx.maths)),
    w,
  );
  const slot = (w - (perRow - 1) * colGap) / perRow;
  let y = 0;
  for (let start = 0; start < item.options.length; start += perRow) {
    const row = item.options.slice(start, start + perRow).map((o) => para(o, slot - 2 * r - gap + 0.5, ctx, { x: 2 * r + gap }));
    // The row's one baseline: the lowest first baseline of its options (a stacked fraction's line).
    const line = Math.max(...row.map((f) => f.first ?? baseline(size)));
    const cy = line - size * 0.34;
    let rowH = 0;
    row.forEach((f, k) => {
      const i = start + k;
      const drop = line - (f.first ?? baseline(size));
      const mark = show === i;
      out.push(`<g transform="translate(${n(k * (slot + colGap))},${n(y)})">`);
      out.push(`<circle cx="${r}" cy="${n(cy)}" r="${r}" fill="${mark ? ctx.st.answer : "white"}" stroke="${mark ? ctx.st.answer : ctx.st.navy}" stroke-width="0.35"/>`);
      out.push(textSvg([{ text: String.fromCharCode(65 + i), style: "bold" }], r, cy + size * 0.34, S.body * 0.9, mark ? "white" : ctx.st.navy, "middle"));
      out.push(at(f, 0, drop), "</g>");
      rowH = Math.max(rowH, drop + f.h + (f.first === undefined ? 0 : FRAC_FOOT));
    });
    y += rowH + (start + perRow < item.options.length ? rowGap : 0);
  }
  return { h: y, svg: out.join("") };
}

function leaf(item: Leaf, w: number, ctx: AnyCtx, extra: number): Frag {
  const st = ctx.st;
  switch (item.type) {
    case "text":
      return para(item.text, w, ctx);
    case "info": {
      const pad = 2.4;
      const f = para(item.text, w - pad * 2, ctx, { x: pad });
      return { h: f.h + pad * 2, svg: `<rect width="${n(w)}" height="${n(f.h + pad * 2)}" rx="1.2" fill="${st.tint}"/><rect width="0.9" height="${n(f.h + pad * 2)}" fill="${st.navy}"/>${at(f, 0, pad)}` };
    }
    case "claim": {
      const f = para(`“${item.text}”`, w - 5, ctx, { x: 4.2, base: "italic" });
      return { h: f.h + 1, svg: `<rect x="0.6" y="0" width="0.8" height="${n(f.h + 1)}" fill="${st.navy}"/>${at(f, 0, 0.5)}` };
    }
    case "bullets": {
      let y = 0;
      const out: string[] = [];
      for (const b of item.items) {
        const f = para(b, w - 5, ctx, { x: 5 });
        out.push(at(f, 0, y), textSvg([{ text: "•", style: "regular" }], 1.2, y + (f.first ?? baseline(S.body)), S.body, st.ink));
        y += f.h;
      }
      return { h: y, svg: out.join("") };
    }
    case "table":
      return table(item, w, ctx);
    case "choice":
      return choice(item, w, ctx);
    case "answerLine":
      return answerRow([item], w, ctx);
    case "space": {
      const h = item.heightMm + extra;
      if (ctx.view !== "answers" || !item.answer?.trim()) return { h, svg: "" };
      return { h, svg: spaceWorking(item.answer, w, h, ctx) };
    }
    case "diagram":
      return diagram(item.diagram, w, ctx);
    case "paper": {
      if (item.widthMm > w + 0.01) issue(ctx, `The grid paper is ${n(item.widthMm)} mm wide; the card has ${n(w)} mm. Grids are never shrunk to fit.`);
      return { h: item.heightMm, svg: `<g transform="translate(${n((w - item.widthMm) / 2)},0)">${paperSvg(item, st)}</g>` };
    }
    case "steps": {
      // A hanging indent keeps each step's text clear of its label.
      const labels = item.steps.map((s, i) => (s.label.trim() || `Step ${i + 1}`) + ":");
      const indent = Math.min(Math.max(...labels.map((l) => plainWidth(l, S.body, "bold"))) + 2, w * 0.35);
      let y = 0;
      const out: string[] = [];
      item.steps.forEach((s, i) => {
        const f = para(s.text, w - indent, ctx, { x: indent });
        out.push(at(f, 0, y), textSvg([{ text: labels[i], style: "bold" }], 0, y + (f.first ?? baseline(S.body)), S.body, st.navy));
        y += f.h + (i < item.steps.length - 1 ? 1.2 : 0);
      });
      return { h: y, svg: out.join("") };
    }
    case "checklist": {
      let y = 0;
      const out: string[] = [];
      item.items.forEach((t, i) => {
        const f = para(t, w - S.tickBox - 2.6, ctx, { x: S.tickBox + 2.6 });
        const by = (lineBox(S.body) - S.tickBox) / 2 + (f.first ?? baseline(S.body)) - baseline(S.body);
        out.push(`<rect x="0" y="${n(y + by)}" width="${S.tickBox}" height="${S.tickBox}" rx="0.6" fill="none" stroke="${st.navy}" stroke-width="0.35"/>`, at(f, 0, y));
        y += f.h + (i < item.items.length - 1 ? 0.8 : 0);
      });
      return { h: y, svg: out.join("") };
    }
  }
}

/** A card's items laid out in a column `w` wide, without the card frame (silent starters draw their own slots). */
export function items(list: Item[], w: number, ctx: AnyCtx, extra: number): Frag {
  const frags: Frag[] = [];
  let part = 0;
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    if (it.type === "answerLine" && it.inline) {
      const group = [it];
      while (list[i + 1]?.type === "answerLine" && (list[i + 1] as typeof it).inline) group.push(list[++i] as typeof it);
      for (const rowLines of (ctx.maths ? packAnswerLines(group, w, (l) => answerNeed(l, true)) : [group])) frags.push(answerRow(rowLines, w, ctx, group.length === 1));
    } else if (it.type === "part") {
      const label = partLabel(part++, ctx.romanParts);
      // An answer frame always takes a row of its own.
      const only = it.items.length === 1 && it.items[0].type === "answerLine" && !it.items[0].inline && !it.items[0].blanks ? it.items[0] : null;
      const textW = w - S.partIndent;
      const wrapped = wrap(it.text, S.body, textW, "regular", ctx.maths);
      const lastW = lineWidth(wrapped[wrapped.length - 1], S.body);
      if (only && !only.prefix && !wrapped.some(hasFraction) && ![only.suffix, only.answer].some((t) => answerHasFraction(t, !!ctx.maths)) && stubFits(textW - lastW - 3 - (only.suffix ? plainWidth(only.suffix, S.body) + 1.8 : 0), only.answer, S.body, !!ctx.maths)) {
        // A short answer goes on the question's last line, which grows to a full answer row.
        const lift = S.answerRow - lineBox(S.body);
        const head = para(it.text, textW, ctx, { x: S.partIndent });
        const row = answerRow([only], textW - lastW - 3, ctx);
        const svg =
          `<g transform="translate(0,${n(lift)})">` +
          textSvg([{ text: label, style: "regular" }], 0, baseline(S.body), S.body, ctx.st.ink) +
          head.svg +
          "</g>" +
          at(row, S.partIndent + lastW + 3, head.h - lineBox(S.body) + lift - (S.answerRow - 2.6 - baseline(S.body)));
        frags.push({ h: head.h + lift, svg });
        continue;
      }
      const head = para(it.text, textW, ctx, { x: S.partIndent });
      const sub = it.items.length ? items(it.items, w - S.partIndent, ctx, extra) : { h: 0, svg: "" };
      const svg = textSvg([{ text: label, style: "regular" }], 0, head.first ?? baseline(S.body), S.body, ctx.st.ink) + head.svg + at(sub, S.partIndent, head.h + S.itemGap);
      frags.push({ h: head.h + (sub.h ? S.itemGap + sub.h : 0), svg });
    } else if ((list[i + 1] as Leaf | undefined)?.beside) {
      const right = list[++i] as Leaf;
      const lay = besideLayout(it, right, w, ctx);
      if (lay.problem) issue(ctx, lay.problem);
      const a = leaf(it, lay.left, ctx, 0);
      const b = leaf(right, lay.right, ctx, 0);
      const place = besideTops(it, right, a, b);
      const h = place.h + besideExtra(it, right, extra);
      // Text beside a ratio table drops to its bottom row; an answer line beside a working space
      // sits at the bottom of the space, as it does under one.
      const top = (f: Frag, item: Leaf, other: Leaf, k: 0 | 1) => (besideBottom(item, other) ? h - f.h : place.tops[k]);
      frags.push({ h, svg: at(a, lay.offset, top(a, it, right, 0)) + at(b, lay.offset + lay.left + BESIDE_GAP, top(b, right, it, 1)) });
    } else frags.push(leaf(it, w, ctx, extra));
  }
  let y = 0;
  const svg = frags
    .map((f, i) => {
      const s = at(f, 0, y);
      y += f.h + (i < frags.length - 1 ? S.itemGap : 0);
      return s;
    })
    .join("");
  return { h: y, svg };
}

/** The gap between two items that share a row (beside: true), in mm. */
export const BESIDE_GAP = 4;
/** The narrowest text or other flowing item beside a diagram, in mm. */
export const BESIDE_MIN = 25;

/** The printed width of a diagram or grid paper, which never changes; null for flowing items. */
export function fixedWidth(item: Leaf, ctx: AnyCtx): number | null {
  if (item.type === "paper") return item.widthMm;
  if (item.type !== "diagram") return null;
  try {
    return drawDiagram(item.diagram.tool, diagramEnvelope(item.diagram), ctx.view === "answers" ? "answer" : "pupil").widthMm;
  } catch {
    return null;
  }
}

/**
 * Two items in one row: a diagram or grid paper keeps its printed width and a flowing item takes
 * the rest of the row; two flowing items share it equally. A diagram on the right is centred in
 * the room left of it. As a single diagram may, a row too wide for the card may use the card's
 * padding: it is then centred, spilling evenly both sides (`offset`), and anything wider still is
 * reported. Shared by the SVG and Word writers, so both lay the row out the same.
 */
export function besideLayout(a: Leaf, b: Leaf, w: number, ctx: AnyCtx): { left: number; right: number; offset: number; problem?: string } {
  const fa = fixedWidth(a, ctx),
    fb = fixedWidth(b, ctx);
  const left = fa ?? (fb !== null ? Math.max(BESIDE_MIN, w - BESIDE_GAP - fb) : (w - BESIDE_GAP) / 2);
  const right = Math.max(fb ?? BESIDE_MIN, w - left - BESIDE_GAP);
  const total = left + BESIDE_GAP + right;
  const pad = 2 * (S.cardPad - 0.6);
  const problem =
    total > w + pad + 0.01
      ? `Two items side by side need ${n(total - w - pad)} mm more width than the card has (${n(w + pad)} mm, using its padding as a single diagram may). Diagrams are never shrunk to fit: remove beside to stack them, use a smaller diagram, or use a wider column layout.`
      : undefined;
  return { left, right, offset: total > w ? -(total - w) / 2 : 0, problem };
}

/** The baseline of a ratio table's bottom row above the table's foot (mm), or null for any other item. */
function ratioFoot(l: Leaf): number | null {
  if (l.type !== "diagram" || l.diagram.tool !== "ratio-table") return null;
  try {
    return ratioBottomBaselineMm((diagramEnvelope(l.diagram) as { document: Parameters<typeof ratioBottomBaselineMm>[0] }).document);
  } catch {
    return null;
  }
}
/** The baseline of an item's text, from the item's top (mm): an answer line or one line of text only. */
function lastBaseline(l: Leaf, f: Frag): number | null {
  if (l.type === "answerLine") return f.h - 2.6;
  // Only a one-line text drops to the bottom row ("Gradient = 3"): a longer passage beside a table reads from the top.
  if (l.type !== "text" || f.h > (f.first !== undefined ? fractionLine(S.body) : lineBox(S.body)) + 0.01) return null;
  return f.first !== undefined ? f.h - fractionLine(S.body) + f.first : f.h - lineBox(S.body) + baseline(S.body);
}
/**
 * Where the two items of a row sit: both at the top, except an answer line or one line of text beside a ratio
 * table, which is level with the table's bottom row, because the answer comes from that
 * row ("Gradient =", booklet standard N5, Tim 17 November 2026).
 */
export function besideTops(a: Leaf, b: Leaf, fa: Frag, fb: Frag): { h: number; tops: [number, number] } {
  const level = (table: Leaf, ft: Frag, other: Leaf, fo: Frag): [number, number] | null => {
    const foot = ratioFoot(table),
      line = lastBaseline(other, fo);
    if (foot === null || line === null) return null;
    const offset = ft.h - foot - line;
    return offset >= 0 ? [0, offset] : [-offset, 0];
  };
  const ab = level(a, fa, b, fb);
  const ba = ab ? null : level(b, fb, a, fa);
  const tops: [number, number] = ab ?? (ba ? [ba[1], ba[0]] : [0, 0]);
  return { h: Math.max(tops[0] + fa.h, tops[1] + fb.h), tops };
}
/** A row of two items as the page draws it, without spare height: Word pins its row and places its cells from this. */
export function besidePlacement(a: Leaf, b: Leaf, ctx: AnyCtx, w: number): { h: number; tops: [number, number] } {
  const lay = besideLayout(a, b, w, ctx);
  const quiet: AnyCtx = { ...ctx, issues: [], diagrams: 0, inline: undefined };
  return besideTops(a, b, leaf(a, lay.left, quiet, 0), leaf(b, lay.right, quiet, 0));
}
/** The height of a row of two items without spare height, as the page draws it; Word pins its row to this. */
export const besideHeight = (a: Leaf, b: Leaf, ctx: AnyCtx, w: number): number => besidePlacement(a, b, ctx, w).h;

/** A row of two items: both are measured without spare height, and the row takes the spare height once if either holds a space. */
export const besideExtra = (a: Leaf, b: Leaf, extra: number) => (a.type === "space" || b.type === "space" ? extra : 0);
/** In a row of two, an answer line beside a space is aligned to the row's bottom, like the space's own last line. */
export const besideBottom = (item: Leaf, other: Leaf) => item.type === "answerLine" && other.type === "space";

/**
 * How many shares of spare height a list of items takes: one per working or drawing space, but
 * one for a row of two items (beside) that holds any space, since the row grows once.
 */
export function countSpaces(list: Item[]): number {
  let c = 0;
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    if (it.type === "part") c += countSpaces(it.items);
    else if ((list[i + 1] as Leaf | undefined)?.beside) {
      // A row of two items, paired as items() pairs them, takes one share if either is a space.
      const b = list[++i] as Leaf;
      if (it.type === "space" || b.type === "space") c++;
    } else if (it.type === "space") c++;
  }
  return c;
}

/** Families whose printed width is set by spec.widthCm. */
const WIDTH_CM = new Set(["number-line", "venn", "triangle"]);
/** The issue for a diagram wider than its card, with the change that makes it fit. */
export function tooWideMessage(tool: string, width: number, room: number, workedMargin = false): string {
  if (workedMargin)
    return `A diagram with its worked notes in the margin beside it is ${n(width)} mm wide; the card has ${n(room)} mm. Diagrams are never shrunk to fit. Move the notes inside the diagram or closer to it, or use a wider column layout.`;
  const fit = Math.floor(room / 5) / 2;
  const hint = WIDTH_CM.has(tool)
    ? ` Set the ${tool}'s widthCm to ${fit} or less, or use a wider column layout.`
    : tool === "frequency-tree"
      ? " Reduce the tree's settings.branchMm (30 fits a two-level frequency tree in a three-column card), or use a wider column layout."
      : tool === "probability-tree"
        ? ` Reduce the tree's settings.branchMm (each stage gets 1 mm narrower per 1 mm; the minimum is 20), drop the end probability column (settings.endColumn "outcome" or "none"), or use a wider column layout. A three-stage tree with both end columns needs a wider column.`
      : tool === "construction"
        ? " Constructions print at true size: reduce the drawing's widthCm (and move points inside it), or use a wider column layout."
      : tool === "elevations"
        ? " Use settings.maxWidthCm to wrap the panels onto more rows, a smaller unitCm, or a wider column layout."
      : " Use a wider column layout (two, wide-narrow or narrow-wide) or a smaller diagram.";
  return `A diagram is ${n(width)} mm wide; the card has ${n(room)} mm. Diagrams are never shrunk to fit.${hint}`;
}

/**
 * One framed question card. A null number leaves out the number tile (worked examples, notes). A
 * letter (a lettered booklet question) prints in the tile and makes its parts i), ii).
 */
export function card(c: Card, number: number | string | null, w: number, ctx: AnyCtx, extra: number, stretch: number): Frag {
  const st = ctx.st,
    pad = S.cardPad;
  const roman = ctx.romanParts;
  ctx.romanParts = typeof number === "string";
  let body: Frag;
  try {
    body = items(c.items, w - pad * 2, ctx, extra);
  } finally {
    ctx.romanParts = roman;
  }
  const top = pad + S.tile + S.itemGap;
  const h = top + body.h + pad + stretch;
  const out: string[] = [];
  const titleY = pad + S.tile / 2 + S.cardTitle * 0.36;
  // A white framed card with a soft-blue number tile, as on the MathsDock home page.
  out.push(`<rect x="0.15" y="0.15" width="${n(w - 0.3)}" height="${n(h - 0.3)}" rx="2" fill="white" stroke="${st.rule}" stroke-width="0.45"/>`);
  const titleX = number === null ? pad : pad + S.tile + 2.8;
  if (number !== null) {
    out.push(`<rect x="${pad}" y="${pad}" width="${S.tile}" height="${S.tile}" rx="1.3" fill="${st.navy}"/>`);
    out.push(textSvg([{ text: String(number), style: "bold" }], pad + S.tile / 2, titleY, S.cardTitle, "white", "middle"));
  }
  out.push(textSvg(parseRuns(c.title, "bold"), titleX, titleY, S.cardTitle, st.navy));
  if (plainWidth(c.title, S.cardTitle, "bold") > w - titleX - pad) issue(ctx, "The card title is wider than the card.");
  out.push(at(body, pad, top));
  return { h, svg: out.join("") };
}

export const overflowMessage = (s: number, c: number, spare: number) =>
  `Column ${c + 1} on side ${s + 1} needs ${n(-spare)} mm more height. Move a question or reduce working space; text is never shrunk.`;

/**
 * Measures a column of cards, then shares its spare height between the working and drawing
 * spaces. With none, `share` gives every question card (not a reminder card) an equal share at its foot as working room;
 * otherwise (saved sheets from before) the last card reaches the foot. Shared by the SVG and
 * Word writers.
 */
export function planColumn(cards: Card[], numbers: (number | null)[], w: number, avail: number, ctx: AnyCtx, share = false): { spare: number; extra: number; stretch: (i: number) => number } {
  const quiet: AnyCtx = { ...ctx, issues: [], diagrams: 0, inline: undefined };
  const natural = cards.map((cd, i) => card(cd, numbers[i], w, quiet, 0, 0).h);
  const used = natural.reduce((a, b) => a + b, 0) + Math.max(0, cards.length - 1) * S.cardGap + stagedCards(cards) * STAGE_BAND;
  const spare = avail - used;
  const spaces = cards.reduce((k, cd) => k + countSpaces(cd.items), 0);
  const extra = spare > 0 && spaces ? spare / spaces : 0;
  const free = spare > 0 && !spaces ? spare : 0;
  // A reminder card (key facts only, nothing to answer) needs no working room, so with `share` the
  // spare height goes to the question cards; a column of reminders alone shares it as before.
  const questions = cards.map((cd, i) => (isReminder(cd) ? -1 : i)).filter((i) => i >= 0);
  const takers = questions.length ? questions : cards.map((_, i) => i);
  const stretch = (i: number) => (share ? (takers.includes(i) ? free / takers.length : 0) : i === cards.length - 1 ? free : 0);
  return { spare, extra, stretch };
}

/** A card holding only key-fact (info) items: a reminder, with nothing for the pupil to answer. */
export const isReminder = (cd: Card) => cd.items.length > 0 && cd.items.every((it) => it.type === "info");

/** A column more than this fraction blank (before spare height is shared out) gets a space note. */
export const SPARSE_COLUMN = 1 / 3;
export const sparseMessage = (s: number, c: number, blank: number) =>
  `Column ${c + 1} on side ${s + 1} is about ${Math.round(blank * 100)}% blank. If more working space is not the intent, consider proposing another question for it.`;

/** A stage band inside a column: the heading band and the gap to the first card below it. */
export const STAGE_BAND = S.columnHeadingBand + 2.5;
/** Cards that start a new stage band. The first card of a column sits under the column heading. */
const stagedCards = (cards: Card[]) => cards.filter((cd, i) => i > 0 && cd.stage).length;

/** Stage letters A to Z, then AA, AB and so on. */
const stageLetter = (k: number): string => (k < 26 ? String.fromCharCode(65 + k) : stageLetter(Math.floor(k / 26) - 1) + String.fromCharCode(65 + (k % 26)));

/**
 * The stage letters, in reading order across both sides: each column heading takes the next
 * letter, and so does each card that starts a stage band. With three plain columns a side this is
 * A to C on side 1 and D to F on side 2, as before.
 */
export function stageLetters(resource: Resource): { columns: string[][]; cards: (string | null)[][][] } {
  let k = 0;
  const columns: string[][] = [];
  const cards: (string | null)[][][] = [];
  for (const side of resource.document.sides) {
    columns.push([]);
    cards.push([]);
    for (const col of side.columns) {
      columns[columns.length - 1].push(stageLetter(k++));
      cards[cards.length - 1].push(col.cards.map((cd, i) => (i > 0 && cd.stage ? stageLetter(k++) : null)));
    }
  }
  return { columns, cards };
}

/**
 * Where each column of a side sits: widths are thirds of the page (LAYOUTS), so a wide column
 * covers two thirds and the gutter between them. Three columns give the original grid exactly.
 */
export function columnBoxes(side: Pick<Side, "layout">): { x: number; w: number }[] {
  const third = (S.page.width - S.margin * 2 - S.gutter * 2) / 3;
  let t = 0;
  return LAYOUTS[side.layout].map((k) => {
    const box = { x: S.margin + t * (third + S.gutter), w: k * third + (k - 1) * S.gutter };
    t += k;
    return box;
  });
}

/** The score box text pieces, measured once for the SVG and Word headers. */
export function scoreBox(score: number, sideNumber: number): { label: string; total: string; lineMm: number; lineEnd: number } {
  const sideW = plainWidth(`Side ${sideNumber} of 2`, S.objective);
  const total = `/ ${score}`;
  // Measured from the right edge of the page content: the side label, a gap, then the total.
  return { label: "Score", total, lineMm: 16, lineEnd: sideW + 8 + plainWidth(total, S.objective) + 1 };
}
/** Room to the left of the header's right-hand block, which holds the group, name and score. */
export const HEADER_RIGHT = 90;

/** A stage tile and heading, as at the top of each column. `y` is the top of the band. */
function stageSvg(letter: string, heading: string, x: number, y: number, st: HouseStyle): string {
  const tileY = y + (S.columnHeadingBand - S.tile) / 2;
  return (
    `<rect x="${n(x)}" y="${n(tileY)}" width="${S.tile}" height="${S.tile}" rx="1.3" fill="${st.navy}"/>` +
    textSvg([{ text: letter, style: "bold" }], x + S.tile / 2, tileY + S.tile / 2 + S.columnHeading * 0.36, S.columnHeading, "white", "middle") +
    textSvg(parseRuns(heading, "bold"), x + S.tile + 2.8, tileY + S.tile / 2 + S.columnHeading * 0.36, S.columnHeading, st.navy)
  );
}

/**
 * Blank grid paper, drawn at its printed size from the bottom-left corner: squared (5 mm),
 * dotted (5 mm) or graph paper (2 mm, bold every 10 mm). Optional blank axes carry only arrows,
 * the letters x and y, and O: pupils choose and write their own scale.
 */
export function paperSvg(item: Extract<Leaf, { type: "paper" }>, st: HouseStyle): string {
  const { widthMm: W, heightMm: H } = item;
  const pitch = item.style === "graph" ? 2 : 5;
  const out: string[] = [];
  const xs: number[] = [],
    ys: number[] = [];
  for (let k = 0; k * pitch <= W + 1e-6; k++) xs.push(k * pitch);
  for (let k = 0; k * pitch <= H + 1e-6; k++) ys.push(H - k * pitch);
  if (item.style === "dotted") {
    out.push(`<g fill="${st.rule}">${xs.flatMap((x) => ys.map((y) => `<circle cx="${n(x)}" cy="${n(y)}" r="0.3"/>`)).join("")}</g>`);
  } else {
    const thin = item.style === "graph" ? { c: "#b4bcc6", w: 0.1 } : { c: "#a3acb8", w: 0.18 };
    const bold = (k: number) => item.style === "graph" && k % 5 === 0;
    const path = (pick: (k: number) => boolean) =>
      xs.flatMap((x, k) => (pick(k) ? [`M${n(x)} 0V${n(H)}`] : [])).join("") + ys.flatMap((y, k) => (pick(k) ? [`M0 ${n(y)}H${n(W)}`] : [])).join("");
    out.push(`<path d="${path((k) => !bold(k))}" fill="none" stroke="${thin.c}" stroke-width="${thin.w}"/>`);
    if (item.style === "graph") out.push(`<path d="${path(bold)}" fill="none" stroke="${st.rule}" stroke-width="0.25"/>`);
  }
  out.push(`<rect x="0" y="0" width="${n(W)}" height="${n(H)}" fill="none" stroke="${st.rule}" stroke-width="0.3"/>`);
  if (item.axes) {
    const snap = (v: number, max: number) => Math.min(Math.max(Math.round(v / pitch) * pitch, 0), Math.floor(max / pitch) * pitch);
    const ox = snap(item.axes.originMm.x, W),
      oy = H - snap(item.axes.originMm.y, H);
    const a = 1.6;
    out.push(
      `<path d="M0 ${n(oy)}H${n(W - 0.4)}M${n(ox)} ${n(H)}V0.4" fill="none" stroke="${st.ink}" stroke-width="0.35"/>`,
      `<path d="M${n(W)} ${n(oy)}l${-a * 1.6} ${-a * 0.6}v${a * 1.2}z M${n(ox)} 0l${-a * 0.6} ${a * 1.6}h${a * 1.2}z" fill="${st.ink}"/>`,
    );
    const size = S.body;
    const xBelow = H - oy >= 5;
    out.push(textSvg([{ text: item.axes.xLabel, style: "italic" }], W - 1.2, xBelow ? oy + 4.2 : oy - 1.6, size, st.ink, "end"));
    const yRight = W - ox >= 6;
    out.push(textSvg([{ text: item.axes.yLabel, style: "italic" }], yRight ? ox + 2 : ox - 2, 4.6, size, st.ink, yRight ? "start" : "end"));
    if (ox >= 4 && H - oy >= 5) out.push(textSvg([{ text: "O", style: "italic" }], ox - 1, oy + 4.2, size, st.ink, "end"));
  }
  return out.join("");
}

/** Printed text fields: hidden worked solutions ("working") and diagrams are not printed text. */
const PRINTED = new Set(["text", "title", "heading", "startBanner", "endBanner", "prefix", "suffix", "answer", "before", "label", "instruction", "objective", "code", "group", "items", "options", "keyIdea", "didYouKnow", "coverNote", "word", "meaning", "remember", "learn", "next"]);
/** The printed characters in a document part that the worksheet font does not hold, each once. */
export function missingCharacters(value: unknown): string[] {
  const known = measuredWidths("regular");
  const found = new Set<string>();
  const scan = (v: unknown, key = "") => {
    if (typeof v === "string") {
      if (!PRINTED.has(key)) return;
      for (const c of v) if (!(c in known) && c !== "\n") found.add(c);
    } else if (Array.isArray(v)) v.forEach((x) => scan(x, key));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (k !== "diagram" && k !== "working") scan(x, k);
  };
  scan(value);
  return [...found];
}
const charName = (c: string) => `"${c}" (U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")})`;
/** The issue text for a character the font lacks; `where` names the place, e.g. "Question 3". */
export const missingCharacterMessage = (where: string, c: string) =>
  `${where} uses ${charName(c)}, which the worksheet font does not have, so it would print as a gap. Write it another way (for example in words${c >= "\u2150" && c <= "\u215f" ? ", or as a stacked fraction such as {1/3} with maths notation" : ""}).`;
/**
 * A character the worksheet font does not hold would print as a gap in the PDF and as a
 * substitute font in Word, so it is reported as an issue, once per character and question.
 */
export function missingGlyphIssues(resource: Resource): Issue[] {
  const found = new Map<string, Issue>();
  type Where = Omit<Issue, "message">;
  const report = (value: unknown, where: Where) => {
    for (const c of missingCharacters(value)) {
      const id = `${c}.${where.side}.${where.question ?? 0}`;
      if (!found.has(id)) found.set(id, { ...where, message: missingCharacterMessage(where.question ? `Question ${where.question}` : "The header", c) });
    }
  };
  const d = resource.document;
  report({ title: d.title, objective: d.objective, code: d.code, group: d.group }, { side: 1, column: 0 });
  let question = 0;
  d.sides.forEach((side, s) => {
    report({ instruction: side.instruction }, { side: s + 1, column: 0 });
    side.columns.forEach((col, c) => {
      report({ heading: col.heading }, { side: s + 1, column: c + 1 });
      for (const card of col.cards) report(card, { side: s + 1, column: c + 1, question: ++question });
    });
  });
  return [...found.values()];
}

export function renderResource(saved: Resource, options: RenderOptions = {}): Rendered {
  const resource = typesetForPrint(saved);
  const doc = resource.document;
  const st = styles[options.style ?? "mathsdock"];
  const ctx: Ctx<{ side: number; column: number; question?: number }> = {
    st,
    view: options.view ?? "pupil",
    diagrams: 0,
    issues: [],
    where: { side: 0, column: 0, question: 0 },
    maths: doc.notation === "maths",
    inline: new Map(),
  };
  ctx.issues.push(...missingGlyphIssues(resource));
  const P = S.page,
    m = S.margin;
  const colTop = m + S.headerHeight;
  const cardsTop = colTop + S.columnHeadingBand + 2.5;
  const avail = P.height - m - cardsTop;
  let number = 0;
  const notes: Issue[] = [];
  const letters = stageLetters(resource);
  const pages = doc.sides.map((side, s) => {
    const out: string[] = [];
    // Header: title, objective and instruction left; group, name line and side right; a hairline below.
    out.push(textSvg(parseRuns(doc.title, "bold"), m, m + 6.6, S.title, st.navy));
    const objective = [doc.code, doc.objective].filter(Boolean).join(" • ");
    out.push(textSvg(parseRuns(objective), m, m + 12.2, S.objective, st.muted));
    if (side.instruction) out.push(textSvg(parseRuns(side.instruction), m, m + 16.4, S.objective, st.ink));
    const right = P.width - m;
    if (doc.group) {
      const gw = plainWidth(doc.group, S.objective, "bold") + 5;
      out.push(`<rect x="${n(right - gw)}" y="${n(m)}" width="${n(gw)}" height="6" rx="1.3" fill="${st.tint}"/>`);
      out.push(textSvg(parseRuns(doc.group, "bold"), right - gw / 2, m + 3 + S.objective * 0.36, S.objective, st.navy, "middle"));
    }
    if (doc.nameLine) {
      out.push(textSvg(parseRuns("Name"), right - 76, m + 11, S.objective, st.ink));
      out.push(`<line x1="${n(right - 66)}" y1="${n(m + 11.6)}" x2="${n(right)}" y2="${n(m + 11.6)}" stroke="${st.ink}" stroke-width="0.3"/>`);
    }
    out.push(textSvg(parseRuns(`Side ${s + 1} of 2`), right, m + 16.4, S.objective, st.muted, "end"));
    if (side.score !== null) {
      const box = scoreBox(side.score, s + 1);
      const end = right - box.lineEnd;
      out.push(textSvg(parseRuns(box.total), end + 1 + plainWidth(box.total, S.objective), m + 16.4, S.objective, st.ink, "end"));
      out.push(`<line x1="${n(end - box.lineMm)}" y1="${n(m + 16.9)}" x2="${n(end)}" y2="${n(m + 16.9)}" stroke="${st.ink}" stroke-width="0.3"/>`);
      out.push(textSvg(parseRuns(box.label), end - box.lineMm - 1.2, m + 16.4, S.objective, st.ink, "end"));
    }
    if (plainWidth(side.instruction, S.objective) > P.width - m * 2 - HEADER_RIGHT - 2)
      ctx.issues.push({ side: s + 1, column: 0, message: `The instruction on side ${s + 1} is longer than one line of the header. Shorten it.` });
    out.push(`<line x1="${m}" y1="${n(colTop - 1.3)}" x2="${n(right)}" y2="${n(colTop - 1.3)}" stroke="${st.rule}" stroke-width="0.3"/>`);

    const boxes = columnBoxes(side);
    side.columns.forEach((col, c) => {
      const { x, w: colW } = boxes[c];
      ctx.where = { side: s + 1, column: c + 1, question: 0 };
      // Stage tile (A to F across both sides) and heading: the progression is visible at a glance.
      out.push(stageSvg(letters.columns[s][c], col.heading, x, colTop, st));
      const numbers = col.cards.map((cd) => (isReminder(cd) ? null : ++number));
      const { spare, extra, stretch } = planColumn(col.cards, numbers, colW, avail, ctx, doc.spareSpace === "share");
      if (spare < -0.01) ctx.issues.push({ side: s + 1, column: c + 1, message: overflowMessage(s, c, spare) });
      if (spare / avail > SPARSE_COLUMN) notes.push({ side: s + 1, column: c + 1, message: sparseMessage(s, c, spare / avail) });
      let y = cardsTop;
      col.cards.forEach((cd, i) => {
        ctx.where = { side: s + 1, column: c + 1, question: numbers[i] ?? undefined };
        const letter = letters.cards[s][c][i];
        if (i === 0 && cd.stage) issue(ctx, "The first card in a column sits under the column heading, so its stage is not printed. Put the stage in the column heading.");
        if (letter) {
          out.push(stageSvg(letter, cd.stage ?? "", x, y, st));
          y += STAGE_BAND;
        }
        const f = card(cd, numbers[i], colW, ctx, extra, stretch(i));
        out.push(at(f, x, y));
        y += f.h + S.cardGap;
      });
    });
    const style = options.fontCss ? `<style>${options.fontCss}</style>` : "";
    const label = `${doc.title}, side ${s + 1}${ctx.view === "answers" ? ", answers" : ""}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${P.width}mm" height="${P.height}mm" viewBox="0 0 ${P.width} ${P.height}" font-family="Inter, sans-serif" role="img" aria-label="${esc(label)}">${style}<rect width="${P.width}" height="${P.height}" fill="white"/>${out.join("")}</svg>`;
  });
  notes.push(...ctx.inline!.values());
  ctx.issues.push(...questionReferenceIssues(resource));
  return { pages, issues: ctx.issues, notes };
}

/** The guide's file name: [code]_[full learning objective]_A3.pdf, with _Answers before _A3 for an answer sheet. */
export function fileName(resource: Resource, view: View = "pupil"): string {
  const d = resource.document;
  const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  const parts = [d.code, d.objective].map(safe).filter(Boolean);
  return `${parts.join("_")}${view === "answers" ? "_Answers" : ""}_A3.pdf`;
}

/** Every string a pupil can read in a card (titles and items, not saved answers or hidden working). */
function readableText(cd: Card): string[] {
  const out: string[] = [cd.title];
  const walk = (v: unknown, key = ""): void => {
    if (typeof v === "string") {
      if (!["answer", "working", "type", "state", "kind", "style", "mode"].includes(key)) out.push(v);
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (k !== "diagram") walk(x, k);
  };
  walk(cd.items);
  return out;
}

/**
 * "Question N" in a card's text must name a real, different question, except in Edexcel's
 * "(Total for Question N is M marks)", which must name the card's own number. Reminder cards are not
 * numbered, so adding or moving one shifts the numbers these references rely on.
 */
export function questionReferenceIssues(resource: Resource): Issue[] {
  const issues: Issue[] = [];
  const cards: { cd: Card; n: number; side: number; column: number }[] = [];
  let n = 0;
  resource.document.sides.forEach((side, s) => side.columns.forEach((col, c) => col.cards.forEach((cd) => {
    if (!isReminder(cd)) cards.push({ cd, n: ++n, side: s + 1, column: c + 1 });
  })));
  for (const { cd, n: own, side, column } of cards) {
    for (const text of readableText(cd)) {
      for (const m of text.matchAll(/\b(Total\sfor\s)?Questions?\s(\d+)\b/gi)) {
        const ref = Number(m[2]);
        const where = { side, column, question: own };
        const tail = "Reminder cards are not numbered, so check the number after adding, removing or moving cards.";
        if (m[1]) {
          if (ref !== own) issues.push({ ...where, message: `Question ${own} says "Total for Question ${ref}"; it is question ${own}. ${tail}` });
        } else if (ref === own) issues.push({ ...where, message: `Question ${own} refers to Question ${ref}, which is itself. ${tail}` });
        else if (ref < 1 || ref > n) issues.push({ ...where, message: `Question ${own} refers to Question ${ref}, but the sheet has ${n} questions. ${tail}` });
      }
    }
  }
  return issues;
}
