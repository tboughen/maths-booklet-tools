import { typesetForPrint } from "./typeset";
import { answerRule, at, card, countSpaces, fractionBaseline, fractionLine, missingCharacterMessage, missingCharacters, type Ctx, type Frag, type View } from "./render";
import { SIZE, styles, type HouseStyle, type StyleId } from "./style";
import { esc, hasFraction, lineWidth, n, parseRuns, plainWidth, textSvg, wrap } from "./text";
import type { FontStyle } from "./metrics";
import { LESSON_WORDS, lessonLabels, lessonShift, lessonWords, sectionTitle, type LessonWords, type Booklet, type Intro, type Lesson, type QuestionLabel, type Retrieval, type Section } from "./booklet";

/**
 * Lays out an A4 portrait booklet. Each lesson starts on a new page; a section's heading stays
 * with its first row of cards; cards never split; spare height on a page goes to working and
 * drawing spaces (up to a limit) so pages are used, not ragged. Problems are reported, never
 * fixed by shrinking text.
 */
export const A4 = {
  page: { width: 210, height: 297 },
  marginX: 12,
  top: 12,
  /** Content stops here; the footer sits below. */
  bottom: 281,
  footerRule: 285.5,
  footerBase: 290.5,
  columnGap: 5,
  rowGap: 3.5,
  sectionGap: 6,
  lessonTile: 9,
  lessonTitle: 16 * 0.3528,
  coverTitle: 24 * 0.3528,
  heading: 12 * 0.3528,
  small: 10 * 0.3528,
  /** The footer's page number: bold and larger than body text so pupils find the right page. */
  pageNumber: 14 * 0.3528,
  /** Spare page height given to each working or drawing space is capped, so one short row never gets a page of space. */
  maxExtra: 40,
} as const;
const W = A4.page.width - 2 * A4.marginX;
export const BOOKLET_WIDTHS = { full: W, half: (W - A4.columnGap) / 2 } as const;

export interface BookletIssue {
  /** 1-based lesson number; 0 for the cover and introduction. */
  lesson: number;
  /** 1-based section within the lesson, when the issue belongs to one. */
  section?: number;
  /** The question's printed label (a number or a letter), when the issue belongs to one card. */
  question?: number | string;
  /** 1-based printed page. */
  page?: number;
  /** The issue is on the fold-over retrieval page. */
  retrieval?: boolean;
  message: string;
}
export interface BookletRenderOptions {
  view?: View;
  style?: StyleId;
  fontCss?: string;
  /** For a lesson printed on its own from a one-lesson booklet: added to the printed lesson
   * and page numbers so they match the full booklet. */
  numbering?: { lessonOffset: number; pageOffset: number };
}
export interface RenderedBooklet {
  /** One SVG per A4 page, 210 × 297 mm, user units in millimetres, in reading order. */
  pages: string[];
  issues: BookletIssue[];
  /** First page of each lesson (1-based), for contents and editors. */
  lessonPages: number[];
  /** The introduction's page, or null. */
  introPage: number | null;
  /** The fold-over retrieval page (the last page), or null. */
  retrievalPage: number | null;
}

type W = { lesson: number; section?: number; question?: number | string; page?: number };
type BCtx = Ctx<W>;
const S = SIZE;
const lh = (size: number) => size * S.lineHeight;
const base = (size: number) => (lh(size) - size) / 2 + size * 0.82;

function para(src: string, width: number, st: HouseStyle, o: { size?: number; fill?: string; style?: FontStyle; x?: number; maths?: boolean } = {}): Frag {
  const size = o.size ?? S.body;
  const lines = wrap(src, size, width, o.style, o.maths);
  return { h: lines.length * lh(size), svg: lines.map((l, i) => textSvg(l, o.x ?? 0, i * lh(size) + base(size), size, o.fill ?? st.ink)).join("") };
}
const rect = (x: number, y: number, w: number, h: number, attrs: string) => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" ${attrs}/>`;
const hline = (x1: number, x2: number, y: number, st: HouseStyle, width = 0.3) => `<line x1="${n(x1)}" y1="${n(y)}" x2="${n(x2)}" y2="${n(y)}" stroke="${st.rule}" stroke-width="${width}"/>`;

/** Fits a single line by cutting it with an ellipsis; only used for running headers and footers. */
export function fitLine(s: string, size: number, width: number, style: FontStyle = "regular") {
  if (plainWidth(s, size, style) <= width) return s;
  let t = s;
  while (t.length > 1 && plainWidth(t + "…", size, style) > width) t = t.slice(0, -1);
  return t.trimEnd() + "…";
}

/**
 * Lesson bookends and the corner badge (BOOKLET-STANDARD N11, Tim 18 November 2026): a navy start
 * block opens each lesson, a navy end band closes it in place of the last page's footer, and every
 * other page carries a "Lesson N" badge in its outer top corner with one square per stage (and C for
 * the Challenge work after the last stage, N12), the current one filled.
 */
export const BOOKEND = {
  /** Top of the start block and of the corner badge. */
  top: 5,
  /** The start block's least height, its padding and its white lesson tile. */
  startH: 23,
  startPad: 4,
  startPadY: 2,
  tile: 17,
  /** The corner badge, the stage squares beside it and the gap between them. */
  badgeW: 18,
  badgeH: 14,
  square: 10.5,
  squareGap: 1.6,
  badgeGap: 7,
  /** The end band sits in the footer's place on a lesson's last page. */
  endTop: 283,
  endH: 10,
  endTile: 7,
  start: "START",
  stop: "STOP",
  /** The square for the Challenge work after the last stage (N12: was E). */
  challenge: "C",
} as const;
/** Unlit stage squares: pale blue with a grey-blue figure, so the lit one stands out and photocopies pale. */
export const STAGE_UNLIT = "#8aa0ba";
/** On a lesson's later pages the content starts this far below the page top margin, under the corner badge. */
export const BADGE_HEAD = BOOKEND.top + BOOKEND.badgeH + 2 - A4.top;
const pt = (v: number) => v * 0.3528;

/** The unit's name on the start block: the booklet title, led by its code when the title does not already start with a unit code. */
export function unitLabel(doc: Booklet["document"]): string {
  const title = doc.title.trim();
  const code = doc.code.trim().replace(/\..*$/, "");
  return !code || /^[A-Z]{1,3}\d+\b/.test(title) ? title : `${code} ${title}`;
}

/** The start block's text width, shared with Word. */
export const startTextX = () => BOOKEND.startPad + BOOKEND.tile + 5;
export const startTextWidth = () => W - startTextX() - BOOKEND.startPad - plainWidth(BOOKEND.start, pt(14), "bold") - 6;

/** The start block's unit and title sizes, and its height, shared with Word. */
export const START_SIZES = { unit: pt(11), title: pt(14), gap: 0.6 } as const;
export function startBlockHeight(doc: Booklet["document"], lesson: Lesson): number {
  const unit = unitLabel(doc);
  const textH = (unit ? wrap(unit, START_SIZES.unit, startTextWidth(), "bold").length * lh(START_SIZES.unit) + START_SIZES.gap : 0) + wrap(lesson.title, START_SIZES.title, startTextWidth(), "bold").length * lh(START_SIZES.title);
  return Math.max(BOOKEND.startH, textH + 2 * BOOKEND.startPadY);
}

/**
 * The "Did you know?" box (N12, option H chosen by Tim 18 November 21:05): set out like a phone
 * notification, distinct from the pale key idea box. A white full-width box with a thin grey-blue
 * edge, rounded corners and a pale drop line under it; a navy lightbulb icon and "DID YOU KNOW?"
 * in small bold navy capitals on its top line; the fact under them at 10 pt. Shared with Word.
 */
export const DID_YOU_KNOW = {
  gap: 2.5,
  padX: 3.5,
  padTop: 1.4,
  padBottom: 1.6,
  labelLine: 4.4,
  icon: 3.6,
  iconGap: 1.4,
  edge: 0.35,
  edgeColour: "#9aa9c0",
  radius: 3.5,
  drop: 0.6,
  size: pt(10),
  label: "DID YOU KNOW?",
  tracking: 0.25,
} as const;
/** The box's text lines and heights: `h` is the box, `total` adds the drop line under it. */
/**
 * A fact reads maths (powers such as 2^10) when the booklet does, unless it holds a stacked fraction:
 * the box keeps plain line height, so a fraction stays as typed rather than crowding the lines.
 */
