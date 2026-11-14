import { drawDiagram, svgSizeMm } from "../../diagram-core/src/registry";
import { diagramEnvelope, LAYOUTS, type Card, type Cell, type Diagram, type Item, type Leaf, type Resource, type Side } from "./schema";
import { SIZE, styles, type HouseStyle, type StyleId } from "./style";
import { answerHasFraction, esc, FRAC_ANSWER_EXTRA, FRAC_ANSWER_RAISE, FRAC_CIRCLE_ROW, FRAC_TABLE_ROW, FRAC_FOOT, FRAC_LINE, hasFraction, stackAnswerText, inlineFraction, lineWidth, n, parseRuns, plainWidth, textSvg, wrap, type Line } from "./text";
import { measuredWidths, type FontStyle } from "./metrics";

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
  /** Tables keep their natural width (cells at least 14 mm) instead of filling the card: booklets. */
  compactTables?: boolean;
  /** Maths notation in flowing text: {3/4} prints as a stacked fraction (worksheet `notation: "maths"`). */
  maths?: boolean;
  /** Collects one note per question whose flowing text holds a fraction that will not print stacked. */
  inline?: Map<string, Issue>;
}

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
  const headH = tall(item.columns) ? FRAC_TABLE_ROW : S.tableRow;
  const rowH = (r: Cell[]) => {
    const h = r.some((c) => c.state !== "supplied") ? S.tableAnswerRow : S.tableRow;
    return tall(r.map((c) => c.text)) ? Math.max(h, FRAC_TABLE_ROW) : h;
  };
  const natural = item.columns.map((head, j) =>
    Math.max(cellWidth(head, true), ...item.rows.map((r) => cellWidth(r[j]?.text ?? ""))) + 5,
  );
  const total = natural.reduce((a, b) => a + b, 0);
  if (total > w + 0.01) issue(ctx, `A table needs ${n(total - w)} mm more width than the column has.`);
  const roomy = natural.map((v) => Math.max(v, 14));
  const compact = ctx.compactTables && roomy.reduce((a, b) => a + b, 0) <= w;
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
  row(item.columns.map((t) => ({ text: t, bold: true })), headH, true);
  for (const r of item.rows)
    row(
      r.map((c) => ({ text: cellText(c), fill: c.state === "hidden" ? ctx.st.answer : undefined })),
      rowH(r),
      false,
    );
  const grid: string[] = [`M0,0H${n(w)}V${n(y)}H0Z`];
  let yy = headH;
  grid.push(`M0,${n(yy)}H${n(w)}`);
  for (const r of item.rows.slice(0, -1)) {
    yy += rowH(r);
    grid.push(`M0,${n(yy)}H${n(w)}`);
  }
  for (const x of xs.slice(1)) grid.push(`M${n(x)},0V${n(y)}`);
  out.push(`<path d="${grid.join("")}" fill="none" stroke="${ctx.st.rule}" stroke-width="0.35"/>`);
  return { h: y, svg: out.join("") };
}

