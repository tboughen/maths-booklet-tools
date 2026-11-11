import { drawDiagram, svgSizeMm } from "../../diagram-core/src/registry";
import { diagramEnvelope, type Card, type Cell, type Diagram, type Item, type Leaf, type Resource } from "./schema";
import { SIZE, styles, type HouseStyle, type StyleId } from "./style";
import { esc, FRAC_FOOT, FRAC_LINE, hasFraction, lineWidth, n, parseRuns, plainWidth, textSvg, wrap, type Line } from "./text";
import type { FontStyle } from "./metrics";

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

function para(source: string, width: number, ctx: AnyCtx, opts: { size?: number; fill?: string; base?: FontStyle; x?: number } = {}): Frag {
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
  const natural = item.columns.map((head, j) =>
    Math.max(plainWidth(head, size, "bold"), ...item.rows.map((r) => plainWidth(r[j]?.text ?? "", size))) + 5,
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
      const line: Line = parseRuns(c.text, c.bold ? "bold" : "regular");
      const left = j === 0 && !compact;
      const cx = left ? xs[j] + 2 : xs[j] + widths[j] / 2;
      out.push(textSvg(line, cx, y + h / 2 + size * 0.34, size, c.fill ?? ctx.st.ink, left ? "start" : "middle"));
    });
    y += h;
  };
  row(item.columns.map((t) => ({ text: t, bold: true })), S.tableRow, true);
  for (const r of item.rows) {
    const writing = r.some((c) => c.state !== "supplied");
    row(
      r.map((c) => ({ text: cellText(c), fill: c.state === "hidden" ? ctx.st.answer : undefined })),
      writing ? S.tableAnswerRow : S.tableRow,
      false,
    );
  }
  const grid: string[] = [`M0,0H${n(w)}V${n(y)}H0Z`];
  let yy = S.tableRow;
  grid.push(`M0,${n(yy)}H${n(w)}`);
  for (const r of item.rows.slice(0, -1)) {
    yy += r.some((c) => c.state !== "supplied") ? S.tableAnswerRow : S.tableRow;
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
  if (width > room + 0.01) issue(ctx, `A diagram is ${n(width)} mm wide; the card has ${n(room)} mm. Diagrams are never shrunk to fit.`);
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
  const base = S.answerRow - 2.6;
  const slot = (w - (lines.length - 1) * 6) / lines.length;
  const out: string[] = [];
  lines.forEach((l, i) => {
    const x0 = i * (slot + 6);
    const pre = l.prefix ? plainWidth(l.prefix, size) + 1.8 : 0;
    const post = l.suffix ? plainWidth(l.suffix, size) + 1.8 : 0;
    if (l.prefix) out.push(textSvg(parseRuns(l.prefix), x0, base, size, ctx.st.ink));
    const x1 = x0 + pre,
      x2 = x0 + slot - post;
    if (x2 - x1 < 18) issue(ctx, "An answer line is shorter than 18 mm.");
    // The saved answer is written on the line in the answers copy; it must not run past it.
    if (l.answer && plainWidth(l.answer, size) + 2 > x2 - x1 + 0.01)
      issue(ctx, `A saved answer is ${n(plainWidth(l.answer, size) + 2 - (x2 - x1))} mm wider than its answer line, so it would run past the line in the answers copy. Shorten it or give it a longer line.`);
    out.push(`<line x1="${n(x1)}" y1="${n(base + 0.8)}" x2="${n(x2)}" y2="${n(base + 0.8)}" stroke="${ctx.st.ink}" stroke-width="0.3"/>`);
    if (l.suffix) out.push(textSvg(parseRuns(l.suffix), x2 + 1.8, base, size, ctx.st.ink));
    if (ctx.view === "answers" && l.answer) out.push(textSvg(parseRuns(l.answer), x1 + 2, base - 0.6, size, ctx.st.answer));
  });
  return { h: S.answerRow, svg: out.join("") };
}