export const didYouKnowMaths = (fact: string, maths: boolean) => maths && !/\{[^{}/]{1,12}\/[^{}/]{1,12}\}/.test(fact);
export function didYouKnowBox(fact: string, maths = false): { lines: number; h: number; total: number } {
  const D = DID_YOU_KNOW;
  const lines = wrap(fact.trim(), D.size, W - 2 * D.padX, "regular", didYouKnowMaths(fact, maths)).length;
  const h = D.padTop + D.labelLine + lines * lh(D.size) + D.padBottom;
  return { lines, h, total: h + D.drop };
}
/** The navy lightbulb icon, `s` millimetres square, as SVG content at the origin. */
export function didYouKnowIcon(s: number, navy: string): string {
  return (
    `<g transform="scale(${n(s / 16)})"><rect width="16" height="16" rx="4" fill="${navy}"/>` +
    `<path d="M8 3 a3.6 3.6 0 0 1 2.3 6.4 v1.6 h-4.6 v-1.6 A3.6 3.6 0 0 1 8 3 z" fill="white"/>` +
    `<path d="M6.2 12.8 h3.6" stroke="white" stroke-width="1.1" stroke-linecap="round" fill="none"/></g>`
  );
}

/** The lesson's start block: tile, unit, title and START; then the key idea. */
function lessonHead(doc: Booklet["document"], lesson: Lesson, number: number, st: HouseStyle): Frag {
  const B = BOOKEND;
  const out: string[] = [];
  const tx = startTextX();
  const unit = unitLabel(doc);
  const unitF = unit ? para(unit, startTextWidth(), st, { size: START_SIZES.unit, fill: "white", style: "bold", x: tx }) : { h: 0, svg: "" };
  const title = para(lesson.title, startTextWidth(), st, { size: START_SIZES.title, fill: "white", style: "bold", x: tx });
  const textH = unitF.h + (unit ? START_SIZES.gap : 0) + title.h;
  const h = startBlockHeight(doc, lesson);
  out.push(rect(0, 0, W, h, `rx="2" fill="${st.navy}"`));
  const ty = (h - B.tile) / 2;
  out.push(rect(B.startPad, ty, B.tile, B.tile, `rx="1.6" fill="white"`));
  out.push(textSvg([{ text: lessonWords(doc).badge, style: "bold" }], B.startPad + B.tile / 2, ty + 5.4, pt(10), st.navy, "middle"));
  out.push(textSvg([{ text: String(number), style: "bold" }], B.startPad + B.tile / 2, ty + 14.6, pt(26), st.navy, "middle"));
  const y0 = (h - textH) / 2;
  out.push(at(unitF, 0, y0), at(title, 0, y0 + unitF.h + (unit ? START_SIZES.gap : 0)));
  out.push(textSvg([{ text: B.start, style: "bold" }], W - B.startPad, h / 2 + pt(14) * 0.36, pt(14), "white", "end"));
  // One title line (N2): the lesson's code and objective are not printed again under it.
  let y = h;
  if (lesson.keyIdea.trim()) {
    y += 3;
    const box = keyIdeaBox(lesson.keyIdea, st, doc.notation === "maths");
    out.push(at(box, 0, y));
    y += box.h;
  }
  if (lesson.didYouKnow.trim()) {
    const D = DID_YOU_KNOW;
    const b = didYouKnowBox(lesson.didYouKnow, doc.notation === "maths");
    y += D.gap;
    out.push(rect(0, y + D.drop, W, b.h, `rx="${D.radius}" fill="${st.tint}"`));
    out.push(rect(D.edge / 2, y + D.edge / 2, W - D.edge, b.h - D.edge, `rx="${D.radius}" fill="white" stroke="${D.edgeColour}" stroke-width="${D.edge}"`));
    out.push(`<g transform="translate(${n(D.padX)},${n(y + D.padTop + (D.labelLine - D.icon) / 2)})">${didYouKnowIcon(D.icon, st.navy)}</g>`);
    const label = textSvg([{ text: D.label, style: "bold" }], D.padX + D.icon + D.iconGap, y + D.padTop + D.labelLine / 2 + D.size * 0.36, D.size, st.navy);
    out.push(label.replace("<text ", `<text letter-spacing="${D.tracking}" `));
    out.push(at(para(lesson.didYouKnow.trim(), W - 2 * D.padX, st, { size: D.size, x: D.padX, maths: didYouKnowMaths(lesson.didYouKnow, doc.notation === "maths") }), 0, y + D.padTop + D.labelLine));
    y += b.total;
  }
  return { h: y, svg: out.join("") };
}

/** Which stage squares a lesson shows: one per START banner, then C when work follows the last STOP banner. */
export function stageSquares(lesson: Lesson): string[] {
  const starts = lesson.sections.filter((s) => s.startBanner.trim()).length;
  if (!starts) return [];
  const squares = Array.from({ length: starts }, (_, i) => String(i + 1));
  // C only when some section is lit C: work after the last stage's own STOP banner.
  return sectionStages(lesson).includes(BOOKEND.challenge) ? [...squares, BOOKEND.challenge] : squares;
}

/** The lit square for each section: its stage, C after the last stage's STOP banner, or null before the first stage. */
export function sectionStages(lesson: Lesson): (string | null)[] {
  const total = lesson.sections.filter((s) => s.startBanner.trim()).length;
  let count = 0;
  let cur: string | null = null;
  return lesson.sections.map((s) => {
    if (s.startBanner.trim()) cur = String(++count);
    const here = cur;
    if (s.endBanner.trim() && count === total) cur = BOOKEND.challenge;
    return here;
  });
}

/** The corner badge and stage squares, in the outer corner: right on odd printed pages, left on even. */
export function cornerBadge(number: number, squares: string[], lit: string | null, pageNo: number, st: HouseStyle, words: LessonWords = LESSON_WORDS): string {
  const B = BOOKEND;
  const right = pageNo % 2 === 1;
  const bx = right ? A4.marginX + W - B.badgeW : A4.marginX;
  const out = [
    rect(bx, B.top, B.badgeW, B.badgeH, `rx="1.6" fill="${st.navy}"`),
    textSvg([{ text: words.badge, style: "bold" }], bx + B.badgeW / 2, B.top + 4.6, pt(10), "white", "middle"),
    textSvg([{ text: String(number), style: "bold" }], bx + B.badgeW / 2, B.top + 12.2, pt(24), "white", "middle"),
  ];
  const run = squares.length * B.square + Math.max(0, squares.length - 1) * B.squareGap;
  let x = right ? bx - B.badgeGap - run : bx + B.badgeW + B.badgeGap;
  const sy = B.top + (B.badgeH - B.square) / 2;
  for (const sq of squares) {
    const on = sq === lit;
    out.push(rect(x, sy, B.square, B.square, `rx="1.4" fill="${on ? st.navy : st.tint}"`));
    out.push(textSvg([{ text: sq, style: "bold" }], x + B.square / 2, sy + B.square / 2 + pt(16) * 0.36, pt(16), on ? "white" : STAGE_UNLIT, "middle"));
    x += B.square + B.squareGap;
  }
  return out.join("");
}

/** The end band on a lesson's last page, in the footer's place: lesson tile, "End of lesson N", the page number and STOP. */
export function endBand(number: number, pageNo: number, st: HouseStyle, words: LessonWords = LESSON_WORDS): string {
  const B = BOOKEND;
  const x0 = A4.marginX;
  const y = B.endTop;
  const size = pt(14);
  const by = y + B.endH / 2 + size * 0.36;
  const tile = (B.endH - B.endTile) / 2;
  return [
    rect(x0, y, W, B.endH, `rx="1.6" fill="${st.navy}"`),
    rect(x0 + 3, y + tile, B.endTile, B.endTile, `rx="1" fill="white"`),
    textSvg([{ text: String(number), style: "bold" }], x0 + 3 + B.endTile / 2, by, size, st.navy, "middle"),
    textSvg([{ text: `${words.end} ${number}`, style: "bold" }], x0 + 3 + B.endTile + 3, by, size, "white"),
    textSvg([{ text: `Page ${pageNo}`, style: "bold" }], x0 + W / 2, by, size, "white", "middle"),
    textSvg([{ text: B.stop, style: "bold" }], x0 + W - 5, by, size, "white", "end"),
  ].join("");
}

