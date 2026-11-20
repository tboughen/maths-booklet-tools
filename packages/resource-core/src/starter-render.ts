import { typesetForPrint } from "./typeset";
import { FAMILIES, type DiagramKind } from "../../diagram-core/src/registry";
import { at, countSpaces, items, missingCharacterMessage, missingCharacters, type Ctx, type Frag, type View } from "./render";
import { SIZE, styles, type StyleId } from "./style";
import { esc, lineWidth, n, parseRuns, plainWidth, textSvg } from "./text";
import type { Item } from "./schema";
import { fitLine } from "./booklet-render";
import { isExtensionSlot, type StarterIcon, type StarterRun, type StarterTemplate } from "./starter";

/**
 * Lays out a run of silent starters. Each starter is an A5 landscape card (210 × 148 mm); the
 * print sheet is A4 portrait with two copies of the same card and a cut line between them.
 * Text is the house 11 pt and is never shrunk: a question too tall for its slot is reported.
 */
const pt = 0.3528;
export const STARTER = {
  card: { width: 210, height: 148 },
  sheet: { width: 210, height: 297 },
  /** Cutting allowance all round, so a slightly crooked cut never clips a question. */
  margin: 7,
  /** Layout E (Tim, 19 Nov 2026): the booklet's corner badge and stage-style run squares. */
  header: 13,
  headerGap: 2.5,
  badge: 13,
  square: 7.5,
  squareGap: 1.4,
  /** Framed question cards, three across (1 2 3 over 4 5 6), with a header strip on each. */
  cardGap: 2.5,
  strip: 6.5,
  radius: 1.6,
  numberSize: 12 * pt,
  tagSize: 7.5 * pt,
  padX: 3,
  padTop: 1.8,
  padBottom: 2,
  icon: 8,
  logo: 10,
  colours: { edge: "#9fb3d1", pale: "#dbe7f6", muted: "#4a5878" },
} as const;

export interface StarterIssue {
  /** 1-based starter in the run, or 0 for the whole run (a problem with the topic, printed on every card). */
  starter: number;
  /** 1-based question (slot), when the issue belongs to one. */
  question?: number;
  message: string;
}
export interface StarterRenderOptions {
  view?: View;
  style?: StyleId;
  fontCss?: string;
}
export interface RenderedStarters {
  /** One A5 landscape SVG per starter, 210 × 148 mm, user units in millimetres. */
  cards: string[];
  /** One A4 portrait SVG per starter holding two copies of its card and a cut line. */
  sheets: string[];
  issues: StarterIssue[];
}

type Where = { starter: number; question?: number };

/** Each card's box: four go two by two and six three by two, always in reading order (1 2 3 over 4 5 6). */
export function slotBoxes(template: StarterTemplate): { x: number; y: number; w: number; h: number }[] {
  const S = STARTER;
  const cols = template === "four" ? 2 : 3;
  const x0 = S.margin,
    y0 = S.margin + S.header + S.headerGap,
    W = S.card.width - 2 * S.margin,
    H = S.card.height - S.margin - y0;
  const w = (W - (cols - 1) * S.cardGap) / cols,
    h = (H - S.cardGap) / 2;
  return Array.from({ length: cols * 2 }, (_, i) => ({ x: x0 + (i % cols) * (w + S.cardGap), y: y0 + Math.floor(i / cols) * (h + S.cardGap), w, h }));
}

/** The question area inside a card: below its header strip, above the icon. Shared with Word. */
export function slotContent(template: StarterTemplate, slot: number, icon: StarterIcon) {
  const S = STARTER;
  const box = slotBoxes(template)[slot];
  const top = box.y + S.strip + S.padTop;
  const bottom = box.y + box.h - S.padBottom - (icon === "none" ? 0 : S.icon + 1.5);
  return { box, x: box.x + S.padX, w: box.w - 2 * S.padX, top, height: bottom - top };
}

/**
 * Where a card's instruction prints: in its header strip, or, on an extension card where it will not
 * fit beside the EXTENSION tag, as a bold first line of the question instead (nothing is cut).
 */
export function cardLayout(template: StarterTemplate, slot: number, card: { title: string; items: Item[] }, maths: boolean): { stripTitle: string; items: Item[]; room: number } {
  const S = STARTER;
  const box = slotBoxes(template)[slot];
  const ext = isExtensionSlot(template, slot);
  const room = box.w - 2 * S.padX - plainWidth(String(slot + 1), S.numberSize, "bold") - 2.4 - (ext ? extensionTagWidth() - S.padX + 2 : 0);
  const title = card.title.trim();
  if (ext && title && lineWidth(parseRuns(title, "bold", maths), SIZE.body) > room) return { stripTitle: "", items: [{ type: "text", text: `**${title}**` }, ...card.items], room };
  return { stripTitle: title, items: card.items, room };
}

