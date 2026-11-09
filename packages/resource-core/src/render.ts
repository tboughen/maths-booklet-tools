import { forView as chartForView, renderSvg as chartSvg } from "../../chart-core/src/index";
import { forView as treeForView, renderSvg as treeSvg } from "../../probability-tree-core/src/index";
import type { Card, Cell, Diagram, Item, Leaf, Resource } from "./schema";
import { SIZE, styles, type HouseStyle, type StyleId } from "./style";
import { esc, lineWidth, n, parseRuns, plainWidth, textSvg, wrap, type Line } from "./text";
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

type Frag = { h: number; svg: string };
interface Ctx {
  st: HouseStyle;
  view: View;
  diagrams: number;
  issues: Issue[];
  where: { side: number; column: number; question: number };
}

const S = SIZE;
const lineBox = (size: number) => size * S.lineHeight;
const baseline = (size: number) => (lineBox(size) - size) / 2 + size * 0.82;
const at = (f: Frag, x: number, y: number) => (f.svg ? `<g transform="translate(${n(x)},${n(y)})">${f.svg}</g>` : "");
const issue = (ctx: Ctx, message: string) => ctx.issues.push({ ...ctx.where, message });

function para(source: string, width: number, ctx: Ctx, opts: { size?: number; fill?: string; base?: FontStyle; x?: number } = {}): Frag {
  const size = opts.size ?? S.body;
  const lines = wrap(source, size, width, opts.base);
  const lh = lineBox(size);
  const svg = lines.map((l, i) => textSvg(l, opts.x ?? 0, i * lh + baseline(size), size, opts.fill ?? ctx.st.ink)).join("");
  return { h: lines.length * lh, svg };
}