/** The key idea box's geometry, shared with Word: "Key idea" in a left cell, the ideas in a right cell, each on its own line. */
export const KEY_IDEA = { pad: 3, bar: 1.1, label: "Key idea", gap: 6, ideaGap: 1 } as const;
export const keyIdeaLabelWidth = () => KEY_IDEA.bar + KEY_IDEA.pad + plainWidth(KEY_IDEA.label, S.body, "bold") + KEY_IDEA.gap;
/** The ideas of a key idea: one per line break, blank lines dropped. */
export const keyIdeas = (keyIdea: string) =>
  keyIdea
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

/**
 * One idea of a key idea, wrapped to the box. With maths notation on, {3/4} prints stacked, and
 * every line of an idea holding a fraction is a fraction line high (as in card text), so Word and
 * the PDF keep the same fixed height.
 */
export function keyIdeaLines(idea: string, width: number, maths: boolean) {
  const lines = wrap(idea, S.body, width, "regular", maths);
  const frac = lines.some(hasFraction);
  const line = frac ? fractionLine(S.body) : lh(S.body);
  return { lines, frac, line, h: lines.length * line, first: frac ? fractionBaseline(S.body) : base(S.body) };
}
/** The key idea text cell's width, shared with Word. */
export const keyIdeaTextWidth = () => W - keyIdeaLabelWidth() - KEY_IDEA.pad;

/** Key idea box (N3): two cells, "Key idea" on the left, the text on the right with a clear gap. */
function keyIdeaBox(keyIdea: string, st: HouseStyle, maths: boolean): Frag {
  const K = KEY_IDEA;
  const left = keyIdeaLabelWidth();
  const tw = keyIdeaTextWidth();
  const out: string[] = [];
  let y = 0;
  keyIdeas(keyIdea).forEach((idea, i) => {
    if (i) y += K.ideaGap;
    const f = keyIdeaLines(idea, tw, maths);
    // Without a fraction or a power the idea prints exactly as a paragraph always has.
    const svg = f.frac || f.lines.some((l) => l.some((r) => r.sup)) ? f.lines.map((l, k) => textSvg(l, left, k * f.line + f.first, S.body, st.ink)).join("") : para(idea, tw, st, { x: left, maths }).svg;
    out.push(at({ h: f.h, svg }, 0, y));
    y += f.h;
  });
  const h = y + K.pad * 2;
  return {
    h,
    svg:
      rect(0, 0, W, h, `rx="1.4" fill="${st.tint}"`) +
      rect(0, 0, K.bar, h, `fill="${st.navy}"`) +
      textSvg(parseRuns(K.label, "bold"), K.bar + K.pad, K.pad + base(S.body), S.body, st.navy) +
      at({ h: y, svg: out.join("") }, 0, K.pad),
  };
}

/** Cycle banners: a full-width navy band, the label in white bold on the left and START or STOP on the right. */
export const BANNER = { h: 8, gap: 2.5, pad: 3, start: "START", end: "STOP" } as const;
export function bannerFrag(label: string, end: boolean, st: HouseStyle): Frag {
  const tag = end ? BANNER.end : BANNER.start;
  const y = BANNER.h / 2 + S.body * 0.36;
  const room = W - 2 * BANNER.pad - plainWidth(tag, S.body, "bold") - 6;
  return {
    h: BANNER.h,
    svg:
      rect(0, 0, W, BANNER.h, `rx="1.4" fill="${st.navy}"`) +
      textSvg(parseRuns(fitLine(label, S.body, room, "bold"), "bold"), BANNER.pad, y, S.body, "white") +
      textSvg([{ text: tag, style: "bold" }], W - BANNER.pad, y, S.body, "white", "end"),
  };
}

function sectionHead(section: Section, st: HouseStyle, continued: boolean): Frag {
  const title = sectionTitle(section) + (continued ? " (continued)" : "");
  const tw = plainWidth(title, A4.heading, "bold");
  const out = [textSvg(parseRuns(title, "bold"), 0, base(A4.heading), A4.heading, st.navy)];
  let h = lh(A4.heading);
  const ins = continued ? "" : section.instruction.trim();
  if (ins) {
    const room = W - tw - 4;
    if (plainWidth(ins, A4.small) <= room) out.push(textSvg(parseRuns(ins), tw + 4, base(A4.heading), A4.small, st.muted));
    else {
      const f = para(ins, W, st, { size: A4.small, fill: st.muted });
      out.push(at(f, 0, h));
      h += f.h;
    }
  }
  out.push(`<rect x="0" y="${n(h + 0.8)}" width="${n(W)}" height="0.5" fill="${st.navy}"/>`);
  return { h: h + 3.8, svg: out.join("") };
}

/**
 * A row of cards on the page. In a two-column section a row is a pair side by side, one wide card
 * across both columns, or a tall card in one column beside 2 to 6 cards stacked in the other.
 */
export type RowShape = { kind: "pair" } | { kind: "wide" } | { kind: "tall"; side: "left" | "right" };
interface Row {
  cards: { index: number; number: QuestionLabel }[];
  shape: RowShape;
  /** Natural height, before spare space. */
  h: number;
  /** How much the row grows per mm of extra: the most spaces in one card, or in one column of a tall row. */
  spaces: number;
}

/** Where a card of a row sits: its left edge and width, its top within the row and the height it is drawn at. */
export interface CardPlace {
  index: number;
  number: QuestionLabel;
  x: number;
  w: number;
  dy: number;
  h: number;
  /** A tall row: 0 for the tall card, 1, 2… for the stacked ones (Word builds the row from these). */
  slot: number;
}

/** The cards of a section grouped into rows (wide and tall cards in two-column sections). */
export function groupRows(section: Section, labels: QuestionLabel[]): { cards: { index: number; number: QuestionLabel }[]; shape: RowShape }[] {
  const rows: { cards: { index: number; number: QuestionLabel }[]; shape: RowShape }[] = [];
  const cards = section.cards;
  const at = (i: number) => ({ index: i, number: labels[i] });
  const special = (i: number) => section.columns === 2 && (!!cards[i]?.wide || !!cards[i]?.tall);
  for (let i = 0; i < cards.length; ) {
    const c = cards[i];
    if (section.columns === 1) {
      rows.push({ cards: [at(i)], shape: { kind: "pair" } });
      i += 1;
    } else if (c.wide) {
      rows.push({ cards: [at(i)], shape: { kind: "wide" } });
      i += 1;
    } else if (c.tall) {
      // The stacked cards end early at a wide or tall card, or at the section's end (reported);
      // with fewer than two beside it the tall card prints as an ordinary pair.
      let k = 0;
      while (k < c.tall && i + 1 + k < cards.length && !special(i + 1 + k)) k++;
      rows.push({ cards: Array.from({ length: k + 1 }, (_, j) => at(i + j)), shape: k >= 2 ? { kind: "tall", side: c.tallSide ?? "left" } : { kind: "pair" } });
      i += k + 1;
    } else {
      const two = i + 1 < cards.length && !special(i + 1);
      rows.push({ cards: two ? [at(i), at(i + 1)] : [at(i)], shape: { kind: "pair" } });
      i += two ? 2 : 1;
    }
  }
  return rows;
}