/** The width the EXTENSION tag takes at the right of a strip. */
export const extensionTagWidth = () => plainWidth("EXTENSION", STARTER.tagSize, "bold") + 0.4 * 8 + STARTER.padX;

/** The message for a diagram wider than its slot, naming the starter and question (PDF and Word share it). */
export const starterTooWide = (ctx: { where: Where }) => (tool: string, width: number, room: number) =>
  `Starter ${ctx.where.starter}, question ${ctx.where.question}: the ${FAMILIES[tool as DiagramKind]?.label ?? `${tool} diagram`} is ${n(width)} mm wide and the slot has ${n(room)} mm. Draw it smaller in its tool; diagrams and labels are never shrunk to fit.`;

/** Leaves out each diagram's own white background, so the grey extension tint shows behind it. */
export const withoutDiagramBackground = (svg: string) => svg.replace(/(<svg[^>]*\sviewBox="0 0 ([\d.]+) ([\d.]+)"[^>]*>)<rect width="\2" height="\3" fill="white"\/>/g, "$1");

/** Plain line icons on a 24-unit grid, drawn in black so they survive any printer. */
const ICON_PATHS: Record<Exclude<StarterIcon, "none">, string> = {
  pencil: "M4 20l1-5L16 4l4 4L9 19z M14 6l4 4",
  talk: "M3 5h12v8H8l-3 3v-3H3z M17 9h4v8h-2v3l-3-3h-5v-2",
  book: "M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2z M12 6v14",
  puzzle: "M4 8h4a2 2 0 1 1 4 0h4v4a2 2 0 1 0 0 4v4h-4a2 2 0 1 0-4 0H4v-4a2 2 0 1 1 0-4z",
};
function iconSvg(icon: StarterIcon, x: number, y: number): string {
  if (icon === "none") return "";
  const s = STARTER.icon;
  const k = (s * 0.75) / 24;
  const off = s * 0.125;
  return (
    `<rect x="${n(x)}" y="${n(y)}" width="${s}" height="${s}" fill="white" stroke="#000" stroke-width="0.45"/>` +
    `<path data-icon="${icon}" d="${ICON_PATHS[icon]}" transform="translate(${n(x + off)},${n(y + off)}) scale(${Math.round(k * 1000) / 1000})" fill="none" stroke="#000" stroke-width="${n(0.45 / k)}" stroke-linejoin="round"/>`
  );
}

const sq = (x: number, y: number, size: number, fill: string, stroke = "") =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(size)}" height="${n(size)}" rx="${n(size * 0.1)}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="0.35"` : ""}/>`;
const caps = (text: string, x: number, y: number, size: number, fill: string, anchor = "start") =>
  `<text x="${n(x)}" y="${n(y)}" font-size="${n(size)}" font-weight="700" fill="${fill}" letter-spacing="${n(size * 0.12)}"${anchor === "start" ? "" : ` text-anchor="${anchor}"`}>${text}</text>`;

/** Layout E header: navy STARTER badge in the corner, run squares beside it, title and topic on the right. */
function header(doc: StarterRun["document"], number: number, issues: StarterIssue[], navy: string): string {
  const S = STARTER,
    C = S.colours;
  const x0 = S.margin,
    y0 = S.margin,
    right = S.card.width - S.margin;
  const out: string[] = [];
  out.push(sq(x0, y0, S.badge, navy));
  out.push(caps("STARTER", x0 + S.badge / 2, y0 + 3.9, 5.5 * pt, "#ffffff", "middle"));
  out.push(textSvg([{ text: String(number), style: "bold" }], x0 + S.badge / 2, y0 + 10.9, 20 * pt, "#ffffff", "middle"));
  // The run: one square per starter, today's navy, the rest pale blue, like the booklet's stage squares.
  let x = x0 + S.badge + 5;
  const sy = y0 + (S.badge - S.square) / 2;
  for (let i = 1; i <= doc.starters.length; i++) {
    const on = i === number;
    out.push(sq(x, sy, S.square, on ? navy : C.pale));
    out.push(textSvg([{ text: String(i), style: "bold" }], x + S.square / 2, sy + S.square * 0.68, 12 * pt, on ? "#ffffff" : navy, "middle"));
    x += S.square + S.squareGap;
  }
  let textRight = right;
  if (doc.logo) {
    const L = S.logo;
    out.push(`<image x="${n(right - L)}" y="${n(y0 + (S.badge - L) / 2)}" width="${L}" height="${L}" preserveAspectRatio="xMidYMid meet" href="${esc(doc.logo)}"/>`);
    textRight -= L + 3;
  }
  const room = Math.max(0, textRight - x - 4);
  const title = doc.group.trim() ? `Silent starter · ${doc.group.trim()}` : "Silent starter";
  out.push(textSvg([{ text: fitLine(title, 12 * pt, room, "bold"), style: "bold" }], textRight, y0 + 5.4, 12 * pt, navy, "end"));
  if (doc.topic.trim()) {
    const size = 10 * pt;
    const topic = fitLine(doc.topic, size, room, "regular");
    if (topic !== doc.topic) issues.push({ starter: number, message: `Starter ${number}: the topic is wider than the header has room for, so it is cut short. Shorten the topic.` });
    out.push(textSvg(parseRuns(topic), textRight, y0 + 10.6, size, C.muted, "end"));
  }
  return out.join("");
}