function table(item: Extract<Leaf, { type: "table" }>, w: number, ctx: Ctx): Frag {
  const size = S.body;
  const cellText = (c: Cell) => (c.state === "supplied" || (c.state === "hidden" && ctx.view === "answers") ? c.text : "");
  const natural = item.columns.map((head, j) =>
    Math.max(plainWidth(head, size, "bold"), ...item.rows.map((r) => plainWidth(r[j]?.text ?? "", size))) + 5,
  );
  const total = natural.reduce((a, b) => a + b, 0);
  if (total > w + 0.01) issue(ctx, `A table needs ${n(total - w)} mm more width than the column has.`);
  const widths = natural.map((v) => (v * w) / total);
  const xs = widths.map((_, j) => widths.slice(0, j).reduce((a, b) => a + b, 0));
  const out: string[] = [];
  let y = 0;
  const row = (cells: { text: string; bold?: boolean; fill?: string }[], h: number, header: boolean) => {
    if (header) out.push(`<rect x="0" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${ctx.st.tableHead}"/>`);
    cells.forEach((c, j) => {
      if (!c.text) return;
      const line: Line = parseRuns(c.text, c.bold ? "bold" : "regular");
      const cx = j === 0 ? xs[j] + 2 : xs[j] + widths[j] / 2;
      out.push(textSvg(line, cx, y + h / 2 + size * 0.34, size, c.fill ?? ctx.st.ink, j === 0 ? "start" : "middle"));
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

function diagram(d: Diagram, w: number, ctx: Ctx): Frag {
  const draw = (view: "pupil" | "answer") =>
    d.tool === "charts" ? chartSvg(chartForView(d.envelope, view)) : treeSvg(treeForView(d.envelope, view));
  const size = (s: string) => {
    const tag = s.match(/^<svg[^>]*>/)?.[0] ?? "";
    return { width: Number(tag.match(/width="([\d.]+)mm"/)?.[1]), height: Number(tag.match(/height="([\d.]+)mm"/)?.[1]) };
  };
  let svg = draw(ctx.view === "answers" ? "answer" : "pupil");
  const open = svg.match(/^<svg[^>]*>/)?.[0] ?? "";
  // Reserve the larger of the pupil and answer sizes so both views share one layout.
  const a = size(draw("pupil")),
    b = size(draw("answer"));
  const width = Math.max(a.width, b.width);
  const height = Math.max(a.height, b.height);
  const own = size(svg).width;
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
    .replace(open, open.replace(/width="([\d.]+)mm"/, 'width="$1"').replace(/height="([\d.]+)mm"/, `height="$1" x="${n((w - own) / 2)}"`));
  return { h: height, svg };
}

function answerRow(lines: Extract<Leaf, { type: "answerLine" }>[], w: number, ctx: Ctx): Frag {
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
    out.push(`<line x1="${n(x1)}" y1="${n(base + 0.8)}" x2="${n(x2)}" y2="${n(base + 0.8)}" stroke="${ctx.st.ink}" stroke-width="0.3"/>`);
    if (l.suffix) out.push(textSvg(parseRuns(l.suffix), x2 + 1.8, base, size, ctx.st.ink));
    if (ctx.view === "answers" && l.answer) out.push(textSvg(parseRuns(l.answer), x1 + 2, base - 0.6, size, ctx.st.answer));
  });
  return { h: S.answerRow, svg: out.join("") };
}

function choice(item: Extract<Leaf, { type: "choice" }>, w: number, ctx: Ctx): Frag {
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
  let y = 0;
  item.options.forEach((o, i) => {
    const f = para(o, w - S.tickBox - 2.6, ctx, { x: S.tickBox + 2.6 });
    const by = (lineBox(size) - S.tickBox) / 2;
    out.push(`<g transform="translate(0,${n(y)})"><rect x="0" y="${n(by)}" width="${S.tickBox}" height="${S.tickBox}" fill="none" stroke="${ctx.st.ink}" stroke-width="0.3"/>${f.svg}`);
    if (show === i)
      out.push(`<path d="M0.8,${n(by + 2.1)}L1.8,${n(by + 3.2)}L3.4,${n(by + 0.8)}" fill="none" stroke="${ctx.st.answer}" stroke-width="0.5"/>`);
    out.push("</g>");
    y += f.h + 1.2;
  });
  return { h: y - 1.2, svg: out.join("") };
}

function leaf(item: Leaf, w: number, ctx: Ctx, extra: number): Frag {
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
        out.push(at(f, 0, y), textSvg([{ text: "•", style: "regular" }], 1.2, y + baseline(S.body), S.body, st.ink));
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
  }
}

function items(list: Item[], w: number, ctx: Ctx, extra: number): Frag {
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
      const wrapped = wrap(it.text, S.body, textW);
      const lastW = lineWidth(wrapped[wrapped.length - 1], S.body);
      if (only && !only.prefix && textW - lastW - 3 - (only.suffix ? plainWidth(only.suffix, S.body) + 1.8 : 0) >= 30) {
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
      const svg = textSvg([{ text: label, style: "regular" }], 0, baseline(S.body), S.body, ctx.st.ink) + head.svg + at(sub, S.partIndent, head.h + S.itemGap);
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

const countSpaces = (list: Item[]): number =>
  list.reduce((c, it) => c + (it.type === "space" ? 1 : it.type === "part" ? countSpaces(it.items) : 0), 0);

function card(c: Card, number: number, w: number, ctx: Ctx, extra: number, stretch: number): Frag {
  const st = ctx.st,
    pad = S.cardPad;
  const body = items(c.items, w - pad * 2, ctx, extra);
  const top = pad + S.tile + S.itemGap;
  const h = top + body.h + pad + stretch;
  const out: string[] = [];
  const titleY = pad + S.tile / 2 + S.cardTitle * 0.36;
  // A white framed card with a soft-blue number tile, as on the MathsDock home page.
  out.push(`<rect x="0.15" y="0.15" width="${n(w - 0.3)}" height="${n(h - 0.3)}" rx="2" fill="white" stroke="${st.rule}" stroke-width="0.45"/>`);
  out.push(`<rect x="${pad}" y="${pad}" width="${S.tile}" height="${S.tile}" rx="1.3" fill="${st.navy}"/>`);
  out.push(textSvg([{ text: String(number), style: "bold" }], pad + S.tile / 2, titleY, S.cardTitle, "white", "middle"));
  out.push(textSvg(parseRuns(c.title, "bold"), pad + S.tile + 2.8, titleY, S.cardTitle, st.navy));
  if (plainWidth(c.title, S.cardTitle, "bold") > w - pad * 2 - S.tile - 3) issue(ctx, "The card title is wider than the card.");
  out.push(at(body, pad, top));
  return { h, svg: out.join("") };
}

export function renderResource(resource: Resource, options: RenderOptions = {}): Rendered {
  const doc = resource.document;
  const st = styles[options.style ?? "mathsdock"];
  const ctx: Ctx = { st, view: options.view ?? "pupil", diagrams: 0, issues: [], where: { side: 0, column: 0, question: 0 } };
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
      out.push(textSvg(parseRuns("Name"), right - 76, m + 13.6, S.objective, st.ink));
      out.push(`<line x1="${n(right - 66)}" y1="${n(m + 14.2)}" x2="${n(right)}" y2="${n(m + 14.2)}" stroke="${st.ink}" stroke-width="0.3"/>`);
    }
    out.push(textSvg(parseRuns(`Side ${s + 1} of 2`), right, m + 16.4, S.objective * 0.9, st.muted, "end"));
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
      // Measure, then give spare height to working and drawing spaces (or let the last card reach the foot).
      const quiet: Ctx = { ...ctx, issues: [], diagrams: 0 };
      const natural = col.cards.map((cd, i) => card(cd, numbers[i], colW, quiet, 0, 0).h);
      const used = natural.reduce((a, b) => a + b, 0) + Math.max(0, col.cards.length - 1) * S.cardGap;
      const spare = avail - used;
      if (spare < -0.01) ctx.issues.push({ side: s + 1, column: c + 1, message: `Column ${c + 1} on side ${s + 1} needs ${n(-spare)} mm more height. Move a question or reduce working space; text is never shrunk.` });
      const spaces = col.cards.reduce((k, cd) => k + countSpaces(cd.items), 0);
      const extra = spare > 0 && spaces ? spare / spaces : 0;
      let y = cardsTop;
      col.cards.forEach((cd, i) => {
        ctx.where = { side: s + 1, column: c + 1, question: numbers[i] };
        const stretch = spare > 0 && !spaces && i === col.cards.length - 1 ? spare : 0;
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