/** Layout problems with wide and tall cards, in the section's own words. */
export function spanIssues(section: Section): string[] {
  const out: string[] = [];
  section.cards.forEach((c, i) => {
    if (section.columns === 1 && (c.wide || c.tall)) out.push(`Card ${i + 1} is set ${c.wide ? "wide" : "tall"}, which needs a two-column section; it prints as an ordinary full-width card.`);
    if (c.wide && c.tall) out.push(`Card ${i + 1} is set both wide and tall. Choose one.`);
    if (section.columns === 2 && c.tall && !c.wide) {
      let k = 0;
      while (k < c.tall && i + 1 + k < section.cards.length && !section.cards[i + 1 + k].wide && !section.cards[i + 1 + k].tall) k++;
      if (k < c.tall) out.push(`Card ${i + 1} stands beside ${c.tall} cards, but only ${k} ${k === 1 ? "follows it" : "follow it"} before ${i + 1 + k < section.cards.length ? "a wide or tall card" : "the section ends"}.`);
    }
  });
  return out;
}

/** Card widths in a section. */
const widthsOf = (section: Section) => (section.columns === 2 ? BOOKLET_WIDTHS.half : BOOKLET_WIDTHS.full);

/**
 * Places a row's cards for a row height of `rowH` (natural height plus spare space). `measure`
 * gives a card's own height at a width with this page's extra. A pair pads every card to the row;
 * a tall row pads the tall card to the row and shares what is left among the stacked cards.
 */
export function placeRow(section: Section, row: { cards: { index: number; number: QuestionLabel }[]; shape: RowShape }, rowH: number, measure: (index: number, w: number) => number): CardPlace[] {
  const half = widthsOf(section);
  const step = half + A4.columnGap;
  if (row.shape.kind === "wide") return [{ ...row.cards[0], x: 0, w: BOOKLET_WIDTHS.full, dy: 0, h: rowH, slot: 0 }];
  if (row.shape.kind === "pair") return row.cards.map((c, k) => ({ ...c, x: k * step, w: half, dy: 0, h: rowH, slot: 0 }));
  const [tall, ...stack] = row.cards;
  const tallX = row.shape.side === "left" ? 0 : step;
  const stackX = row.shape.side === "left" ? step : 0;
  const own = stack.map((c) => measure(c.index, half));
  const used = own.reduce((a, b) => a + b, 0) + (stack.length - 1) * A4.rowGap;
  const pad = Math.max(0, rowH - used) / stack.length;
  let dy = 0;
  const out: CardPlace[] = [{ ...tall, x: tallX, w: half, dy: 0, h: rowH, slot: 0 }];
  stack.forEach((c, j) => {
    out.push({ ...c, x: stackX, w: half, dy, h: own[j] + pad, slot: j + 1 });
    dy += own[j] + pad + A4.rowGap;
  });
  return out;
}

function rowsOf(section: Section, labels: QuestionLabel[], sectionNo: number, lessonNo: number, ctx: BCtx): Row[] {
  const half = widthsOf(section);
  return groupRows(section, labels).map((g) => {
    const quiet: BCtx = { ...ctx, issues: [], diagrams: 0 };
    const measure = (c: { index: number; number: QuestionLabel }, w: number) => {
      quiet.where = { lesson: lessonNo, section: sectionNo, question: c.number ?? undefined };
      return card(section.cards[c.index], c.number, w, quiet, 0, 0).h;
    };
    const spacesOf = (c: { index: number }) => countSpaces(section.cards[c.index].items);
    if (g.shape.kind === "tall") {
      const [tall, ...stack] = g.cards;
      const stackH = stack.reduce((a, c) => a + measure(c, half), 0) + (stack.length - 1) * A4.rowGap;
      return { ...g, h: Math.max(measure(tall, half), stackH), spaces: Math.max(spacesOf(tall), stack.reduce((a, c) => a + spacesOf(c), 0)) };
    }
    const w = g.shape.kind === "wide" ? BOOKLET_WIDTHS.full : half;
    return { ...g, h: Math.max(...g.cards.map((c) => measure(c, w))), spaces: Math.max(...g.cards.map(spacesOf)) };
  });
}

type Block =
  | { kind: "head"; frag: Frag }
  | { kind: "section"; section: number; continued: boolean; frag: Frag }
  | { kind: "row"; section: number; row: Row }
  | { kind: "banner"; section: number; end: boolean; frag: Frag };
interface PlannedPage {
  lesson: number;
  continued: boolean;
  blocks: { block: Block; y: number }[];
  end: number;
}

/**
 * Footer: only the page number, bold, larger and centred, so pupils find their page at a glance,
 * with no rule above it (N11: fewer lines). The unit name is on the cover and the lesson's start block.
 */
function footer(_doc: Booklet["document"], page: number, st: HouseStyle) {
  return textSvg([{ text: `Page ${page}`, style: "bold" }], A4.marginX + W / 2, A4.footerBase, A4.pageNumber, st.navy, "middle");
}

/** One printed line of a lesson's teaching notes, placed on a notes page. */
export interface NotesLine {
  kind: "title" | "subtitle" | "running" | "text";
  /** The line's runs as wrapped, or its plain text for headings. */
  text: string;
  y: number;
  size: number;
  /** Left indent of the text (mm), and a bullet drawn in the indent. */
  indent: number;
  bullet: boolean;
  /** A word too long for the line: it runs past the margin, so the notes need a shorter word. */
  tooWide?: boolean;
}
export interface NotesPage {
  /** 1-based lesson whose notes these are. */
  lesson: number;
  lines: NotesLine[];
}
/** Notes text at body size, one item a line: "- " starts a bullet, a blank line leaves a gap. */
export const NOTES = { bulletIndent: 5, gap: 2, titleGap: 3 } as const;

/**
 * The teaching notes of one lesson laid out on A4 pages (B21,
 * D5) printed as a file of their own: "Teaching notes" with the lesson number and title, then the notes line by line. A lesson's
 * notes start on a new page; lines never shrink, and a long note runs on to another page.
 */
export function planNotes(lesson: Lesson, lessonNo: number, words: LessonWords = LESSON_WORDS): NotesPage[] {
  const notes = lesson.teacherNotes.trim();
  if (!notes) return [];
  const pages: NotesPage[] = [];
  let lines: NotesLine[] = [];
  let y = A4.top;
  const fresh = () => {
    pages.push({ lesson: lessonNo, lines });
    lines = [{ kind: "running", text: `Teaching notes · ${words.name} ${lessonNo} (continued)`, y: A4.top, size: A4.small, indent: 0, bullet: false }];
    y = A4.top + CONTINUED_HEAD;
  };
  lines.push({ kind: "title", text: `Teaching notes · ${words.name} ${lessonNo}`, y, size: A4.lessonTitle, indent: 0, bullet: false });
  y += lh(A4.lessonTitle);
  lines.push({ kind: "subtitle", text: lesson.title, y, size: A4.small, indent: 0, bullet: false });
  y += lh(A4.small) + NOTES.titleGap;
  for (const raw of notes.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      y += NOTES.gap;
      continue;
    }
    const bullet = /^\s*[-•]\s+/.test(line);
    const textSrc = bullet ? line.replace(/^\s*[-•]\s+/, "") : line;
    const indent = bullet ? NOTES.bulletIndent : 0;
    wrap(textSrc, S.body, W - indent).forEach((runs, k) => {
      if (y + lh(S.body) > A4.bottom) fresh();
      const tooWide = lineWidth(runs, S.body) > W - indent + 0.01;
      lines.push({ kind: "text", text: runs.map((r) => (r.style === "bold" ? `**${r.text}**` : r.style === "italic" || r.style === "maths" ? `*${r.text}*` : r.text)).join(""), y, size: S.body, indent, bullet: bullet && k === 0, ...(tooWide ? { tooWide } : {}) });
      y += lh(S.body);
    });
  }
  pages.push({ lesson: lessonNo, lines });
  return pages;
}

/** A notes page as SVG content (no footer). */
function notesSvg(p: NotesPage, st: HouseStyle): string {
  return p.lines
    .map((l) => {
      const x = A4.marginX + l.indent;
      if (l.kind === "title") return textSvg(parseRuns(l.text, "bold"), x, l.y + base(l.size), l.size, st.navy);
      if (l.kind === "subtitle") return textSvg(parseRuns(fitLine(l.text, l.size, W)), x, l.y + base(l.size), l.size, st.muted);
      if (l.kind === "running") return textSvg(parseRuns(l.text), x, l.y + base(l.size), l.size, st.muted) + hline(A4.marginX, A4.marginX + W, l.y + CONTINUED_RULE, st);
      return (l.bullet ? textSvg([{ text: "•", style: "regular" }], A4.marginX + 1.2, l.y + base(l.size), l.size, st.ink) : "") + textSvg(parseRuns(l.text), x, l.y + base(l.size), l.size, st.ink);
    })
    .join("");
}