/** One card's frame and header strip: number, instruction and, on extension cards, the EXTENSION tag. */
function cardFrame(box: { x: number; y: number; w: number; h: number }, label: string, title: string, ext: boolean, navy: string, maths: boolean): string {
  const S = STARTER,
    C = S.colours,
    r = S.radius;
  const { x, y, w, h } = box;
  const strip = `M${n(x)} ${n(y + S.strip)}V${n(y + r)}a${r} ${r} 0 0 1 ${r} -${r}H${n(x + w - r)}a${r} ${r} 0 0 1 ${r} ${r}V${n(y + S.strip)}Z`;
  const ink = ext ? "#ffffff" : navy;
  const base = y + S.strip * 0.7;
  const out = [
    `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${r}" fill="white"/>`,
    `<path d="${strip}" fill="${ext ? navy : C.pale}"/>`,
    `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${r}" fill="none" stroke="${ext ? navy : C.edge}" stroke-width="${ext ? 0.5 : 0.35}"/>`,
    textSvg([{ text: label, style: "bold" }], x + S.padX, base, S.numberSize, ink),
  ];
  if (ext) out.push(caps("EXTENSION", x + w - S.padX, y + S.strip * 0.66, S.tagSize, "#ffffff", "end"));
  if (title.trim()) out.push(textSvg(parseRuns(title, "bold", maths), x + S.padX + plainWidth(label, S.numberSize, "bold") + 2.4, base, SIZE.body, ink));
  return out.join("");
}

function cardSvg(body: string, label: string, opts: StarterRenderOptions) {
  const P = STARTER.card;
  const style = opts.fontCss ? `<style>${opts.fontCss}</style>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${P.width}mm" height="${P.height}mm" viewBox="0 0 ${P.width} ${P.height}" font-family="Inter, sans-serif" role="img" aria-label="${esc(label)}">${style}<rect width="${P.width}" height="${P.height}" fill="white"/>${body}</svg>`;
}

/** The A4 print sheet: the card twice, top and bottom, with a dashed cut line between. */
function sheetSvg(body: string, label: string, opts: StarterRenderOptions) {
  const P = STARTER.sheet,
    C = STARTER.card;
  const style = opts.fontCss ? `<style>${opts.fontCss}</style>` : "";
  const gap = (P.height / 2 - C.height) / 2;
  const half = P.height / 2;
  const copy = (y: number) => `<g transform="translate(0,${n(y)})">${body}</g>`;
  const cut = `<line x1="0" y1="${n(half)}" x2="${P.width}" y2="${n(half)}" stroke="#8a8a8a" stroke-width="0.25" stroke-dasharray="2 1.5"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${P.width}mm" height="${P.height}mm" viewBox="0 0 ${P.width} ${P.height}" font-family="Inter, sans-serif" role="img" aria-label="${esc(label)}">${style}<rect width="${P.width}" height="${P.height}" fill="white"/>${copy(gap)}${copy(half + gap)}${cut}</svg>`;
}

