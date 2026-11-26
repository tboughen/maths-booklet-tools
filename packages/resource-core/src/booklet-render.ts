import { typesetForPrint } from "./typeset";
import { answerRule, at, card, countSpaces, GROW_MARGIN, growLastSpace, fractionBaseline, fractionLine, missingCharacterMessage, missingCharacters, type Ctx, type Frag, type View } from "./render";
import { SIZE, styles, type HouseStyle, type StyleId } from "./style";
import { esc, hasFraction, lineWidth, n, parseRuns, plainWidth, textSvg, titleRuns, wrap, type Line } from "./text";
import type { FontStyle } from "./metrics";
import { LESSON_WORDS, lessonLabels, lessonShift, lessonWords, sectionTitle, type LessonWords, type Booklet, type Intro, type Lesson, type QuestionLabel, type Retrieval, type Revision, type Section, NCETM_LINKS_PER_LESSON, type NcetmLink, type Misconception } from "./booklet";

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
  /** The issue is on the "Do it" revision page. */
  revision?: boolean;
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
  /** The fold-over retrieval page, or null. */
  retrievalPage: number | null;
  /** The "Do it" revision page (the last page), or null. */
  revisionPage: number | null;
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
/** Unit pages (glossary, fold-over retrieval) read powers such as m^5 when the booklet uses maths notation; a stacked fraction stays as typed there. */
export const powersOnly = (text: string, maths: boolean) => maths && !/\{[^{}/]{1,12}\/[^{}/]{1,12}\}/.test(text);
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

/** The lesson's start block: tile, unit and title; then the key idea. START waits for the check-in banner (N28), so the teacher can introduce the key idea and Did you know first. */
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
    // With maths notation on, the idea prints as typeset lines so its letters take the maths serif (N16);
    // otherwise, without a fraction or a power, it prints exactly as a paragraph always has.
    const svg = maths || f.frac || f.lines.some((l) => l.some((r) => r.sup)) ? f.lines.map((l, k) => textSvg(l, left, k * f.line + f.first, S.body, st.ink)).join("") : para(idea, tw, st, { x: left }).svg;
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

/**
 * The check-in block (N28, Tim 25 Nov 2026): the lesson's opening sections, from its check-in up to the first stage's START
 * (so "From lesson 1" retrieval belongs to it), or the leading run of check-in sections when the lesson has no stages.
 * It opens with "Check in" START, so the teacher can introduce the key idea and Did you know first, and closes with
 * "End of check in" STOP: in the footer's place when the block ends on the lesson's first page and a stage follows, so it
 * takes no room from the cards, otherwise straight after the block's last card.
 */
export const CHECK_IN = { start: "Check in", end: "End of check in" } as const;
export function checkInBlock(lesson: Lesson): { first: number; last: number; stageNext: boolean } | null {
  const secs = lesson.sections;
  if (!secs.length || secs[0].kind !== "check-in" || secs[0].startBanner.trim()) return null;
  const stage = secs.findIndex((s) => s.startBanner.trim());
  if (stage > 0) return { first: 0, last: stage - 1, stageNext: true };
  let last = 0;
  while (last + 1 < secs.length && secs[last + 1].kind === "check-in") last++;
  return { first: 0, last, stageNext: false };
}

/** The banners each section prints: its own, plus the check-in block's START and STOP. Stage squares count only the sections' own start banners. */
export function sectionBanners(lesson: Lesson): { start: string; end: string }[] {
  const out = lesson.sections.map((s) => ({ start: s.startBanner.trim(), end: s.endBanner.trim() }));
  const block = checkInBlock(lesson);
  if (block) {
    out[block.first].start = sectionTitle(lesson.sections[block.first]);
    if (!out[block.last].end) out[block.last].end = CHECK_IN.end;
  }
  return out;
}

/** The check-in's instruction, printed in its START banner at the heading instruction's own size (A4.small) in place of a section heading (one navy bar opens the check-in), or null when it would not fit on the bar's one line. */
export function checkInNote(lesson: Lesson): string | null {
  const block = checkInBlock(lesson);
  if (!block) return null;
  const sec = lesson.sections[block.first];
  const ins = sec.instruction.trim();
  const used = 2 * BANNER.pad + plainWidth(sectionTitle(sec), S.body, "bold") + BANNER.noteGap + plainWidth(BANNER.start, S.body, "bold") + 6;
  return !ins || plainWidth(ins, A4.small) <= W - used ? ins : null;
}

/** "End of check in" STOP in the footer's place on a lesson's first page (N28): a stage banner with the page number centred. */
export function checkInBand(pageNo: number, st: HouseStyle): string {
  const x0 = A4.marginX;
  const y = BOOKEND.endTop;
  const by = y + BANNER.h / 2 + S.body * 0.36;
  return [
    rect(x0, y, W, BANNER.h, `rx="1.4" fill="${st.navy}"`),
    textSvg([{ text: CHECK_IN.end, style: "bold" }], x0 + BANNER.pad, by, S.body, "white"),
    textSvg([{ text: `Page ${pageNo}`, style: "bold" }], x0 + W / 2, y + BANNER.h / 2 + A4.pageNumber * 0.36, A4.pageNumber, "white", "middle"),
    textSvg([{ text: BANNER.end, style: "bold" }], x0 + W - BANNER.pad, by, S.body, "white", "end"),
  ].join("");
}

/** Cycle banners: a full-width navy band, the label in white bold on the left and START or STOP on the right. */
export const BANNER = { h: 8, gap: 2.5, pad: 3, start: "START", end: "STOP", noteGap: 4 } as const;
/** A banner, with an optional note in regular weight after the label (the check-in's instruction, N28). */
export function bannerFrag(label: string, end: boolean, st: HouseStyle, note = ""): Frag {
  const tag = end ? BANNER.end : BANNER.start;
  const y = BANNER.h / 2 + S.body * 0.36;
  const room = W - 2 * BANNER.pad - plainWidth(tag, S.body, "bold") - 6;
  const shown = fitLine(label, S.body, room, "bold");
  const noteX = BANNER.pad + plainWidth(shown, S.body, "bold") + BANNER.noteGap;
  return {
    h: BANNER.h,
    svg:
      rect(0, 0, W, BANNER.h, `rx="1.4" fill="${st.navy}"`) +
      textSvg(parseRuns(shown, "bold"), BANNER.pad, y, S.body, "white") +
      (note ? textSvg(parseRuns(note), noteX, y, A4.small, "white") : "") +
      textSvg([{ text: tag, style: "bold" }], W - BANNER.pad, y, S.body, "white", "end"),
  };
}