function page(body: string, label: string, opts: BookletRenderOptions) {
  const P = A4.page;
  const style = opts.fontCss ? `<style>${opts.fontCss}</style>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${P.width}mm" height="${P.height}mm" viewBox="0 0 ${P.width} ${P.height}" font-family="Inter, sans-serif" role="img" aria-label="${esc(label)}">${style}<rect width="${P.width}" height="${P.height}" fill="white"/>${body}</svg>`;
}

function cover(doc: Booklet["document"], contents: { label: string; title: string; page: number }[], st: HouseStyle, issues: BookletIssue[]): string {
  const x0 = A4.marginX;
  const out: string[] = [];
  let y = A4.top;
  // Unit code tile, title and group: the booklet is identifiable from across the room.
  let tx = x0;
  if (doc.code.trim()) {
    const size = 16 * 0.3528;
    const tw = Math.max(18, plainWidth(doc.code, size, "bold") + 8);
    out.push(rect(x0, y, tw, 18, `rx="2.2" fill="${st.navy}"`));
    out.push(textSvg([{ text: doc.code, style: "bold" }], x0 + tw / 2, y + 9 + size * 0.36, size, "white", "middle"));
    tx = x0 + tw + 5;
  }
  const groupW = doc.group.trim() ? plainWidth(doc.group, A4.small, "bold") + 6 : 0;
  const title = para(doc.title, x0 + W - tx - (groupW ? groupW + 4 : 0), st, { size: A4.coverTitle, fill: st.navy, style: "bold" });
  const ty = title.h < 18 ? y + (18 - title.h) / 2 : y - 1;
  out.push(at(title, tx, ty));
  if (groupW) {
    out.push(rect(x0 + W - groupW, y, groupW, 6.4, `rx="1.4" fill="${st.tint}"`));
    out.push(textSvg(parseRuns(doc.group, "bold"), x0 + W - groupW / 2, y + 3.2 + A4.small * 0.36, A4.small, st.navy, "middle"));
  }
  y = Math.max(y + 18, ty + title.h) + 10;
  if (doc.nameLine) {
    const size = S.body;
    out.push(textSvg(parseRuns("Name"), x0, y, size, st.ink));
    out.push(`<line x1="${n(x0 + 13)}" y1="${n(y + 0.8)}" x2="${n(x0 + 120)}" y2="${n(y + 0.8)}" stroke="${st.ink}" stroke-width="0.3"/>`);
    out.push(textSvg(parseRuns("Class"), x0 + 128, y, size, st.ink));
    out.push(`<line x1="${n(x0 + 141)}" y1="${n(y + 0.8)}" x2="${n(x0 + W)}" y2="${n(y + 0.8)}" stroke="${st.ink}" stroke-width="0.3"/>`);
    y += 12;
  }
  out.push(textSvg(parseRuns("Contents", "bold"), x0, y + base(A4.heading), A4.heading, st.navy));
  y += lh(A4.heading) + 1;
  out.push(`<rect x="${x0}" y="${n(y)}" width="${n(W)}" height="0.5" fill="${st.navy}"/>`);
  y += 2.5;
  const row = 8.6;
  for (const c of contents) {
    const by = y + row / 2 + S.body * 0.34;
    const lw = c.label ? plainWidth(c.label, S.body, "bold") + 5 : 0;
    if (c.label) out.push(textSvg(parseRuns(c.label, "bold"), x0, by, S.body, st.navy));
    const pw = plainWidth(String(c.page), S.body);
    const t = fitLine(c.title, S.body, W - lw - pw - 12);
    const tw = plainWidth(t, S.body);
    out.push(textSvg(parseRuns(t), x0 + lw, by, S.body, st.ink));
    // Dot leaders guide the eye to the page number.
    out.push(`<line x1="${n(x0 + lw + tw + 2)}" y1="${n(by)}" x2="${n(x0 + W - pw - 2)}" y2="${n(by)}" stroke="${st.rule}" stroke-width="0.45" stroke-dasharray="0.2 1.6" stroke-linecap="round"/>`);
    out.push(textSvg([{ text: String(c.page), style: "regular" }], x0 + W, by, S.body, st.ink, "end"));
    out.push(hline(x0, x0 + W, y + row, st, 0.15));
    y += row;
  }
  if (doc.coverNote.trim()) {
    y += 8;
    const pad = 3;
    const f = para(doc.coverNote, W - pad * 2 - 1, st, { x: pad + 1 });
    out.push(rect(x0, y, W, f.h + pad * 2, `rx="1.4" fill="${st.tint}"`), rect(x0, y, 1.1, f.h + pad * 2, `fill="${st.navy}"`), at(f, x0, y + pad));
    y += f.h + pad * 2;
  }
  if (y > A4.bottom) issues.push({ lesson: 0, page: 1, message: `The cover needs ${n(y - A4.bottom)} mm more height: shorten the cover note or lesson titles.` });
  return out.join("");
}

function introPage(doc: Booklet["document"], intro: Intro, st: HouseStyle, issues: BookletIssue[], pageNo: number): string {
  const x0 = A4.marginX;
  const out: string[] = [];
  let y = A4.top;
  out.push(textSvg(parseRuns("Unit introduction", "bold"), x0, y + base(A4.lessonTitle), A4.lessonTitle, st.navy));
  y += lh(A4.lessonTitle);
  const sub = [doc.code, doc.title].filter((s) => s.trim()).join(" • ");
  if (sub) {
    out.push(textSvg(parseRuns(fitLine(sub, A4.small, W)), x0, y + base(A4.small), A4.small, st.muted));
    y += lh(A4.small);
  }
  y += 4;
  const boxes: [string, string[]][] = [
    ["What do I need to remember?", intro.remember],
    ["What will I learn?", intro.learn],
    ["How does this progress?", intro.next],
  ].filter(([, l]) => (l as string[]).length) as [string, string[]][];
  if (boxes.length) {
    const gap = 4;
    const bw = (W - gap * (boxes.length - 1)) / boxes.length;
    const pad = S.cardPad;
    const frags = boxes.map(([title, list]) => {
      const head = para(title, bw - pad * 2, st, { style: "bold", fill: st.navy });
      let yy = head.h + 1.6;
      const parts = [head.svg];
      for (const b of list) {
        const f = para(b, bw - pad * 2 - 4.2, st, { x: 4.2 });
        parts.push(at(f, 0, yy), textSvg([{ text: "•", style: "regular" }], 0.8, yy + base(S.body), S.body, st.ink));
        yy += f.h + 0.6;
      }
      return { h: yy, svg: parts.join("") };
    });
    const h = Math.max(...frags.map((f) => f.h)) + pad * 2;
    frags.forEach((f, i) => {
      const x = x0 + i * (bw + gap);
      out.push(rect(x + 0.15, y + 0.15, bw - 0.3, h - 0.3, `rx="2" fill="white" stroke="${st.rule}" stroke-width="0.45"`), at(f, x + pad, y + pad));
    });
    y += h + 7;
  }
  if (intro.keywords.length) {
    out.push(textSvg(parseRuns("Key words", "bold"), x0, y + base(A4.heading), A4.heading, st.navy));
    y += lh(A4.heading) + 1.5;
    const ww = Math.min(60, Math.max(32, ...intro.keywords.map((k) => plainWidth(k.word, S.body, "bold") + 6)));
    out.push(rect(x0, y, W, 6.4, `fill="${st.tableHead}"`));
    out.push(textSvg(parseRuns("Word", "bold"), x0 + 2.4, y + 3.2 + S.body * 0.34, S.body, st.ink), textSvg(parseRuns("Meaning", "bold"), x0 + ww + 2.4, y + 3.2 + S.body * 0.34, S.body, st.ink));
    const top = y;
    y += 6.4;
    const rules: string[] = [];
    for (const k of intro.keywords) {
      const m = para(k.meaning, W - ww - 4.8, st, { x: ww + 2.4 });
      const word = para(k.word, ww - 4.8, st, { x: 2.4, style: "bold", fill: st.navy });
      const h = Math.max(m.h, word.h) + 2.6;
      rules.push(hline(x0, x0 + W, y, st, 0.35));
      out.push(at(word, x0, y + 1.3), at(m, x0, y + 1.3));
      y += h;
    }
    out.push(...rules, rect(x0, top, W, y - top, `fill="none" stroke="${st.rule}" stroke-width="0.35"`), `<line x1="${n(x0 + ww)}" y1="${n(top)}" x2="${n(x0 + ww)}" y2="${n(y)}" stroke="${st.rule}" stroke-width="0.35"/>`);
  }
  if (y > A4.bottom) issues.push({ lesson: 0, page: pageNo, message: `The unit introduction needs ${n(y - A4.bottom)} mm more height: shorten the lists or key words.` });
  return out.join("");
}