export function renderStarterRun(saved: StarterRun, options: StarterRenderOptions = {}): RenderedStarters {
  const run = typesetForPrint(saved);
  const doc = run.document;
  const st = styles[options.style ?? "mathsdock"];
  const view = options.view ?? "pupil";
  const issues: StarterIssue[] = [];
  const ctx: Ctx<Where> = { st, view, diagrams: 0, issues, where: { starter: 1 }, maths: doc.notation === "maths" };
  ctx.tooWide = starterTooWide(ctx);
  for (const c of missingCharacters({ text: doc.topic })) issues.push({ starter: 0, message: missingCharacterMessage("The topic", c) }); // starter 0: the whole run (the topic prints on every card)
  const cards: string[] = [];
  const sheets: string[] = [];
  doc.starters.forEach((starter, si) => {
    const out: string[] = [header(doc, si + 1, issues, st.navy)];
    starter.cards.forEach((card, qi) => {
      ctx.where = { starter: si + 1, question: qi + 1 };
      for (const c of missingCharacters(card)) issues.push({ ...ctx.where, message: missingCharacterMessage(`Starter ${si + 1}, question ${qi + 1}`, c) });
      const icon = doc.slots[qi]?.icon ?? "none";
      const place = slotContent(doc.template, qi, icon);
      const S = STARTER;
      const ext = isExtensionSlot(doc.template, qi);
      const label = String(qi + 1);
      const lay = cardLayout(doc.template, qi, card, !!ctx.maths);
      out.push(cardFrame(place.box, label, lay.stripTitle, ext, st.navy, !!ctx.maths));
      if (lay.stripTitle) {
        const room = lay.room;
        const runs = parseRuns(lay.stripTitle, "bold", ctx.maths);
        if (runs.some((r) => r.frac)) issues.push({ ...ctx.where, message: `Starter ${si + 1}, question ${qi + 1}: the instruction holds a fraction, which would not fit in the card's header strip. Put the fraction in the question.` });
        if (lineWidth(runs, SIZE.body) > room) issues.push({ ...ctx.where, message: `Starter ${si + 1}, question ${qi + 1}: the instruction is wider than its card's header strip. Shorten it or move words into the question.` });
      }
      // Spare height goes to working spaces, as on worksheets.
      const natural: Frag = items(lay.items, place.w, { ...ctx, issues: [], diagrams: 0, inline: undefined }, 0);
      const spare = place.height - natural.h;
      const spaces = countSpaces(lay.items);
      const body = items(lay.items, place.w, ctx, spare > 0 && spaces ? spare / spaces : 0);
      if (spare < -0.05) issues.push({ ...ctx.where, message: `Starter ${si + 1}, question ${qi + 1} needs ${n(-spare)} mm more height. Shorten the question or make its diagram smaller; text is never shrunk.` });
      if (card.stage) issues.push({ ...ctx.where, message: `Starter ${si + 1}, question ${qi + 1} has a stage band ("${card.stage}"), which starters do not print. Remove it.` });
      out.push(at(body, place.x, place.top));
      if (icon !== "none") out.push(iconSvg(icon, place.box.x + place.box.w - S.padX - S.icon + 0.5, place.box.y + place.box.h - S.padBottom - S.icon));
    });
    const name = `${doc.title}, silent starter ${si + 1} of ${doc.starters.length}${view === "answers" ? ", answers" : ""}`;
    const body = out.join("");
    cards.push(cardSvg(body, name, options));
    sheets.push(sheetSvg(body, `${name}, two copies to cut`, options));
  });
  return { cards, sheets, issues };
}

const safe = (s: string) => s.replace(/[^A-Za-z0-9.-]+/g, "-").replace(/^-+|-+$/g, "") || "run";

/** File names follow `[title]_Silent-starters.pdf` and `..._Silent-starters_Answers.pdf`; one starter adds `_[n]`. */
export function starterFileName(run: StarterRun, view: View = "pupil", starter?: number, ext = "pdf"): string {
  const one = starter ? `_${starter}` : "";
  return `${safe(run.document.title)}_Silent-starters${one}${view === "answers" ? "_Answers" : ""}.${ext}`;
}

/** The header on its own, 196 × 12 mm, for Word (which places it as a picture above the slot table). */
export function starterHeaderSvg(run: StarterRun, number: number, issues: StarterIssue[] = []): string {
  const S = STARTER;
  const w = S.card.width - 2 * S.margin;
  const doc = typesetForPrint(run).document;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${S.header}mm" viewBox="${S.margin} ${S.margin} ${w} ${S.header}" font-family="Inter, sans-serif" role="img" aria-label="${esc(`Silent starter ${number} of ${doc.starters.length}${doc.topic ? `: ${doc.topic}` : ""}`)}">${header(doc, number, issues, styles.mathsdock.navy)}</svg>`;
}

/** A slot's icon on its own, for Word. */
export function starterIconSvg(icon: Exclude<StarterIcon, "none">): string {
  const s = STARTER.icon;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s + 1}mm" height="${s + 1}mm" viewBox="-0.5 -0.5 ${s + 1} ${s + 1}" role="img" aria-label="${icon} icon">${iconSvg(icon, 0, 0).replace('stroke-width="0.45"', 'stroke-width="0.9"')}</svg>`;
}