/**
 * The NCETM chip (Tim, 25 November 2026): a small pale-blue box at the right-hand end of a section's
 * heading line, in the answers copy only, linking to an NCETM page or Checkpoints slide. It sits in
 * space the heading line already leaves empty, so it never moves anything: pupil and answers pages
 * keep the same layout. Word draws the same text (booklet-docx).
 */
/** Solid green with white text (Tim, 26 November 2026): unlike the navy house colour, black text, the pink-purple answers and the amber misconception boxes, so the chip stands out. */
export const NCETM_CHIP = { size: 8 * 0.3528, padX: 1.4, h: 4.4, gap: 6, minLabel: 12, tag: "NCETM", arrow: "", ink: "#ffffff", edge: "#15803d", fill: "#15803d" } as const;

/** The chip's label cut to fit `room` mm (the whole chip's width), or null when even a short label cannot fit. */
export function ncetmChipLabel(label: string, room: number): string | null {
  const c = NCETM_CHIP;
  const fixed = 2 * c.padX + plainWidth(c.tag + "  ", c.size, "bold") + plainWidth(c.arrow, c.size);
  if (room - fixed < c.minLabel) return null;
  return fitLine(label.trim(), c.size, room - fixed);
}

/** Width of a chip with this (already fitted) label. */
export const ncetmChipWidth = (label: string) => 2 * NCETM_CHIP.padX + plainWidth(NCETM_CHIP.tag + "  ", NCETM_CHIP.size, "bold") + plainWidth(label + NCETM_CHIP.arrow, NCETM_CHIP.size);

/** Room left on a section's heading line, right of the title and an instruction printed beside it. */
export function headingLineRoom(section: Section): number {
  const tw = plainWidth(sectionTitle(section), A4.heading, "bold");
  const ins = section.instruction.trim();
  const used = ins && plainWidth(ins, A4.small) <= W - tw - 4 ? tw + 4 + plainWidth(ins, A4.small) : tw;
  return W - used - NCETM_CHIP.gap;
}

function ncetmChip(link: NcetmLink, room: number): string | null {
  const c = NCETM_CHIP;
  const label = ncetmChipLabel(link.label, room);
  if (label === null) return null;
  const w = ncetmChipWidth(label);
  const x = W - w,
    y = (lh(A4.heading) - c.h) / 2;
  const by = y + c.h / 2 + c.size * 0.36;
  const url = esc(link.url);
  return (
    `<a href="${url}">` +
    rect(x, y, w, c.h, `rx="0.9" fill="${c.fill}" stroke="${c.edge}" stroke-width="0.3"`) +
    textSvg([{ text: c.tag + "  ", style: "bold" }, { text: label + c.arrow, style: "regular" }], x + c.padX, by, c.size, c.ink) +
    `</a>`
  );
}

/**
 * Common misconceptions (Tim, 25 November 2026): in the ANSWERS copy only, the footer of the page
 * where a section starts carries an amber "Watch for" box left of the page number and an "Ask" box
 * (the question to ask, then the source) to its right. The footer is empty in both copies, so no
 * layout moves. Each box holds at most two lines at full size; text is never shrunk to fit. Word
 * draws the same boxes in that page's own footer (booklet-docx).
 */
export const MISCONCEPTION = {
  top: 284.3,
  h: 8.7,
  size: 8 * 0.3528,
  pitch: 1.2,
  padX: 1.8,
  /** No thick left bar (Tim, 26 November 2026): the box has one even edge. */
  bar: 0,
  /** Room kept clear each side of the page's centre for the page number. */
  numberRoom: 12,
  maxLines: 2,
  label: "Watch for",
  ask: "Ask:",
  source: "Source:",
  ink: "#1f2937",
  warn: "#92400e",
  edge: "#d97706",
  fill: "#fff7e0",
  muted: "#6b7280",
} as const;
export type NoteWord = { text: string; tone: "warn" | "ink" | "muted"; bold: boolean; runs: Line };
/** The two boxes' left edges (from the page's left margin) and their width. */
export const misconceptionBoxes = () => {
  const w = W / 2 - MISCONCEPTION.numberRoom;
  return [{ x: 0, w }, { x: W / 2 + MISCONCEPTION.numberRoom, w }] as const;
};
export const misconceptionTextWidth = () => misconceptionBoxes()[0].w - 2 * MISCONCEPTION.padX - MISCONCEPTION.bar;
const noteWidth = (w: NoteWord) => lineWidth(w.runs, MISCONCEPTION.size);

function wrapNote(words: NoteWord[], width: number): NoteWord[][] {
  const space = plainWidth(" ", MISCONCEPTION.size);
  const lines: NoteWord[][] = [[]];
  let used = 0;
  for (const w of words) {
    const line = lines[lines.length - 1];
    const add = (line.length ? space : 0) + noteWidth(w);
    if (line.length && used + add > width) {
      lines.push([w]);
      used = noteWidth(w);
    } else {
      line.push(w);
      used += add;
    }
  }
  return lines;
}
/** Words of one part of a note: the whole part is parsed first, so formatting that spans words (italic, bold, a spaced fraction) survives, then its runs are split at spaces, as wrap() does. */
function split(src: string, tone: NoteWord["tone"], bold = false, maths = false): NoteWord[] {
  const words: Line[] = [[]];
  for (const r of parseRuns(src.trim(), bold ? "bold" : "regular", maths)) {
    if (r.frac) {
      words[words.length - 1].push(r);
      continue;
    }
    r.text.split(/(\s+)/).forEach((piece, i) => {
      if (i % 2 === 1) words.push([]);
      else if (piece) words[words.length - 1].push({ ...r, text: piece });
    });
  }
  return words.filter((w) => w.length).map((runs) => ({ text: runs.map((r) => r.text).join(""), tone, bold, runs }));
}