/**
 * The fold-over retrieval page (N12): numbered questions on the left, each with room to write and a
 * dotted answer line; the answers in a strip on the right beyond a dashed fold line. The answers
 * print in both copies, because pupils fold the strip back and check themselves.
 */
export const RETRIEVAL = {
  /** The answer strip's width, right of the fold line. */
  strip: 52,
  /** Gap each side of the fold line. */
  gap: 4,
  /** Room for the question number. */
  num: 7,
  /** Writing room under a question, down to its answer line. */
  write: 9,
  pad: 2.2,
} as const;
export const retrievalQuestionWidth = () => W - RETRIEVAL.strip - RETRIEVAL.gap - RETRIEVAL.num;
export const retrievalAnswerWidth = () => RETRIEVAL.strip - RETRIEVAL.gap - 1;
/** Each row's height: the question, writing room and padding, or the answer if it is taller. */
export function retrievalRowHeights(r: Retrieval): number[] {
  return r.items.map((it) => {
    const q = wrap(it.question, S.body, retrievalQuestionWidth()).length * lh(S.body);
    const a = wrap(it.answer, S.body, retrievalAnswerWidth()).length * lh(S.body);
    return Math.max(q + RETRIEVAL.write, a + 2) + RETRIEVAL.pad * 2;
  });
}

function retrievalPage(r: Retrieval, st: HouseStyle, issues: BookletIssue[], pageNo: number, maths: boolean): string {
  const R = RETRIEVAL;
  const x0 = A4.marginX;
  const out: string[] = [];
  let y = A4.top;
  out.push(textSvg(parseRuns(r.title, "bold"), x0, y + base(A4.lessonTitle), A4.lessonTitle, st.navy));
  y += lh(A4.lessonTitle) + 1;
  if (r.instruction.trim()) {
    const f = para(r.instruction, W, st);
    out.push(at(f, x0, y));
    y += f.h;
  }
  y += 4;
  const foldX = x0 + W - R.strip;
  const qx = x0 + R.num;
  out.push(textSvg(parseRuns("Questions", "bold"), x0, y + base(S.body), S.body, st.navy), textSvg(parseRuns("Answers", "bold"), foldX + R.gap, y + base(S.body), S.body, st.navy));
  y += lh(S.body) + 1.5;
  const top = y;
  const heights = retrievalRowHeights(r);
  r.items.forEach((it, i) => {
    const h = heights[i];
    out.push(hline(x0, x0 + W, y, st, 0.35));
    out.push(textSvg([{ text: String(i + 1), style: "bold" }], x0, y + R.pad + base(S.body), S.body, st.navy));
    out.push(at(para(it.question, retrievalQuestionWidth(), st), qx, y + R.pad));
    const lineY = y + h - R.pad - 1.2;
    out.push(answerRule(qx, foldX - R.gap, lineY, st.ink));
    const a = para(it.answer, retrievalAnswerWidth(), st);
    out.push(at(a, foldX + R.gap, lineY - a.h + 1.2));
    if (maths && [it.question, it.answer].some((t) => /\{[^{}]+\/[^{}]+\}/.test(t)))
      issues.push({ lesson: 0, retrieval: true, page: pageNo, question: i + 1, message: `Fold-over question ${i + 1} has a stacked fraction, which this page prints as typed. Write it another way, such as 3 ÷ 4.` });
    y += h;
  });
  out.push(hline(x0, x0 + W, y, st, 0.35));
  out.push(`<line x1="${n(foldX)}" y1="${n(top - lh(S.body) - 2.5)}" x2="${n(foldX)}" y2="${n(y + 6)}" stroke="${st.ink}" stroke-width="0.4" stroke-dasharray="2.4 1.6"/>`);
  out.push(textSvg(parseRuns("Fold back along the dashed line", "italic"), foldX, y + 6 + base(A4.small) + 0.5, A4.small, st.muted, "middle"));
  if (y + 6 + lh(A4.small) > A4.bottom) issues.push({ lesson: 0, retrieval: true, page: pageNo, message: `The fold-over page needs ${n(y + 6 + lh(A4.small) - A4.bottom)} mm more height: use fewer or shorter questions.` });
  return out.join("");
}

/** A block placed on a page: its top and height after spare height is shared out, in millimetres. */
export type PlacedBlock =
  | { kind: "head"; y: number; h: number }
  | { kind: "section"; section: number; continued: boolean; y: number; h: number }
  | { kind: "banner"; section: number; end: boolean; y: number; h: number }
  | { kind: "row"; section: number; cards: { index: number; number: QuestionLabel }[]; shape: RowShape; y: number; h: number; natural: number };
/** One printed lesson page of the plan. */
export interface PlannedLessonPage {
  /** 1-based lesson. */
  lesson: number;
  continued: boolean;
  /** The printed page number in the full booklet. */
  pageNo: number;
  /** Extra height given to each working or drawing space on this page. */
  extra: number;
  blocks: PlacedBlock[];
  /** The lesson's last page: the end band takes the footer's place (N11). */
  last: boolean;
  /** The stage squares in the corner, and the lit one (null before the first stage). */
  squares: string[];
  stage: string | null;
}
/**
 * The booklet's page plan: which blocks go on which page, where, and how tall. The SVG pages and
 * the Word file are both drawn from it, so they break pages in the same places.
 */
export interface BookletPlan {
  pages: PlannedLessonPage[];
  lessonPages: number[];
  introPage: number | null;
  /** The fold-over retrieval page after the last lesson, or null. */
  retrievalPage: number | null;
  contents: { label: string; title: string; page: number }[];
}
/** The teaching notes' continued-page running header: a line of text, a hairline, then the notes. */
export const CONTINUED_HEAD = 9;
export const CONTINUED_RULE = 5.6;