function choice(item: Extract<Leaf, { type: "choice" }>, w: number, ctx: AnyCtx): Frag {
  const size = S.body;
  const show = ctx.view === "answers" ? item.answer : null;
  const out: string[] = [];
  if (item.mode === "circle") {
    let x = 2;
    const y = 6;
    item.options.forEach((o, i) => {
      const ow = plainWidth(o, size, "bold");
      out.push(textSvg(parseRuns(o, "bold"), x, y, size, ctx.st.ink));
      if (show === i)
        out.push(`<ellipse cx="${n(x + ow / 2)}" cy="${n(y - size * 0.33)}" rx="${n(ow / 2 + 2.2)}" ry="${n(size * 0.9)}" fill="none" stroke="${ctx.st.answer}" stroke-width="0.4"/>`);
      x += ow + 9;
    });
    if (x - 9 > w) issue(ctx, "Circle-one options are wider than the card.");
    return { h: 8.5, svg: out.join("") };
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
      if (only && !only.prefix && !wrapped.some(hasFraction) && textW - lastW - 3 - (only.suffix ? plainWidth(only.suffix, S.body) + 1.8 : 0) >= 30) {
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
 * spaces (or, with none, lets the last card reach the foot). Shared by the SVG and Word writers.
 */
export function planColumn(cards: Card[], numbers: number[], w: number, avail: number, ctx: AnyCtx): { spare: number; extra: number; stretchLast: number } {
  const quiet: AnyCtx = { ...ctx, issues: [], diagrams: 0 };
  const natural = cards.map((cd, i) => card(cd, numbers[i], w, quiet, 0, 0).h);
  const used = natural.reduce((a, b) => a + b, 0) + Math.max(0, cards.length - 1) * S.cardGap;
  const spare = avail - used;
  const spaces = cards.reduce((k, cd) => k + countSpaces(cd.items), 0);
  const extra = spare > 0 && spaces ? spare / spaces : 0;
  return { spare, extra, stretchLast: spare > 0 && !spaces ? spare : 0 };
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
  };
  const P = S.page,
    m = S.margin;
  const colW = (P.width - m * 2 - S.gutter * 2) / 3;
  const colTop = m + S.headerHeight;
  const cardsTop = colTop + S.columnHeadingBand + 2.5;
  const avail = P.height - m - cardsTop;
  let number = 0;
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
    out.push(`<line x1="${m}" y1="${n(colTop - 1.3)}" x2="${n(right)}" y2="${n(colTop - 1.3)}" stroke="${st.rule}" stroke-width="0.3"/>`);

    side.columns.forEach((col, c) => {
      const x = m + c * (colW + S.gutter);
      ctx.where = { side: s + 1, column: c + 1, question: 0 };
      // Stage tile (A to F across both sides) and heading: the progression is visible at a glance.
      const tileY = colTop + (S.columnHeadingBand - S.tile) / 2;
      out.push(`<rect x="${n(x)}" y="${n(tileY)}" width="${S.tile}" height="${S.tile}" rx="1.3" fill="${st.navy}"/>`);
      out.push(textSvg([{ text: String.fromCharCode(65 + s * 3 + c), style: "bold" }], x + S.tile / 2, tileY + S.tile / 2 + S.columnHeading * 0.36, S.columnHeading, "white", "middle"));
      out.push(textSvg(parseRuns(col.heading, "bold"), x + S.tile + 2.8, tileY + S.tile / 2 + S.columnHeading * 0.36, S.columnHeading, st.navy));
      const numbers = col.cards.map(() => ++number);
      const { spare, extra, stretchLast } = planColumn(col.cards, numbers, colW, avail, ctx);
      if (spare < -0.01) ctx.issues.push({ side: s + 1, column: c + 1, message: overflowMessage(s, c, spare) });
      let y = cardsTop;
      col.cards.forEach((cd, i) => {
        ctx.where = { side: s + 1, column: c + 1, question: numbers[i] };
        const stretch = i === col.cards.length - 1 ? stretchLast : 0;
        const f = card(cd, numbers[i], colW, ctx, extra, stretch);
        out.push(at(f, x, y));
        y += f.h + S.cardGap;
      });
    });
    const style = options.fontCss ? `<style>${options.fontCss}</style>` : "";
    const label = `${doc.title}, side ${s + 1}${ctx.view === "answers" ? ", answers" : ""}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${P.width}mm" height="${P.height}mm" viewBox="0 0 ${P.width} ${P.height}" font-family="Inter, sans-serif" role="img" aria-label="${esc(label)}">${style}<rect width="${P.width}" height="${P.height}" fill="white"/>${out.join("")}</svg>`;
  });
  return { pages, issues: ctx.issues };
}

/** The guide's file name: [code]_[full learning objective]_A3.pdf, with _Answers before _A3 for an answer sheet. */
export function fileName(resource: Resource, view: View = "pupil"): string {
  const d = resource.document;
  const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  const parts = [d.code, d.objective].map(safe).filter(Boolean);
  return `${parts.join("_")}${view === "answers" ? "_Answers" : ""}_A3.pdf`;
}