/** The two boxes' wrapped lines, or null when either needs more than two lines or holds a stacked fraction (too tall for the box: write it in words). */
export function misconceptionLines(m: Misconception, maths = false): { left: NoteWord[][]; right: NoteWord[][] } | null {
  const M = MISCONCEPTION;
  const width = misconceptionTextWidth();
  const leftWords = [...split(M.label, "warn", true), ...split(m.watch, "ink", false, maths)];
  const rightWords = [...split(M.ask, "warn", true), ...split(m.ask, "ink", false, maths), ...split(M.source, "muted", true), ...split(m.source, "muted")];
  if ([...leftWords, ...rightWords].some((w) => hasFraction(w.runs))) return null;
  const left = wrapNote(leftWords, width);
  const right = wrapNote(rightWords, width);
  return left.length > M.maxLines || right.length > M.maxLines ? null : { left, right };
}
export const misconceptionToneColour = (tone: NoteWord["tone"]) => (tone === "warn" ? MISCONCEPTION.warn : tone === "muted" ? MISCONCEPTION.muted : MISCONCEPTION.ink);

/** The note, if any, that prints in this page's footer, and the problems found placing notes on it. Answers copy only. */
export function pageMisconception(lesson: Lesson, p: { last: boolean; checkInStop: boolean; blocks: readonly PlacedBlock[] }, view: "pupil" | "answers", maths = false): { note: { section: number; lines: NonNullable<ReturnType<typeof misconceptionLines>> } | null; problems: { section: number; message: string }[] } {
  const problems: { section: number; message: string }[] = [];
  let note: { section: number; lines: NonNullable<ReturnType<typeof misconceptionLines>> } | null = null;
  if (view !== "answers") return { note, problems };
  // A section starts on this page with its heading, or, for a check-in folded into its START banner, with that banner.
  const folded = checkInBlock(lesson)?.first;
  const starts = new Set<number>();
  for (const b of p.blocks) if ((b.kind === "section" && !b.continued) || (b.kind === "banner" && !b.end && b.section === folded)) starts.add(b.section);
  for (const section of starts) {
    const b = { section };
    const sec = lesson.sections[b.section];
    if (!sec.misconception) continue;
    const name = sectionTitle(sec);
    if (p.last || p.checkInStop) {
      problems.push({ section: b.section, message: `The misconception for "${name}" cannot print: this page's footer holds the ${p.last ? "end of lesson" : "check-in STOP"} band. Put it on a section that starts on another page.` });
      continue;
    }
    if (note) {
      problems.push({ section: b.section, message: `Two misconceptions would share one page footer ("${sectionTitle(lesson.sections[note.section])}" and "${name}"). Keep one a page.` });
      continue;
    }
    const lines = misconceptionLines(sec.misconception, maths);
    if (!lines) {
      problems.push({ section: b.section, message: `The misconception for "${name}" needs more than two lines in a box, or has a stacked fraction. Shorten its watch, ask or source and write fractions in words; text is never shrunk.` });
      continue;
    }
    note = { section: b.section, lines };
  }
  return { note, problems };
}

function misconceptionSvg(lines: { left: NoteWord[][]; right: NoteWord[][] }): string {
  const M = MISCONCEPTION;
  const pitch = M.size * M.pitch;
  const space = plainWidth(" ", M.size);
  const out: string[] = [];
  misconceptionBoxes().forEach((b, k) => {
    const x = A4.marginX + b.x;
    out.push(rect(x, M.top, b.w, M.h, `rx="1.2" fill="${M.fill}" stroke="${M.edge}" stroke-width="0.28"`));
    const box = k === 0 ? lines.left : lines.right;
    const y0 = M.top + (M.h - box.length * pitch) / 2;
    box.forEach((line, i) => {
      let cx = x + M.bar + M.padX;
      const by = y0 + i * pitch + (pitch - M.size) / 2 + M.size * 0.82;
      for (const w of line) {
        out.push(textSvg(w.runs, cx, by, M.size, misconceptionToneColour(w.tone)));
        cx += noteWidth(w) + space;
      }
    });
  });
  return out.join("");
}