export function planBooklet(saved: Booklet, options: Pick<BookletRenderOptions, "numbering" | "view" | "style"> = {}): BookletPlan {
  const booklet = typesetForPrint(saved);
  const doc = booklet.document;
  const st = styles[options.style ?? "mathsdock"];
  const ctx: BCtx = { st, view: options.view ?? "pupil", diagrams: 0, issues: [], where: { lesson: 0 }, maths: booklet.document.notation === "maths" };
  const contentTop = A4.top;
  const contHead = BADGE_HEAD;

  // 1. Plan every lesson's pages from natural heights.
  const planned: PlannedPage[] = [];
  doc.lessons.forEach((lesson, li) => {
    const L = li + 1;
    const head = lessonHead(doc, lesson, L + (options.numbering?.lessonOffset ?? 0) + lessonShift(doc), st);
    let pg: PlannedPage = { lesson: L, continued: false, blocks: [{ block: { kind: "head", frag: head }, y: BOOKEND.top }], end: BOOKEND.top + head.h };
    planned.push(pg);
    const fresh = () => {
      pg = { lesson: L, continued: true, blocks: [], end: contentTop + contHead };
      planned.push(pg);
    };
    const labels = lessonLabels(lesson);
    lesson.sections.forEach((section, si) => {
      const rows = rowsOf(section, labels[si], si + 1, L, ctx);
      const headFrag = sectionHead(section, st, false);
      // A start banner stays with the heading and first row; an end banner stays with the last row.
      const startFrag = section.startBanner.trim() ? bannerFrag(section.startBanner, false, st) : null;
      const endFrag = section.endBanner.trim() ? bannerFrag(section.endBanner, true, st) : null;
      const startH = startFrag ? startFrag.h + BANNER.gap : 0;
      const endH = endFrag ? BANNER.gap + endFrag.h : 0;
      // A cycle (a start banner) always opens a new page, so pupils find where each part begins; a lesson's own first page is the exception.
      const onlyHead = pg.blocks.length === 1 && pg.blocks[0].block.kind === "head";
      if (startFrag && pg.blocks.length && !onlyHead) fresh();
      else if (pg.end + (pg.blocks.length ? A4.sectionGap : 0) + startH + headFrag.h + rows[0].h + (rows.length === 1 ? endH : 0) > A4.bottom && pg.blocks.length) fresh();
      let y = pg.end + (pg.blocks.length ? A4.sectionGap : 0);
      if (startFrag) {
        pg.blocks.push({ block: { kind: "banner", section: si, end: false, frag: startFrag }, y });
        y += startH;
      }
      pg.blocks.push({ block: { kind: "section", section: si, continued: false, frag: headFrag }, y });
      y += headFrag.h;
      rows.forEach((row, ri) => {
        if (ri > 0) y += A4.rowGap;
        const tail = ri === rows.length - 1 ? endH : 0;
        if (y + row.h + tail > A4.bottom && ri > 0) {
          pg.end = y - A4.rowGap;
          fresh();
          const cont = sectionHead(section, st, true);
          pg.blocks.push({ block: { kind: "section", section: si, continued: true, frag: cont }, y: pg.end });
          y = pg.end + cont.h;
        }
        pg.blocks.push({ block: { kind: "row", section: si, row }, y });
        y += row.h;
        pg.end = y;
      });
      if (endFrag) {
        pg.blocks.push({ block: { kind: "banner", section: si, end: true, frag: endFrag }, y: y + BANNER.gap });
        pg.end = y + endH;
      }
    });
  });

  // 2. Page numbers: cover, introduction, then lessons.
  const introPageNo = doc.intro ? 2 : null;
  const first = doc.intro ? 3 : 2;
  const lessonPages: number[] = [];
  planned.forEach((p, i) => {
    if (!p.continued) lessonPages.push(first + i);
  });
  const retrievalPageNo = doc.retrieval ? first + planned.length : null;
  const contents = [
    ...(introPageNo ? [{ label: "", title: "Unit introduction", page: introPageNo }] : []),
    ...doc.lessons.map((l, i) => ({ label: `${lessonWords(doc).name} ${i + 1 + lessonShift(doc)}`, title: l.title, page: lessonPages[i] })),
    ...(doc.retrieval && retrievalPageNo ? [{ label: "", title: doc.retrieval.title, page: retrievalPageNo }] : []),
  ];

  // 3. Give each page's spare height to its working and drawing spaces.
  const pages = planned.map((p, pi): PlannedLessonPage => {
    const growth = p.blocks.reduce((k, b) => k + (b.block.kind === "row" ? b.block.row.spaces : 0), 0);
    const spare = A4.bottom - p.end;
    const extra = growth && spare > 0 ? Math.min(A4.maxExtra, spare / growth) : 0;
    let shift = 0;
    const blocks = p.blocks.map(({ block, y }): PlacedBlock => {
      const yy = y + shift;
      if (block.kind === "head") return { kind: "head", y: yy, h: block.frag.h };
      if (block.kind === "section") return { kind: "section", section: block.section, continued: block.continued, y: yy, h: block.frag.h };
      if (block.kind === "banner") return { kind: "banner", section: block.section, end: block.end, y: yy, h: block.frag.h };
      const grown = block.row.h + extra * block.row.spaces;
      shift += grown - block.row.h;
      return { kind: "row", section: block.section, cards: block.row.cards, shape: block.row.shape, y: yy, h: grown, natural: block.row.h };
    });
    const lesson = doc.lessons[p.lesson - 1];
    const firstSection = blocks.find((b): b is Exclude<PlacedBlock, { kind: "head" }> => b.kind !== "head");
    const stage = firstSection ? sectionStages(lesson)[firstSection.section] : null;
    const last = pi === planned.length - 1 || planned[pi + 1].lesson !== p.lesson;
    return { lesson: p.lesson, continued: p.continued, pageNo: first + pi, extra, blocks, last, squares: stageSquares(lesson), stage };
  });
  return { pages, lessonPages, introPage: introPageNo, retrievalPage: retrievalPageNo, contents };
}

export function renderBooklet(saved: Booklet, options: BookletRenderOptions = {}): RenderedBooklet {
  const booklet = typesetForPrint(saved);
  const doc = booklet.document;
  const st = styles[options.style ?? "mathsdock"];
  const view = options.view ?? "pupil";
  const ctx: BCtx = { st, view, diagrams: 0, issues: [], where: { lesson: 0 }, maths: doc.notation === "maths" };
  const issues: BookletIssue[] = [];
  const contentTop = A4.top;
  const contHead = BADGE_HEAD;
  const plan = planBooklet(booklet, options);

  // A character the font does not hold prints as a gap in the PDF and in another font in Word.
  const glyphs = (value: unknown, where: Omit<BookletIssue, "message">, place: string) => {
    for (const c of missingCharacters(value)) issues.push({ ...where, message: missingCharacterMessage(place, c) });
  };
  glyphs({ title: doc.title, code: doc.code, group: doc.group, coverNote: doc.coverNote }, { lesson: 0, page: 1 }, "The cover");
  if (doc.intro) glyphs(doc.intro, { lesson: 0, page: 2 }, "The unit introduction");
  glyphs({ lessonName: doc.lessonName, lessonBadge: doc.lessonBadge }, { lesson: 0, page: 1 }, "The lesson name");
  doc.lessons.forEach((l, li) => l.sections.forEach((sec, si) => spanIssues(sec).forEach((message) => issues.push({ lesson: li + 1, section: si + 1, message }))));
  const badgeWord = lessonWords(doc).badge;
  if (plainWidth(badgeWord, pt(10), "bold") > BOOKEND.tile - 2)
    issues.push({ lesson: 0, page: 1, message: `The badge word "${badgeWord}" is too wide for the lesson tile. Use a shorter word, such as "Revision".` });
  // The end band's words run from beside its tile to just short of the centred page number.
  {
    const size = pt(14);
    const room = W / 2 - plainWidth("Page 99", size, "bold") / 2 - 4 - (3 + BOOKEND.endTile + 3);
    const endText = `${lessonWords(doc).end} ${doc.lessons.length + (options.numbering?.lessonOffset ?? 0) + lessonShift(doc)}`;
    if (plainWidth(endText, size, "bold") > room)
      issues.push({ lesson: 0, page: 1, message: `"${endText}" is too long for the end band and would run into the page number. Use a shorter name for each part.` });
  }

  const pages: string[] = [];
  pages.push(page(cover(doc, plan.contents, st, issues), `${doc.title}, cover${view === "answers" ? ", answers" : ""}`, options));
  if (doc.intro) pages.push(page(introPage(doc, doc.intro, st, issues, 2) + footer(doc, 2, st), `${doc.title}, unit introduction`, options));

  // Draw each page from the plan.
  for (const p of plan.pages) {
    const pageNo = p.pageNo;
    const lesson = doc.lessons[p.lesson - 1];
    const out: string[] = [];
    const shownLesson = p.lesson + (options.numbering?.lessonOffset ?? 0) + lessonShift(doc);
    const shownPage = pageNo + (options.numbering?.pageOffset ?? 0);
    // Later pages: the lesson badge and stage squares in the outer top corner (N11), in place of a running header.
    if (p.continued) out.push(cornerBadge(shownLesson, p.squares, p.stage, shownPage, st, lessonWords(doc)));
    const extra = p.extra;
    for (const block of p.blocks) {
      const yy = block.y;
      if (block.kind === "head") {
        out.push(at(lessonHead(doc, lesson, shownLesson, st), A4.marginX, yy));
        glyphs({ title: lesson.title, keyIdea: lesson.keyIdea, didYouKnow: lesson.didYouKnow }, { lesson: p.lesson, page: pageNo }, `Lesson ${p.lesson}`);
        continue;
      }
      if (block.kind === "banner") {
        const sec = lesson.sections[block.section];
        const label = block.end ? sec.endBanner : sec.startBanner;
        out.push(at(bannerFrag(label, block.end, st), A4.marginX, yy));
        glyphs({ title: label }, { lesson: p.lesson, section: block.section + 1, page: pageNo }, `Lesson ${p.lesson}, ${sectionTitle(sec)} banner`);
        continue;
      }
      if (block.kind === "section") {
        out.push(at(sectionHead(lesson.sections[block.section], st, block.continued), A4.marginX, yy));
        if (!block.continued) glyphs({ title: lesson.sections[block.section].title, instruction: lesson.sections[block.section].instruction }, { lesson: p.lesson, section: block.section + 1, page: pageNo }, `Lesson ${p.lesson}, ${sectionTitle(lesson.sections[block.section])} heading`);
        continue;
      }
      const section = lesson.sections[block.section];
      const grown = block.h;
      if (block.natural > A4.bottom - contentTop - contHead - 14)
        issues.push({ lesson: p.lesson, section: block.section + 1, question: block.cards[0].number ?? undefined, page: pageNo, message: `A card is ${n(block.natural)} mm tall, more than a page holds. Split it into two cards or reduce its working space; text is never shrunk.` });
      const quiet = { ...ctx, issues: [] };
      const places = placeRow(section, block, grown, (i, w) => card(section.cards[i], block.cards.find((c) => c.index === i)?.number ?? null, w, quiet, extra, 0).h);
      places.forEach((c) => {
        ctx.where = { lesson: p.lesson, section: block.section + 1, question: c.number ?? undefined, page: pageNo };
        if (section.cards[c.index].stage) ctx.issues.push({ ...ctx.where, message: "A booklet card has a worksheet stage, which booklets do not print: sections have their own headings." });
        glyphs(section.cards[c.index], ctx.where, `Lesson ${p.lesson}, ${sectionTitle(section)}${c.number !== null ? `, question ${c.number}` : ""}`);
        const natural = card(section.cards[c.index], c.number, c.w, { ...ctx, issues: [] }, extra, 0).h;
        const f = card(section.cards[c.index], c.number, c.w, ctx, extra, Math.max(0, c.h - natural));
        out.push(at(f, A4.marginX + c.x, yy + c.dy));
      });
    }
    pages.push(page(out.join("") + (p.last ? endBand(shownLesson, shownPage, st, lessonWords(doc)) : footer(doc, shownPage, st)), `${doc.title}, lesson ${shownLesson}, page ${shownPage}${view === "answers" ? ", answers" : ""}`, options));
  }

  if (doc.retrieval && plan.retrievalPage) {
    const pageNo = plan.retrievalPage + (options.numbering?.pageOffset ?? 0);
    glyphs(doc.retrieval, { lesson: 0, retrieval: true, page: pageNo }, "The fold-over page");
    pages.push(page(retrievalPage(doc.retrieval, st, issues, pageNo, doc.notation === "maths") + footer(doc, pageNo, st), `${doc.title}, ${doc.retrieval.title}`, options));
  }

  // Card-level issues carry the lesson, section and question they belong to.
  for (const i of ctx.issues) issues.push({ lesson: i.lesson, section: i.section, question: i.question, page: i.page, message: i.message });
  return { pages, issues: dedupe(issues), lessonPages: plan.lessonPages, introPage: plan.introPage, retrievalPage: plan.retrievalPage };
}

