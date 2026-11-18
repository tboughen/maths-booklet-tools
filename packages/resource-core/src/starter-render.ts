import { typesetForPrint } from "./typeset";
import { FAMILIES, type DiagramKind } from "../../diagram-core/src/registry";
import { at, countSpaces, items, missingCharacterMessage, missingCharacters, type Ctx, type Frag, type View } from "./render";
import { SIZE, styles, type StyleId } from "./style";
import { esc, lineWidth, n, parseRuns, plainWidth, textSvg } from "./text";
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
  header: 12,
  headerRule: 0.5,
  title: 16 * pt,
  trackerSize: 13 * pt,
  numberSize: 14 * pt,
  slotRule: 0.35,
  /** The bar before the extension column (option C). */
  extensionRule: 1.3,
  extensionBand: 5.5,
  /** Wide enough that a diagram at its full allowed width stays clear of the 1.3 mm extension bar. */
  padX: 3.5,
  padTop: 2.2,
  padBottom: 2,
  icon: 8,
  logo: 10,
  colours: { title: "#1d6fd6", underline: "#d32f2f", tracker: "#e8711a", number: "#1e8e3e", rule: "#000000", tint: "#efefef" },
} as const;

export interface StarterIssue {
  /** 1-based starter in the run. */
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

/** Each slot's box inside the question area: four go two by two in reading order; six go down the columns (1 2 | 3 4 | 5 6). */
export function slotBoxes(template: StarterTemplate): { x: number; y: number; w: number; h: number }[] {
  const S = STARTER;
  const x0 = S.margin,
    y0 = S.margin + S.header,
    W = S.card.width - 2 * S.margin,
    H = S.card.height - 2 * S.margin - S.header;
  if (template === "four") return [0, 1, 2, 3].map((i) => ({ x: x0 + (i % 2) * (W / 2), y: y0 + Math.floor(i / 2) * (H / 2), w: W / 2, h: H / 2 }));
  return [0, 1, 2, 3, 4, 5].map((i) => ({ x: x0 + Math.floor(i / 2) * (W / 3), y: y0 + (i % 2) * (H / 2), w: W / 3, h: H / 2 }));
}

/** The question area inside a slot: below the number line, above the icon. Shared with Word. */
export function slotContent(template: StarterTemplate, slot: number, icon: StarterIcon) {
  const S = STARTER;
  const box = slotBoxes(template)[slot];
  const band = isExtensionSlot(template, slot) && slot === 4 ? S.extensionBand : 0;
  const head = SIZE.body * SIZE.lineHeight;
  const numberLine = Math.max(head, S.numberSize * 1.15);
  const top = box.y + band + S.padTop + numberLine + SIZE.itemGap;
  const bottom = box.y + box.h - S.padBottom - (icon === "none" ? 0 : S.icon + 1.5);
  return { box, band, numberTop: box.y + band + S.padTop, numberLine, x: box.x + S.padX, w: box.w - 2 * S.padX, top, height: bottom - top };
}

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

function header(doc: StarterRun["document"], number: number, issues: StarterIssue[]): string {
  const S = STARTER,
    C = S.colours;
  const x0 = S.margin,
    right = S.card.width - S.margin;
  const mid = S.margin + S.header / 2;
  const out: string[] = [];
  const titleW = plainWidth("Silent starter", S.title, "bold");
  const tb = mid + S.title * 0.36 - 0.6;
  out.push(textSvg([{ text: "Silent starter", style: "bold" }], x0, tb, S.title, C.title));
  out.push(`<rect x="${n(x0)}" y="${n(tb + 1.4)}" width="${n(titleW)}" height="0.7" fill="${C.underline}"/>`);
  let x = x0 + titleW + 5;
  const body = SIZE.body;
  out.push(textSvg(parseRuns("On your sheet"), x, mid + body * 0.36, body, "#000"));
  x += plainWidth("On your sheet", body) + 5;
  // The run tracker: [ 1 2 3 4 5 6 ] with today's starter boxed, as on Tim's sheets.
  const t = S.trackerSize,
    cell = 5,
    ty = mid + t * 0.36;
  const total = doc.starters.length;
  out.push(textSvg([{ text: "[", style: "bold" }], x, ty, t, C.tracker));
  x += plainWidth("[", t, "bold") + 1;
  for (let i = 1; i <= total; i++) {
    const cx = x + cell / 2;
    if (i === number) out.push(`<rect x="${n(x + 0.3)}" y="${n(mid - cell / 2)}" width="${n(cell - 0.6)}" height="${cell}" fill="none" stroke="#000" stroke-width="0.5"/>`);
    out.push(textSvg([{ text: String(i), style: "bold" }], cx, ty, t, i === number ? "#000" : C.tracker, "middle"));
    x += cell;
  }
  out.push(textSvg([{ text: "]", style: "bold" }], x + 1, ty, t, C.tracker));
  x += 1 + plainWidth("]", t, "bold") + 5;
  let topicRight = right;
  if (doc.logo) {
    const L = S.logo;
    out.push(`<image x="${n(right - L)}" y="${n(mid - L / 2)}" width="${L}" height="${L}" preserveAspectRatio="xMidYMid meet" href="${esc(doc.logo)}"/>`);
    topicRight -= L + 3;
  }
  if (doc.topic.trim()) {
    const topic = fitLine(doc.topic, body, Math.max(0, topicRight - x), "bold");
    if (topic !== doc.topic) issues.push({ starter: number, message: `Starter ${number}: the topic is wider than the header has room for, so it is cut short. Shorten the topic.` });
    out.push(textSvg([{ text: topic, style: "bold" }], topicRight, mid + body * 0.36, body, "#000", "end"));
  }
  out.push(`<rect x="${n(x0)}" y="${n(S.margin + S.header - S.headerRule)}" width="${n(right - x0)}" height="${S.headerRule}" fill="#000"/>`);
  return out.join("");
}

/** The slot grid: thin rules between slots and, for core-extension, the tinted extension column (option C). */
function grid(template: StarterTemplate): string {
  const S = STARTER;
  const boxes = slotBoxes(template);
  const out: string[] = [];
  const top = S.margin + S.header,
    bottom = S.card.height - S.margin,
    left = S.margin,
    right = S.card.width - S.margin;
  if (template === "core-extension") {
    const col = boxes[4];
    out.push(`<rect x="${n(col.x)}" y="${n(top)}" width="${n(right - col.x)}" height="${n(bottom - top)}" fill="${S.colours.tint}"/>`);
    out.push(`<rect x="${n(col.x)}" y="${n(top)}" width="${n(right - col.x)}" height="${S.extensionBand}" fill="#000"/>`);
    const size = 9 * pt;
    out.push(`<text x="${n((col.x + right) / 2)}" y="${n(top + S.extensionBand / 2 + size * 0.36)}" font-size="${n(size)}" font-weight="600" fill="white" text-anchor="middle" letter-spacing="0.6">EXTENSION</text>`);
  }
  const line = (x1: number, y1: number, x2: number, y2: number, w: number = S.slotRule) => `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="#000" stroke-width="${w}"/>`;
  const midY = top + (bottom - top) / 2;
  if (template === "four") {
    out.push(line((left + right) / 2, top, (left + right) / 2, bottom), line(left, midY, right, midY));
  } else {
    const third = (right - left) / 3;
    out.push(line(left + third, top, left + third, bottom));
    const extension = template === "core-extension";
    out.push(line(left + 2 * third, top, left + 2 * third, bottom, extension ? S.extensionRule : S.slotRule));
    out.push(line(left, midY, extension ? left + 2 * third : right, midY));
    if (extension) out.push(line(left + 2 * third, midY, right, midY));
  }
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
  ctx.tooWide = (tool, width, room) => `Starter ${ctx.where.starter}, question ${ctx.where.question}: the ${FAMILIES[tool as DiagramKind]?.label ?? `${tool} diagram`} is ${n(width)} mm wide and the slot has ${n(room)} mm. Draw it smaller in its tool; diagrams and labels are never shrunk to fit.`;
  for (const c of missingCharacters({ topic: doc.topic })) issues.push({ starter: 1, message: missingCharacterMessage("The topic", c) });
  const cards: string[] = [];
  const sheets: string[] = [];
  doc.starters.forEach((starter, si) => {
    const out: string[] = [grid(doc.template), header(doc, si + 1, issues)];
    starter.cards.forEach((card, qi) => {
      ctx.where = { starter: si + 1, question: qi + 1 };
      for (const c of missingCharacters(card)) issues.push({ ...ctx.where, message: missingCharacterMessage(`Starter ${si + 1}, question ${qi + 1}`, c) });
      const icon = doc.slots[qi]?.icon ?? "none";
      const place = slotContent(doc.template, qi, icon);
      // Number and instruction on one line: a green "3)" then the card title in bold.
      const S = STARTER;
      const label = `${qi + 1})`;
      const numberBase = place.numberTop + place.numberLine * 0.78;
      out.push(textSvg([{ text: label, style: "bold" }], place.x, numberBase, S.numberSize, S.colours.number));
      const tx = place.x + plainWidth(label, S.numberSize, "bold") + 2;
      if (card.title.trim()) {
        const room = place.x + place.w - tx;
        const runs = parseRuns(card.title, "bold", ctx.maths);
        if (runs.some((r) => r.frac)) issues.push({ ...ctx.where, message: `Starter ${si + 1}, question ${qi + 1}: the instruction holds a fraction, which would not fit on the number line. Put the fraction in the question.` });
        if (lineWidth(runs, SIZE.body) > room) issues.push({ ...ctx.where, message: `Starter ${si + 1}, question ${qi + 1}: the instruction is wider than its slot. Shorten it or move words into the question.` });
        out.push(textSvg(parseRuns(card.title, "bold", ctx.maths), tx, numberBase, SIZE.body, "#000"));
      }
      // Spare height goes to working spaces, as on worksheets.
      const natural: Frag = items(card.items, place.w, { ...ctx, issues: [], diagrams: 0, inline: undefined }, 0);
      const spare = place.height - natural.h;
      const spaces = countSpaces(card.items);
      const body = items(card.items, place.w, ctx, spare > 0 && spaces ? spare / spaces : 0);
      if (spare < -0.05) issues.push({ ...ctx.where, message: `Starter ${si + 1}, question ${qi + 1} needs ${n(-spare)} mm more height. Shorten the question or make its diagram smaller; text is never shrunk.` });
      if (card.stage) issues.push({ ...ctx.where, message: `Starter ${si + 1}, question ${qi + 1} has a stage band ("${card.stage}"), which starters do not print. Remove it.` });
      // On the grey extension column a diagram's own white background would print as a white box.
      const svg = isExtensionSlot(doc.template, qi) ? body.svg.replace(/(<svg[^>]*\sviewBox="0 0 ([\d.]+) ([\d.]+)"[^>]*>)<rect width="\2" height="\3" fill="white"\/>/g, "$1") : body.svg;
      out.push(at({ h: body.h, svg }, place.x, place.top));
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