function sectionHead(section: Section, st: HouseStyle, continued: boolean, maths: boolean, link?: { link: NcetmLink; onMissing: () => void }): Frag {
  const title = sectionTitle(section) + (continued ? " (continued)" : "");
  const tw = plainWidth(title, A4.heading, "bold");
  const out = [textSvg(titleRuns(title, maths), 0, base(A4.heading), A4.heading, st.navy)];
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
  if (link && !continued) {
    const chip = ncetmChip(link.link, headingLineRoom(section));
    if (chip) out.push(chip);
    else link.onMissing();
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
  checkInStop?: boolean;
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

/** The topic introduction's lesson list: the saved lines, or the booklet's own lessons (code and title). */
export function introLessons(doc: Booklet["document"], intro: Intro): string[] {
  if (intro.lessons.length) return intro.lessons;
  return doc.lessons.map((l, i) => `${lessonWords(doc).name} ${i + 1 + lessonShift(doc)}: ${[l.code, l.title].filter((t) => t.trim()).join(" ")}`);
}

/** The cover title: the topic title, and "Part 1 of 2" when the unit prints in parts (N33). */
export function coverTitle(doc: Booklet["document"]): string {
  // No-break spaces keep "Part 1 of 2" on one line when the title wraps.
  return doc.part ? `${doc.title}: Part\u00a0${doc.part.n}\u00a0of\u00a0${doc.part.of}` : doc.title;
}

/** The cover's contents heading and the introduction page's title (N30: the topic pages). */
export const CONTENTS_HEADING = "Inside this booklet";
export const INTRO_TITLE = "Topic introduction";

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
  const title = para(coverTitle(doc), x0 + W - tx - (groupW ? groupW + 4 : 0), st, { size: A4.coverTitle, fill: st.navy, style: "bold" });
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
  out.push(textSvg(parseRuns(CONTENTS_HEADING, "bold"), x0, y + base(A4.heading), A4.heading, st.navy));
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
  out.push(textSvg(parseRuns(INTRO_TITLE, "bold"), x0, y + base(A4.lessonTitle), A4.lessonTitle, st.navy));
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
      const m = para(k.meaning, W - ww - 4.8, st, { x: ww + 2.4, maths: powersOnly(k.meaning, doc.notation === "maths") });
      const word = para(k.word, ww - 4.8, st, { x: 2.4, style: "bold", fill: st.navy });
      const h = Math.max(m.h, word.h) + 2.6;
      rules.push(hline(x0, x0 + W, y, st, 0.35));
      out.push(at(word, x0, y + 1.3), at(m, x0, y + 1.3));
      y += h;
    }
    out.push(...rules, rect(x0, top, W, y - top, `fill="none" stroke="${st.rule}" stroke-width="0.35"`), `<line x1="${n(x0 + ww)}" y1="${n(top)}" x2="${n(x0 + ww)}" y2="${n(y)}" stroke="${st.rule}" stroke-width="0.35"/>`);
  }
  const lessonLines = introLessons(doc, intro);
  if (lessonLines.length) {
    y += 7;
    out.push(textSvg(parseRuns("Lessons in this topic", "bold"), x0, y + base(A4.heading), A4.heading, st.navy));
    y += lh(A4.heading) + 1.5;
    for (const [i, line] of lessonLines.entries()) {
      const on = intro.highlight.includes(i);
      const f = para(line, W - 4, st, { x: 2, style: on ? "bold" : "regular", fill: on ? st.navy : st.ink });
      if (on) out.push(rect(x0, y, W, f.h + 1.2, `rx="1.2" fill="${st.tint}"`));
      out.push(at(f, x0, y + 0.6));
      y += f.h + 1.2;
    }
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
/** A block heading above a question (Know it, N30): one bold line and a little space. */
export const retrievalHeadHeight = (it: { heading?: string }) => (it.heading?.trim() ? lh(S.body) + 1.6 : 0);
/** Each row's height: the question, writing room and padding, or the answer if it is taller. */
export function retrievalRowHeights(r: Retrieval, maths = false): number[] {
  return r.items.map((it) => {
    const q = wrap(it.question, S.body, retrievalQuestionWidth(), "regular", powersOnly(it.question, maths)).length * lh(S.body);
    const a = wrap(it.answer, S.body, retrievalAnswerWidth(), "regular", powersOnly(it.answer, maths)).length * lh(S.body);
    return Math.max(q + RETRIEVAL.write, a + 2) + RETRIEVAL.pad * 2 + retrievalHeadHeight(it);
  });
}

function retrievalPage(r: Retrieval, st: HouseStyle, issues: BookletIssue[], pageNo: number, maths: boolean): string {
  const R = RETRIEVAL;
  const x0 = A4.marginX;
  const out: string[] = [];
  let y = A4.top;
  out.push(textSvg(titleRuns(r.title, maths), x0, y + base(A4.lessonTitle), A4.lessonTitle, st.navy));
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
  const heights = retrievalRowHeights(r, maths);
  r.items.forEach((it, i) => {
    const h = heights[i];
    out.push(hline(x0, x0 + W, y, st, 0.35));
    const hh = retrievalHeadHeight(it);
    if (hh) out.push(textSvg(titleRuns(it.heading, maths), x0, y + R.pad + base(S.body), S.body, st.navy).replace("<text ", '<text font-weight="700" '));
    out.push(textSvg([{ text: String(i + 1), style: "bold" }], x0, y + hh + R.pad + base(S.body), S.body, st.navy));
    out.push(at(para(it.question, retrievalQuestionWidth(), st, { maths: powersOnly(it.question, maths) }), qx, y + hh + R.pad));
    const lineY = y + h - R.pad - 1.2;
    out.push(answerRule(qx, foldX - R.gap, lineY, st.ink));
    const a = para(it.answer, retrievalAnswerWidth(), st, { maths: powersOnly(it.answer, maths) });
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

/**
 * The "Do it" revision page (N30): the title, one line of instruction, the cards in two columns
 * sharing the page's spare height, then the try-it answers small and upside down at the foot below
 * a dashed line. Exactly one side: anything taller is an issue, never shrunk.
 */
export const REVISION = { rowGap: 3, answerGap: 3.5, answerSize: A4.small, pairGap: 5, oneColumn: 4 } as const;
export interface RevisionLayout {
  /** Top of the cards. */
  top: number;
  rows: { cards: number[]; wide: boolean; y: number; h: number }[];
  /** Answer lines, each a list of label and answer with its x offset. */
  answers: { label: string; answer: string; x: number }[][];
  /** Top of the dashed line above the answers. */
  answersTop: number;
  /** Millimetres over one side (0 when it fits). */
  over: number;
}
export const revisionHeadHeight = (r: Revision) => lh(A4.lessonTitle) + 1 + (r.instruction.trim() ? wrap(r.instruction, S.body, W).length * lh(S.body) : 0) + 4;
export function revisionAnswerLines(r: Revision, maths: boolean): { label: string; answer: string; x: number }[][] {
  const R = REVISION;
  const lines: { label: string; answer: string; x: number }[][] = [];
  let line: { label: string; answer: string; x: number }[] = [];
  let x = 0;
  for (const a of r.answers) {
    const w = plainWidth(a.label, R.answerSize, "bold") + 1.6 + lineWidth(titleRuns(a.answer, maths), R.answerSize);
    if (line.length && x + w > W) {
      lines.push(line);
      line = [];
      x = 0;
    }
    line.push({ ...a, x });
    x += w + R.pairGap;
  }
  if (line.length) lines.push(line);
  return lines;
}
export function planRevision(r: Revision, measure: (card: number, w: number) => number, maths: boolean): RevisionLayout {
  const R = REVISION;
  const top = A4.top + revisionHeadHeight(r);
  const answers = revisionAnswerLines(r, maths);
  const answersH = answers.length ? R.answerGap + answers.length * lh(R.answerSize) : 0;
  const roomFor = (n: number) => A4.bottom - answersH - top - R.rowGap * (n - 1);
  // A few cards (up to REVISION.oneColumn) run one to a row across the page when they fit, so
  // they share the side instead of leaving tall empty half-width cards (A4 in parts, 25 November 2026).
  let rows: { cards: number[]; wide: boolean; natural: number }[] = [];
  if (r.cards.length <= R.oneColumn) {
    rows = r.cards.map((_, i) => ({ cards: [i], wide: true, natural: measure(i, BOOKLET_WIDTHS.full) }));
    if (rows.reduce((k, row) => k + row.natural, 0) > roomFor(rows.length)) rows = [];
  }
  if (!rows.length)
    for (let i = 0; i < r.cards.length; i += 2) {
      const pair = i + 1 < r.cards.length ? [i, i + 1] : [i];
      const wide = pair.length === 1;
      const w = wide ? BOOKLET_WIDTHS.full : BOOKLET_WIDTHS.half;
      rows.push({ cards: pair, wide, natural: Math.max(...pair.map((c) => measure(c, w))) });
    }
  const room = roomFor(rows.length);
  const used = rows.reduce((k, row) => k + row.natural, 0);
  const spare = Math.max(0, room - used) / rows.length;
  let y = top;
  const placed = rows.map((row) => {
    const out = { cards: row.cards, wide: row.wide, y, h: row.natural + spare };
    y += out.h + R.rowGap;
    return out;
  });
  return { top, rows: placed, answers, answersTop: A4.bottom - answersH, over: Math.max(0, used - room) };
}
/** The try-it answers as an SVG group, upside down: rotated half a turn about their own centre. */
export function revisionAnswersSvg(lines: { label: string; answer: string; x: number }[][], st: HouseStyle, maths: boolean, x0: number, y0: number): string {
  const R = REVISION;
  if (!lines.length) return "";
  const h = lines.length * lh(R.answerSize);
  const parts = lines.flatMap((line, li) =>
    line.map((a) => {
      const by = y0 + li * lh(R.answerSize) + base(R.answerSize);
      const lw = plainWidth(a.label, R.answerSize, "bold") + 1.6;
      return textSvg([{ text: a.label, style: "bold" }], x0 + a.x, by, R.answerSize, st.navy) + textSvg(titleRuns(a.answer, maths), x0 + a.x + lw, by, R.answerSize, st.ink);
    }),
  );
  return `<g transform="rotate(180 ${n(x0 + W / 2)} ${n(y0 + h / 2)})">${parts.join("")}</g>`;
}
function revisionPage(r: Revision, ctx: BCtx, pageNo: number): string {
  const st = ctx.st;
  const maths = !!ctx.maths;
  const x0 = A4.marginX;
  const out: string[] = [];
  let y = A4.top;
  out.push(textSvg(titleRuns(r.title, maths), x0, y + base(A4.lessonTitle), A4.lessonTitle, st.navy).replace("<text ", '<text font-weight="700" '));
  y += lh(A4.lessonTitle) + 1;
  if (r.instruction.trim()) out.push(at(para(r.instruction, W, st), x0, y));
  const quiet = { ...ctx, issues: [] };
  const L = planRevision(r, (c, w) => card(r.cards[c], null, w, quiet, 0, 0).h, maths);
  for (const row of L.rows) {
    row.cards.forEach((ci, k) => {
      const w = row.wide ? BOOKLET_WIDTHS.full : BOOKLET_WIDTHS.half;
      ctx.where = { lesson: 0, page: pageNo };
      const natural = card(r.cards[ci], null, w, quiet, 0, 0).h;
      const slack = Math.max(0, row.h - natural);
      const grown = growLastSpace(r.cards[ci], slack);
      const f = grown ? card(grown, null, w, ctx, 0, GROW_MARGIN) : card(r.cards[ci], null, w, ctx, 0, slack);
      out.push(at(f, x0 + k * (BOOKLET_WIDTHS.half + A4.columnGap), row.y));
    });
  }
  if (L.answers.length) {
    out.push(`<line x1="${n(x0)}" y1="${n(L.answersTop + 1.2)}" x2="${n(x0 + W)}" y2="${n(L.answersTop + 1.2)}" stroke="${st.navy}" stroke-width="0.35" stroke-dasharray="2.4 1.6"/>`);
    out.push(revisionAnswersSvg(L.answers, st, maths, x0, L.answersTop + REVISION.answerGap));
  }
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
  /** The lesson's first page, where the check-in block ends: "End of check in" STOP takes the footer's place (N28). */
  checkInStop: boolean;
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
  /** The "Do it" revision page, last, or null (N30). */
  revisionPage: number | null;
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
    const banners = sectionBanners(lesson);
    const block = checkInBlock(lesson);
    const note = checkInNote(lesson);
    lesson.sections.forEach((section, si) => {
      const rows = rowsOf(section, labels[si], si + 1, L, ctx);
      // The check-in's START banner carries its heading and instruction when they fit on its line (N28).
      const folded = block?.first === si && note !== null;
      const headFrag = folded ? { h: 0, svg: "" } : sectionHead(section, st, false, !!ctx.maths);
      // A start banner stays with the heading and first row; an end banner stays with the last row.
      const startFrag = banners[si].start ? bannerFrag(banners[si].start, false, st, folded ? note : "") : null;
      // The check-in's STOP goes in the footer's place when the block ends on the lesson's first page and a stage follows (N28).
      // A section's own saved end banner always prints inline, as typed.
      const footStop = block?.last === si && block.stageNext && !section.endBanner.trim();
      const endFrag = banners[si].end ? bannerFrag(banners[si].end, true, st) : null;
      const startH = startFrag ? startFrag.h + BANNER.gap : 0;
      // The STOP takes room only once the section has left the lesson's first page, so this is read again after each page break.
      const endHNow = () => (endFrag && !(footStop && !pg.continued) ? BANNER.gap + endFrag.h : 0);
      const endH = endHNow();
      // A cycle (a start banner) always opens a new page, so pupils find where each part begins; a lesson's own first page is the exception.
      const onlyHead = pg.blocks.length === 1 && pg.blocks[0].block.kind === "head";
      if (startFrag && pg.blocks.length && !onlyHead) fresh();
      else if (pg.end + (pg.blocks.length ? A4.sectionGap : 0) + startH + headFrag.h + rows[0].h + (rows.length === 1 ? endH : 0) > A4.bottom && pg.blocks.length) fresh();
      let y = pg.end + (pg.blocks.length ? A4.sectionGap : 0);
      if (startFrag) {
        pg.blocks.push({ block: { kind: "banner", section: si, end: false, frag: startFrag }, y });
        y += startH;
      }
      if (!folded) pg.blocks.push({ block: { kind: "section", section: si, continued: false, frag: headFrag }, y });
      y += headFrag.h;
      rows.forEach((row, ri) => {
        if (ri > 0) y += A4.rowGap;
        const tail = ri === rows.length - 1 ? endHNow() : 0;
        if (y + row.h + tail > A4.bottom && ri > 0) {
          pg.end = y - A4.rowGap;
          fresh();
          const cont = sectionHead(section, st, true, !!ctx.maths);
          pg.blocks.push({ block: { kind: "section", section: si, continued: true, frag: cont }, y: pg.end });
          y = pg.end + cont.h;
        }
        pg.blocks.push({ block: { kind: "row", section: si, row }, y });
        y += row.h;
        pg.end = y;
      });
      if (endFrag && footStop && !pg.continued) pg.checkInStop = true;
      else if (endFrag) {
        // The check-in spilled past its first page: its STOP follows the last card, on a fresh page if it no longer fits.
        if (y + BANNER.gap + endFrag.h > A4.bottom) {
          fresh();
          y = pg.end - BANNER.gap;
        }
        pg.blocks.push({ block: { kind: "banner", section: si, end: true, frag: endFrag }, y: y + BANNER.gap });
        pg.end = y + BANNER.gap + endFrag.h;
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
  const revisionPageNo = doc.revision ? first + planned.length + (doc.retrieval ? 1 : 0) : null;
  const contents = [
    ...(introPageNo ? [{ label: "", title: INTRO_TITLE, page: introPageNo }] : []),
    ...doc.lessons.map((l, i) => ({ label: `${lessonWords(doc).name} ${i + 1 + lessonShift(doc) + (options.numbering?.lessonOffset ?? 0)}`, title: [l.code, l.title].filter((t) => t.trim()).join(" "), page: lessonPages[i] })),
    ...(doc.retrieval && retrievalPageNo ? [{ label: "", title: doc.retrieval.title, page: retrievalPageNo }] : []),
    ...(doc.revision && revisionPageNo ? [{ label: "", title: doc.revision.title, page: revisionPageNo }] : []),
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
    return { lesson: p.lesson, continued: p.continued, pageNo: first + pi, extra, blocks, last, checkInStop: !!p.checkInStop, squares: stageSquares(lesson), stage };
  });
  return { pages, lessonPages, introPage: introPageNo, retrievalPage: retrievalPageNo, revisionPage: revisionPageNo, contents };
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
  glyphs({ title: coverTitle(doc), code: doc.code, group: doc.group, coverNote: doc.coverNote }, { lesson: 0, page: 1 }, "The cover");
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
        const label = block.end ? sectionBanners(lesson)[block.section].end : sectionBanners(lesson)[block.section].start;
        const note = !block.end && checkInBlock(lesson)?.first === block.section ? (checkInNote(lesson) ?? "") : "";
        out.push(at(bannerFrag(label, block.end, st, note), A4.marginX, yy));
        if (note) glyphs({ instruction: note }, { lesson: p.lesson, section: block.section + 1, page: pageNo }, `Lesson ${p.lesson}, ${sectionTitle(sec)} heading`);
        glyphs({ title: label }, { lesson: p.lesson, section: block.section + 1, page: pageNo }, `Lesson ${p.lesson}, ${sectionTitle(sec)} banner`);
        continue;
      }
      if (block.kind === "section") {
        const sec = lesson.sections[block.section];
        const link = view === "answers" && sec.ncetm ? { link: sec.ncetm, onMissing: () => issues.push({ lesson: p.lesson, section: block.section + 1, page: pageNo, message: `There is no room for the NCETM link beside the "${sectionTitle(sec)}" heading. Shorten the heading's instruction or put the link on another section.` }) } : undefined;
        out.push(at(sectionHead(sec, st, block.continued, !!ctx.maths, link), A4.marginX, yy));
        if (link && !block.continued) glyphs({ title: sec.ncetm!.label }, { lesson: p.lesson, section: block.section + 1, page: pageNo }, `Lesson ${p.lesson}, ${sectionTitle(sec)} NCETM link`);
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
        const slack = Math.max(0, c.h - natural);
        const grown = growLastSpace(section.cards[c.index], slack);
        const f = grown ? card(grown, c.number, c.w, ctx, extra, GROW_MARGIN) : card(section.cards[c.index], c.number, c.w, ctx, extra, slack);
        out.push(at(f, A4.marginX + c.x, yy + c.dy));
      });
    }
    const mis = pageMisconception(lesson, p, view, !!ctx.maths);
    for (const pr of mis.problems) issues.push({ lesson: p.lesson, section: pr.section + 1, page: pageNo, message: pr.message });
    if (mis.note) glyphs({ title: lesson.sections[mis.note.section].misconception!.watch, instruction: lesson.sections[mis.note.section].misconception!.ask + " " + lesson.sections[mis.note.section].misconception!.source }, { lesson: p.lesson, section: mis.note.section + 1, page: pageNo }, `Lesson ${p.lesson}, ${sectionTitle(lesson.sections[mis.note.section])} misconception`);
    const foot = p.last ? endBand(shownLesson, shownPage, st, lessonWords(doc)) : p.checkInStop ? checkInBand(shownPage, st) : footer(doc, shownPage, st) + (mis.note ? misconceptionSvg(mis.note.lines) : "");
    pages.push(page(out.join("") + foot, `${doc.title}, lesson ${shownLesson}, page ${shownPage}${view === "answers" ? ", answers" : ""}`, options));
  }

  if (view === "answers") doc.lessons.forEach((l, i) => {
    const links = l.sections.filter((s) => s.ncetm).length;
    const shown = i + 1 + (options.numbering?.lessonOffset ?? 0) + lessonShift(doc);
    if (links > NCETM_LINKS_PER_LESSON) issues.push({ lesson: i + 1, message: `Lesson ${shown} has ${links} NCETM links. Keep it to ${NCETM_LINKS_PER_LESSON} or fewer, so each one earns its place.` });
  });

  if (doc.retrieval && plan.retrievalPage) {
    const pageNo = plan.retrievalPage + (options.numbering?.pageOffset ?? 0);
    glyphs(doc.retrieval, { lesson: 0, retrieval: true, page: pageNo }, "The fold-over page");
    pages.push(page(retrievalPage(doc.retrieval, st, issues, pageNo, doc.notation === "maths") + footer(doc, pageNo, st), `${doc.title}, ${doc.retrieval.title}`, options));
  }

  if (doc.revision && plan.revisionPage) {
    const pageNo = plan.revisionPage + (options.numbering?.pageOffset ?? 0);
    const r = doc.revision;
    glyphs({ title: r.title, instruction: r.instruction, answers: r.answers }, { lesson: 0, revision: true, page: pageNo }, "The revision page");
    r.cards.forEach((c, ci) => {
      glyphs(c, { lesson: 0, revision: true, page: pageNo }, `The revision page, card ${ci + 1}`);
      if (c.stage) issues.push({ lesson: 0, revision: true, page: pageNo, message: "A revision card has a worksheet stage, which booklets do not print." });
    });
    const quiet = { ...ctx, issues: [] };
    const L = planRevision(r, (c, w) => card(r.cards[c], null, w, quiet, 0, 0).h, !!ctx.maths);
    if (L.over > 0) issues.push({ lesson: 0, revision: true, page: pageNo, message: `The revision page needs ${n(L.over)} mm more height: it must fit one side, so shorten a card or the answers; text is never shrunk.` });
    if (r.answers.some((a) => /\{[^{}]+\/[^{}]+\}/.test(a.answer))) issues.push({ lesson: 0, revision: true, page: pageNo, message: "A revision answer has a stacked fraction, which the upside-down answers print as typed. Write it with a slash, such as h = A/5." });
    const before = ctx.issues.length;
    pages.push(page(revisionPage(r, ctx, pageNo) + footer(doc, pageNo, st), `${doc.title}, ${r.title}`, options));
    for (const i of ctx.issues.slice(before)) (i as BookletIssue).revision = true;
  }
  // The four topic pages (N30): folded A3 needs a multiple of 4 sides, and each lesson opens on a right-hand (odd) page so its stage spreads open together.
  if (!options.numbering) {
    if (pages.length > doc.maxSides) issues.push({ lesson: 0, page: 1, message: `The booklet has ${pages.length} sides; the photocopier takes at most ${doc.maxSides}. Split the unit into parts at lesson breaks (topicPartBooklet), each part a full booklet with the four topic pages.` });
    if (doc.part && doc.part.n > doc.part.of) issues.push({ lesson: 0, page: 1, message: `The cover says Part ${doc.part.n} of ${doc.part.of}: the part number is more than the number of parts.` });
  }
  if (doc.revision && !options.numbering) {
    if (pages.length % 4) issues.push({ lesson: 0, revision: true, page: pages.length, message: `The booklet has ${pages.length} sides; folded A3 needs a multiple of 4. Use the four topic pages: cover, topic introduction, Know it (fold-over page) and Do it (revision page).` });
    plan.lessonPages.forEach((pg, i) => {
      if (pg % 2 === 0) issues.push({ lesson: i + 1, page: pg, message: `Lesson ${i + 1 + lessonShift(doc)} starts on page ${pg}, a left-hand page, so its stage spreads split across a page turn. Every lesson must start on an odd page.` });
    });
  }
  // Card-level issues carry the lesson, section and question they belong to.
  for (const i of ctx.issues) issues.push({ lesson: i.lesson, section: i.section, question: i.question, page: i.page, ...((i as BookletIssue).revision ? { revision: true } : {}), message: i.message });
  return { pages, issues: dedupe(issues), lessonPages: plan.lessonPages, introPage: plan.introPage, retrievalPage: plan.retrievalPage, revisionPage: plan.revisionPage };
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

/** Guide-style file name: [code]_[title]_Booklet_A4.pdf, with _Answers before _A4 and _Part 1 of 2 after the title for a part (N33). */
export function bookletFileName(booklet: Booklet, view: View = "pupil"): string {
  const d = booklet.document;
  const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  const parts = [d.code, d.title, d.part ? `Part ${d.part.n} of ${d.part.of}` : ""].map(safe).filter(Boolean);
  return `${parts.join("_") || "Booklet"}_Booklet${view === "answers" ? "_Answers" : ""}_A4.pdf`;
}

/** Where an issue is, in teacher words. */
export function issuePlace(i: BookletIssue): string {
  return [i.retrieval ? "fold-over page" : i.revision ? "revision page" : i.lesson ? `lesson ${i.lesson}` : i.page === 1 ? "cover" : i.lesson === 0 ? "unit introduction" : "", i.section && `section ${i.section}`, i.question !== undefined && `question ${i.question}`, i.page && `page ${i.page}`].filter(Boolean).join(", ");
}

/** The printed pages of one lesson (0-based index), with the full booklet's page numbers. */
export function lessonPagesOf(booklet: Booklet, lesson: number, options: BookletRenderOptions = {}): { pages: string[]; issues: BookletIssue[] } {
  const r = renderBooklet(booklet, options);
  const start = r.lessonPages[lesson] - 1;
  const end = lesson + 1 < r.lessonPages.length ? r.lessonPages[lesson + 1] - 1 : r.retrievalPage ? r.retrievalPage - 1 : r.revisionPage ? r.revisionPage - 1 : r.pages.length;
  return { pages: r.pages.slice(start, end), issues: r.issues };
}

/** A one-lesson booklet that prints that lesson exactly as the full booklet does, for small
 * download links: no introduction, and numbering offsets so lesson and page numbers match. */
export function singleLessonBooklet(booklet: Booklet, lesson: number): { booklet: Booklet; numbering: { lessonOffset: number; pageOffset: number } } {
  const full = renderBooklet(booklet);
  const doc = booklet.document;
  return {
    booklet: { ...booklet, document: { ...doc, intro: null, retrieval: null, revision: null, part: null, lessons: [doc.lessons[lesson]] } },
    numbering: { lessonOffset: lesson, pageOffset: full.lessonPages[lesson] - 2 },
  };
}

/**
 * One lesson as a booklet of its own WITH the four topic pages (N30, Tim 25 November 2026): cover,
 * topic introduction, the lesson, Know it, Do it: 12 sides for folded A3. Lesson and page numbers
 * are the small booklet's own (pages 1 to 12); the lesson keeps its number in the unit.
 */
export function topicLessonBooklet(booklet: Booklet, lesson: number, o: { coverNote?: string } = {}): Booklet {
  const doc = booklet.document;
  // The topic introduction still lists every lesson of the topic, with this one highlighted.
  const intro = doc.intro ? { ...doc.intro, lessons: introLessons(doc, doc.intro), highlight: [lesson] } : null;
  return { ...booklet, document: { ...doc, intro, part: null, coverNote: o.coverNote ?? doc.coverNote, firstLessonNumber: doc.firstLessonNumber + lesson, lessons: [doc.lessons[lesson]] } };
}

/**
 * Lessons from..to (0-based, inclusive) of a unit as one part of it, a full booklet with the four
 * topic pages (N33, Tim 25 November 2026: the photocopiers take at most 64 sides). The cover reads
 * "Part n of m" and lists only this part's lessons; the topic introduction lists the whole unit
 * with this part's lessons highlighted. Under N33 Know it and Do it in an earlier part cover only
 * that part's lessons, so pass them in o; left out, the unit's own pages are kept (the last part).
 */
export function topicPartBooklet(booklet: Booklet, from: number, to: number, part: { n: number; of: number }, o: { coverNote?: string; retrieval?: Booklet["document"]["retrieval"]; revision?: Booklet["document"]["revision"] } = {}): Booklet {
  const doc = booklet.document;
  if (from < 0 || to < from || to >= doc.lessons.length) throw new RangeError(`Lessons ${from} to ${to} are not in this ${doc.lessons.length}-lesson booklet.`);
  const highlight = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const intro = doc.intro ? { ...doc.intro, lessons: introLessons(doc, doc.intro), highlight } : null;
  return { ...booklet, document: { ...doc, intro, part, retrieval: o.retrieval === undefined ? doc.retrieval : o.retrieval, revision: o.revision === undefined ? doc.revision : o.revision, coverNote: o.coverNote ?? doc.coverNote, firstLessonNumber: doc.firstLessonNumber + from, lessons: doc.lessons.slice(from, to + 1) } };
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

/** An empty area on a lesson page that is neither a card nor working or drawing space (booklet standard N21). */
export interface BookletGap {
  /** 1-based lesson. */
  lesson: number;
  /** The printed page number, after numbering offsets. */
  page: number;
  /** foot: below the last card on the page; beside: the empty half of a row that holds one card; inside: blank card height that no working space could take. */
  kind: "foot" | "beside" | "inside";
  section?: number;
  question?: QuestionLabel;
  /** Size of the empty area in millimetres. */
  width: number;
  height: number;
  message: string;
}

/** The most empty height a lesson page may leave without a card, in millimetres (booklet standard N21). */
export const GAP_LIMIT = 20;

/**
 * Empty areas on each lesson page taller than `limit`, measured from the same page plan the PDF and
 * Word file are drawn from. Spare height already given to working and drawing spaces is not empty.
 */
export function bookletGaps(saved: Booklet, options: Pick<BookletRenderOptions, "numbering" | "view" | "style"> = {}, limit: number = GAP_LIMIT): BookletGap[] {
  const booklet = typesetForPrint(saved);
  const doc = booklet.document;
  const st = styles[options.style ?? "mathsdock"];
  const quiet: BCtx = { st, view: options.view ?? "pupil", diagrams: 0, issues: [], where: { lesson: 0 }, maths: doc.notation === "maths" };
  const plan = planBooklet(booklet, options);
  const out: BookletGap[] = [];
  const mm = (v: number) => Math.round(v);
  plan.pages.forEach((p, pi) => {
    const page = p.pageNo + (options.numbering?.pageOffset ?? 0);
    const next = plan.pages[pi + 1];
    // The next page cannot lend a card when this is the lesson's last page or the next page opens a cycle (a forced break).
    const forced = p.last || !next || next.blocks.some((b) => b.kind === "banner" && !b.end);
    const lesson = doc.lessons[p.lesson - 1];
    const bottom = p.blocks.reduce((m, b) => Math.max(m, b.y + b.h), 0);
    const foot = A4.bottom - bottom;
    if (foot > limit)
      out.push({ lesson: p.lesson, page, kind: "foot", width: W, height: foot, message: `Page ${page} leaves ${mm(foot)} mm empty below its last card (the limit is ${limit} mm). ${forced ? "Give the cards more working space, set a card wide or tall, or add a question." : "Give the cards more working space, set a card wide or tall, add a question, or move a card up from the next page."}` });
    for (const b of p.blocks) {
      if (b.kind !== "row") continue;
      const section = lesson.sections[b.section];
      const where = { lesson: p.lesson, page, section: b.section + 1, question: b.cards[0].number ?? undefined };
      if (section.columns === 2 && b.shape.kind === "pair" && b.cards.length === 1 && b.h > limit)
        out.push({ ...where, kind: "beside", width: BOOKLET_WIDTHS.half, height: b.h, message: `Page ${page}: ${b.cards[0].number !== null ? `question ${b.cards[0].number}` : "a card"} stands alone with a ${mm(b.h)} mm tall empty half row beside it. ${section.cards[b.cards[0].index].tall ? "It is set tall but no cards follow it: add cards after it, or set it wide." : "Set the card wide, add a card beside it, or make it tall beside cards that follow."}` });
      const measure = (i: number, w: number) => card(section.cards[i], b.cards.find((c) => c.index === i)?.number ?? null, w, quiet, p.extra, 0).h;
      const tall = b.shape.kind === "tall";
      let stackBlank = 0;
      for (const c of placeRow(section, b, b.h, measure)) {
        const slack = c.h - measure(c.index, c.w);
        if (!(slack > 0) || growLastSpace(section.cards[c.index], slack)) continue;
        if (tall && c.slot > 0) stackBlank += slack;
        if (slack > limit)
          out.push({ ...where, question: c.number ?? undefined, kind: "inside", width: c.w, height: slack, message: `Page ${page}: ${c.number !== null ? `question ${c.number}` : "a card"} has ${mm(slack)} mm of blank height that no working space can take (drawing spaces do not grow). ${tall && c.slot > 0 ? "Give the stacked cards working spaces, add cards to the stack, or shorten the tall card." : "Give the card a working space, or pair it with a card of similar height."}` });
      }
      // Blank shared thinly among a tall card's stack can add up to an empty column.
      if (tall && stackBlank > limit && !out.some((g) => g.kind === "inside" && g.page === page && b.cards.slice(1).some((c) => (c.number ?? undefined) === g.question)))
        out.push({ ...where, question: b.cards[1].number ?? undefined, kind: "inside", width: BOOKLET_WIDTHS.half, height: stackBlank, message: `Page ${page}: the cards stacked beside a tall card leave ${mm(stackBlank)} mm blank in all. Give the stacked cards working spaces, add cards to the stack, or shorten the tall card.` });
    }
  });
  return out;
}