function diagram(d: Diagram, w: number, ctx: AnyCtx): Frag {
  // The larger of the pupil and answer sizes is reserved so both views share one layout.
  let drawn: ReturnType<typeof drawDiagram>;
  try {
    drawn = drawDiagram(d.tool, diagramEnvelope(d), ctx.view === "answers" ? "answer" : "pupil");
  } catch (error) {
    issue(ctx, `A diagram could not be drawn: ${error instanceof Error ? error.message : "unknown problem"}`);
    return { h: 0, svg: "" };
  }
  let svg = drawn.svg;
  const open = svg.match(/^<svg[^>]*>/)?.[0] ?? "";
  const { widthMm: width, heightMm: height } = drawn;
  const own = svgSizeMm(svg);
  if (!(width > 0 && height > 0)) {
    issue(ctx, "A diagram did not report its physical size.");
    return { h: 0, svg: "" };
  }
  // A diagram may use the card's padding, but is never shrunk to fit.
  const room = w + 2 * (S.cardPad - 0.6);
  if (width > room + 0.01) issue(ctx, tooWideMessage(d.tool, width, room));
  const k = `d${++ctx.diagrams}-`;
  svg = svg
    .replace(/ id="/g, ` id="${k}`)
    .replace(/url\(#/g, `url(#${k}`)
    .replace(/href="#/g, `href="#${k}`)
    // Worksheet user units are millimetres, whatever unit the family's own SVG states.
    .replace(open, open.replace(/\swidth="[^"]*"/, ` width="${n(own.width)}"`).replace(/\sheight="[^"]*"/, ` height="${n(own.height)}" x="${n((w - own.width) / 2)}"`));
  return { h: height, svg };
}

function answerRow(lines: Extract<Leaf, { type: "answerLine" }>[], w: number, ctx: AnyCtx): Frag {
  const size = S.body;
  // Maths notation: fractions in the prefix, suffix and saved answer print stacked, and a row that
  // holds one is taller in both copies. Plain (older) sheets print exactly as before.
  const maths = !!ctx.maths;
  const runsOf = (s: string) => parseRuns(maths ? stackAnswerText(s) : s, "regular", maths);
  // Plain sheets keep their saved measurements exactly.
  const widthOf = (s: string) => (maths ? lineWidth(runsOf(s), size) : plainWidth(s, size));
  const tall = lines.some((l) => [l.prefix, l.suffix, l.answer].some((s) => answerHasFraction(s, maths)));
  const h = S.answerRow + (tall ? FRAC_ANSWER_EXTRA : 0);
  const base = h - 2.6;
  const slot = (w - (lines.length - 1) * 6) / lines.length;
  const out: string[] = [];
  lines.forEach((l, i) => {
    const x0 = i * (slot + 6);
    const pre = l.prefix ? widthOf(l.prefix) + 1.8 : 0;
    const post = l.suffix ? widthOf(l.suffix) + 1.8 : 0;
    if (l.prefix) out.push(textSvg(runsOf(l.prefix), x0, base, size, ctx.st.ink));
    const x1 = x0 + pre,
      x2 = x0 + slot - post;
    if (x2 - x1 < 18) issue(ctx, "An answer line is shorter than 18 mm.");
    // The saved answer is written on the line in the answers copy; it must not run past it.
    const answerW = l.answer ? widthOf(l.answer) : 0;
    if (l.answer && answerW + 2 > x2 - x1 + 0.01)
      issue(ctx, `A saved answer is ${n(answerW + 2 - (x2 - x1))} mm wider than its answer line, so it would run past the line in the answers copy. Shorten it or give it a longer line.`);
    out.push(`<line x1="${n(x1)}" y1="${n(base + 0.8)}" x2="${n(x2)}" y2="${n(base + 0.8)}" stroke="${ctx.st.ink}" stroke-width="0.3"/>`);
    if (l.suffix) out.push(textSvg(runsOf(l.suffix), x2 + 1.8, base, size, ctx.st.ink));
    // A stacked fraction answer is raised so its denominator clears the line.
    if (ctx.view === "answers" && l.answer)
      out.push(textSvg(runsOf(l.answer), x1 + 2, base - 0.6 - (answerHasFraction(l.answer, maths) ? FRAC_ANSWER_RAISE : 0), size, ctx.st.answer));
  });
  return { h, svg: out.join("") };
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

/** Lettered options (A, B, C…) for hinge questions: one row when they fit, otherwise two columns or one. */
function letters(item: Extract<Leaf, { type: "choice" }>, w: number, ctx: AnyCtx, show: number | null): Frag {
  const size = S.body,
    r = 2.5,
    gap = 1.8;
  const out: string[] = [];
  const widths = item.options.map((o) => 2 * r + gap + plainWidth(o, size));
  const perRow = widths.reduce((a, b) => a + b, 0) + (item.options.length - 1) * 6 <= w ? item.options.length : Math.max(...widths) * 2 + 6 <= w ? 2 : 1;
  const slot = perRow === item.options.length ? 0 : (w - (perRow - 1) * 6) / perRow;
  let x = 0,
    y = 0,
    rowH = 0;
  item.options.forEach((o, i) => {
    if (i && i % perRow === 0) {
      x = 0;
      y += rowH + 1.6;
      rowH = 0;
    }
    const f = para(o, (slot || widths[i]) - 2 * r - gap + 0.5, ctx, { x: 2 * r + gap });
    const cy = (f.first ?? baseline(size)) - size * 0.34;
    const letter = String.fromCharCode(65 + i);
    const mark = show === i;
    out.push(`<g transform="translate(${n(x)},${n(y)})">`);
    out.push(`<circle cx="${r}" cy="${n(cy)}" r="${r}" fill="${mark ? ctx.st.answer : "white"}" stroke="${mark ? ctx.st.answer : ctx.st.navy}" stroke-width="0.35"/>`);
    out.push(textSvg([{ text: letter, style: "bold" }], r, cy + size * 0.34, S.body * 0.9, mark ? "white" : ctx.st.navy, "middle"));
    out.push(f.svg, "</g>");
    rowH = Math.max(rowH, f.h + (f.first === undefined ? 0 : FRAC_FOOT));
    x += (slot || widths[i]) + 6;
  });
  return { h: y + rowH, svg: out.join("") };
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
    case "space":
      return { h: item.heightMm + extra, svg: "" };
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

function items(list: Item[], w: number, ctx: AnyCtx, extra: number): Frag {
  const frags: Frag[] = [];
  let part = 0;
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    if (it.type === "answerLine" && it.inline) {
      const group = [it];
      while (list[i + 1]?.type === "answerLine" && (list[i + 1] as typeof it).inline) group.push(list[++i] as typeof it);
      frags.push(answerRow(group, w, ctx));
    } else if (it.type === "part") {
      const label = `${String.fromCharCode(97 + part++)})`;
      const only = it.items.length === 1 && it.items[0].type === "answerLine" && !it.items[0].inline ? it.items[0] : null;
      const textW = w - S.partIndent;
      const wrapped = wrap(it.text, S.body, textW, "regular", ctx.maths);
      const lastW = lineWidth(wrapped[wrapped.length - 1], S.body);
      if (only && !only.prefix && !wrapped.some(hasFraction) && ![only.suffix, only.answer].some((t) => answerHasFraction(t, !!ctx.maths)) && textW - lastW - 3 - (only.suffix ? plainWidth(only.suffix, S.body) + 1.8 : 0) >= 30) {
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

export const countSpaces = (list: Item[]): number =>
  list.reduce((c, it) => c + (it.type === "space" ? 1 : it.type === "part" ? countSpaces(it.items) : 0), 0);

/** Families whose printed width is set by spec.widthCm. */
const WIDTH_CM = new Set(["number-line", "venn", "triangle"]);
/** The issue for a diagram wider than its card, with the change that makes it fit. */
export function tooWideMessage(tool: string, width: number, room: number): string {
  const fit = Math.floor(room / 5) / 2;
  const hint = WIDTH_CM.has(tool)
    ? ` Set the ${tool}'s widthCm to ${fit} or less, or use a wider column layout.`
    : tool === "probability-tree" || tool === "frequency-tree"
      ? " Reduce the tree's settings.branchMm (30 fits a two-level frequency tree in a three-column card), or use a wider column layout."
      : tool === "construction"
        ? " Constructions print at true size: reduce the drawing's widthCm (and move points inside it), or use a wider column layout."
        : tool === "elevations"
          ? " Use settings.maxWidthCm to wrap the panels onto more rows, a smaller unitCm, or a wider column layout."
          : " Use a wider column layout (two, wide-narrow or narrow-wide) or a smaller diagram.";
  return `A diagram is ${n(width)} mm wide; the card has ${n(room)} mm. Diagrams are never shrunk to fit.${hint}`;
}

/** One framed question card. A null number leaves out the number tile (worked examples, notes). */
export function card(c: Card, number: number | null, w: number, ctx: AnyCtx, extra: number, stretch: number): Frag {
  const st = ctx.st,
    pad = S.cardPad;
  const body = items(c.items, w - pad * 2, ctx, extra);
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
export function planColumn(cards: Card[], numbers: number[], w: number, avail: number, ctx: AnyCtx, share = false): { spare: number; extra: number; stretch: (i: number) => number } {
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
const PRINTED = new Set(["text", "title", "heading", "prefix", "suffix", "answer", "label", "instruction", "objective", "code", "group", "items", "options"]);
/**
 * A character the worksheet font does not hold would print as a gap in the PDF and as a
 * substitute font in Word, so it is reported as an issue, once per character and question.
 */
export function missingGlyphIssues(resource: Resource): Issue[] {
  const known = measuredWidths("regular");
  const found = new Map<string, Issue>();
  type Where = Omit<Issue, "message">;
  const scan = (value: unknown, where: Where, key = "") => {
    if (typeof value === "string") {
      if (!PRINTED.has(key)) return;
      for (const c of new Set(value)) {
        if (c in known || c === "\n") continue;
        const id = `${c}.${where.side}.${where.question ?? 0}`;
        if (!found.has(id))
          found.set(id, { ...where, message: `${where.question ? `Question ${where.question}` : "The header"} uses "${c}" (U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}), which the worksheet font does not have, so it would print as a gap. Write it another way (for example in words).` });
      }
    } else if (Array.isArray(value)) value.forEach((v) => scan(v, where, key));
    else if (value && typeof value === "object")
      for (const [k, v] of Object.entries(value)) if (k !== "diagram" && k !== "working") scan(v, where, k);
  };
  const d = resource.document;
  scan({ title: d.title, objective: d.objective, code: d.code, group: d.group }, { side: 1, column: 0 });
  let question = 0;
  d.sides.forEach((side, s) => {
    scan({ instruction: side.instruction }, { side: s + 1, column: 0 });
    side.columns.forEach((col, c) => {
      scan({ heading: col.heading }, { side: s + 1, column: c + 1 });
      for (const card of col.cards) scan(card, { side: s + 1, column: c + 1, question: ++question });
    });
  });
  return [...found.values()];
}

export function renderResource(resource: Resource, options: RenderOptions = {}): Rendered {
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
      const numbers = col.cards.map(() => ++number);
      const { spare, extra, stretch } = planColumn(col.cards, numbers, colW, avail, ctx, doc.spareSpace === "share");
      if (spare < -0.01) ctx.issues.push({ side: s + 1, column: c + 1, message: overflowMessage(s, c, spare) });
      if (spare / avail > SPARSE_COLUMN) notes.push({ side: s + 1, column: c + 1, message: sparseMessage(s, c, spare / avail) });
      let y = cardsTop;
      col.cards.forEach((cd, i) => {
        ctx.where = { side: s + 1, column: c + 1, question: numbers[i] };
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
  return { pages, issues: ctx.issues, notes };
}

/** The guide's file name: [code]_[full learning objective]_A3.pdf, with _Answers before _A3 for an answer sheet. */
export function fileName(resource: Resource, view: View = "pupil"): string {
  const d = resource.document;
  const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  const parts = [d.code, d.objective].map(safe).filter(Boolean);
  return `${parts.join("_")}${view === "answers" ? "_Answers" : ""}_A3.pdf`;
}