function dedupe(list: BookletIssue[]): BookletIssue[] {
  const seen = new Set<string>();
  return list.filter((i) => {
    const k = JSON.stringify(i);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Guide-style file name: [code]_[title]_Booklet_A4.pdf, with _Answers before _A4. */
export function bookletFileName(booklet: Booklet, view: View = "pupil"): string {
  const d = booklet.document;
  const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  const parts = [d.code, d.title].map(safe).filter(Boolean);
  return `${parts.join("_") || "Booklet"}_Booklet${view === "answers" ? "_Answers" : ""}_A4.pdf`;
}

/** Where an issue is, in teacher words. */
export function issuePlace(i: BookletIssue): string {
  return [i.retrieval ? "fold-over page" : i.lesson ? `lesson ${i.lesson}` : i.page === 1 ? "cover" : i.lesson === 0 ? "unit introduction" : "", i.section && `section ${i.section}`, i.question !== undefined && `question ${i.question}`, i.page && `page ${i.page}`].filter(Boolean).join(", ");
}

/** The printed pages of one lesson (0-based index), with the full booklet's page numbers. */
export function lessonPagesOf(booklet: Booklet, lesson: number, options: BookletRenderOptions = {}): { pages: string[]; issues: BookletIssue[] } {
  const r = renderBooklet(booklet, options);
  const start = r.lessonPages[lesson] - 1;
  const end = lesson + 1 < r.lessonPages.length ? r.lessonPages[lesson + 1] - 1 : r.retrievalPage ? r.retrievalPage - 1 : r.pages.length;
  return { pages: r.pages.slice(start, end), issues: r.issues };
}

/** A one-lesson booklet that prints that lesson exactly as the full booklet does, for small
 * download links: no introduction, and numbering offsets so lesson and page numbers match. */
export function singleLessonBooklet(booklet: Booklet, lesson: number): { booklet: Booklet; numbering: { lessonOffset: number; pageOffset: number } } {
  const full = renderBooklet(booklet);
  const doc = booklet.document;
  return {
    booklet: { ...booklet, document: { ...doc, intro: null, retrieval: null, lessons: [doc.lessons[lesson]] } },
    numbering: { lessonOffset: lesson, pageOffset: full.lessonPages[lesson] - 2 },
  };
}

/**
 * A lesson's teaching notes as a file of their own (Tim, 17 November 2026): the booklet's pupil
 * and answers copies stay exactly as they are, and the notes print on A4 pages numbered from 1,
 * with the booklet's footer. Empty notes give no pages.
 */
export function renderLessonNotes(saved: Booklet, lesson: number, options: Pick<BookletRenderOptions, "style" | "fontCss"> & { numbering?: { lessonOffset: number } } = {}): { pages: string[]; issues: BookletIssue[] } {
  const booklet = typesetForPrint(saved);
  const doc = booklet.document;
  const st = styles[options.style ?? "mathsdock"];
  const issues: BookletIssue[] = [];
  // A lesson printed from a one-lesson booklet keeps its number in the unit, as lessonPagesOf does.
  const shown = lesson + 1 + (options.numbering?.lessonOffset ?? 0) + lessonShift(doc);
  for (const c of missingCharacters({ text: doc.lessons[lesson].teacherNotes })) issues.push({ lesson: lesson + 1, message: missingCharacterMessage(`Lesson ${shown}'s teaching notes`, c) });
  const planned = planNotes(doc.lessons[lesson], shown, lessonWords(doc));
  planned.forEach((np, k) => {
    for (const l of np.lines) if (l.tooWide) issues.push({ lesson: lesson + 1, page: k + 1, message: `Lesson ${shown}'s teaching notes have a word too long for the line: "${l.text.slice(0, 40)}". Break it up or shorten it.` });
  });
  const pages = planned.map((np, k) => page(notesSvg(np, st) + footer(doc, k + 1, st), `${doc.title}, teaching notes for lesson ${shown}, page ${k + 1}`, { fontCss: options.fontCss }));
  return { pages, issues };
}

/** File name of a lesson's teaching notes: [code]_[title]_Lesson N_Teaching notes_A4.pdf. */
export const lessonNotesFileName = (booklet: Booklet, lesson: number) => lessonFileName(booklet, lesson).replace(/_A4\.pdf$/, "_Teaching notes_A4.pdf");

/** File name for one lesson printed on its own. */
export function lessonFileName(booklet: Booklet, lesson: number, view: View = "pupil"): string {
  return bookletFileName(booklet, view).replace(/_Booklet/, `_Lesson ${lesson + 1 + lessonShift(booklet.document)}`);
}
