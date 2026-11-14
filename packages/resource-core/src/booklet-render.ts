import { typesetForPrint } from "./typeset";
import { at, card, countSpaces, missingCharacterMessage, missingCharacters, type Ctx, type Frag, type View } from "./render";
import { SIZE, styles, type HouseStyle, type StyleId } from "./style";
import { esc, n, parseRuns, plainWidth, textSvg, wrap } from "./text";
import type { FontStyle } from "./metrics";
import { sectionTitle, UNNUMBERED, type Booklet, type Intro, type Lesson, type Section } from "./booklet";

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
  /** Question number within the section, when the issue belongs to one card. */
  question?: number;
  /** 1-based printed page. */
  page?: number;
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
}

type W = { lesson: number; section?: number; question?: number; page?: number };
type BCtx = Ctx<W>;
const S = SIZE;
const lh = (size: number) => size * S.lineHeight;
const base = (size: number) => (lh(size) - size) / 2 + size * 0.82;

function para(src: string, width: number, st: HouseStyle, o: { size?: number; fill?: string; style?: FontStyle; x?: number } = {}): Frag {
  const size = o.size ?? S.body;
  const lines = wrap(src, size, width, o.style);
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

function lessonHead(lesson: Lesson, number: number, st: HouseStyle): Frag {
  const x = A4.lessonTile + 3.5;
  const out: string[] = [];
  out.push(rect(0, 0, A4.lessonTile, A4.lessonTile, `rx="1.6" fill="${st.navy}"`));
  out.push(textSvg([{ text: String(number), style: "bold" }], A4.lessonTile / 2, A4.lessonTile / 2 + A4.lessonTitle * 0.36, A4.lessonTitle, "white", "middle"));
  const title = para(lesson.title, W - x, st, { size: A4.lessonTitle, fill: st.navy, style: "bold", x });
  // Single-line titles sit centred on the tile; longer ones start at its top.
  const ty = title.h <= lh(A4.lessonTitle) + 0.01 ? (A4.lessonTile - lh(A4.lessonTitle)) / 2 : -0.6;
  out.push(at(title, 0, ty));
  let y = Math.max(A4.lessonTile, ty + title.h) + 1.4;
  const objective = [lesson.code, lesson.objective].filter((s) => s.trim()).join(" • ");
  if (objective) {
    const f = para(objective, W, st, { size: A4.small, fill: st.muted });
    out.push(at(f, 0, y));
    y += f.h;
  }
  if (lesson.keyIdea.trim()) {
    y += 2.6;
    const pad = 3;
    const f = para(`**Key idea** ${lesson.keyIdea}`, W - pad * 2 - 1, st, { x: pad + 1 });
    out.push(rect(0, y, W, f.h + pad * 2, `rx="1.4" fill="${st.tint}"`), rect(0, y, 1.1, f.h + pad * 2, `fill="${st.navy}"`), at(f, 0, y + pad));
    y += f.h + pad * 2;
  }
  return { h: y, svg: out.join("") };
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

interface Row {
  cards: { index: number; number: number | null }[];
  /** Natural height, before spare space. */
  h: number;
  /** Most working or drawing spaces in one card of the row: how much it grows per mm of extra. */
  spaces: number;
}

function rowsOf(section: Section, sectionNo: number, lessonNo: number, ctx: BCtx): Row[] {
  const cols = section.columns;
  const w = cols === 2 ? BOOKLET_WIDTHS.half : BOOKLET_WIDTHS.full;
  const numbered = !UNNUMBERED.has(section.kind);
  const rows: Row[] = [];
  for (let i = 0; i < section.cards.length; i += cols) {
    const cards = section.cards.slice(i, i + cols).map((_, k) => ({ index: i + k, number: numbered ? i + k + 1 : null }));
    const quiet: BCtx = { ...ctx, issues: [], diagrams: 0 };
    let h = 0,
      spaces = 0;
    for (const c of cards) {
      quiet.where = { lesson: lessonNo, section: sectionNo, question: c.number ?? undefined };
      h = Math.max(h, card(section.cards[c.index], c.number, w, quiet, 0, 0).h);
      spaces = Math.max(spaces, countSpaces(section.cards[c.index].items));
    }
    rows.push({ cards, h, spaces });
  }
  return rows;
}

type Block =
  | { kind: "head"; frag: Frag }
  | { kind: "section"; section: number; continued: boolean; frag: Frag }
  | { kind: "row"; section: number; row: Row };
interface PlannedPage {
  lesson: number;
  continued: boolean;
  blocks: { block: Block; y: number }[];
  end: number;
}

function footer(doc: Booklet["document"], page: number, st: HouseStyle) {
  const label = fitLine([doc.code, doc.title].filter((s) => s.trim()).join(" · "), A4.small, W - 30);
  return (
    hline(A4.marginX, A4.marginX + W, A4.footerRule, st) +
    textSvg(parseRuns(label), A4.marginX, A4.footerBase, A4.small, st.muted) +
    textSvg([{ text: `Page ${page}`, style: "regular" }], A4.marginX + W, A4.footerBase, A4.small, st.muted, "end")
  );
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

/** A block placed on a page: its top and height after spare height is shared out, in millimetres. */
export type PlacedBlock =
  | { kind: "head"; y: number; h: number }
  | { kind: "section"; section: number; continued: boolean; y: number; h: number }
  | { kind: "row"; section: number; cards: { index: number; number: number | null }[]; y: number; h: number; natural: number };
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
}
/**
 * The booklet's page plan: which blocks go on which page, where, and how tall. The SVG pages and
 * the Word file are both drawn from it, so they break pages in the same places.
 */
export interface BookletPlan {
  pages: PlannedLessonPage[];
  lessonPages: number[];
  introPage: number | null;
  contents: { label: string; title: string; page: number }[];
}
/** The continued-page running header: lesson number and title, a hairline, then the content. */
export const CONTINUED_HEAD = 9;
export const CONTINUED_RULE = 5.6;

export function planBooklet(saved: Booklet, options: Pick<BookletRenderOptions, "numbering" | "view" | "style"> = {}): BookletPlan {
  const booklet = typesetForPrint(saved);
  const doc = booklet.document;
  const st = styles[options.style ?? "mathsdock"];
  const ctx: BCtx = { st, view: options.view ?? "pupil", diagrams: 0, issues: [], where: { lesson: 0 }, compactTables: true, maths: booklet.document.notation === "maths" };
  const contentTop = A4.top;
  const contHead = CONTINUED_HEAD;

  // 1. Plan every lesson's pages from natural heights.
  const planned: PlannedPage[] = [];
  doc.lessons.forEach((lesson, li) => {
    const L = li + 1;
    const head = lessonHead(lesson, L + (options.numbering?.lessonOffset ?? 0), st);
    let pg: PlannedPage = { lesson: L, continued: false, blocks: [{ block: { kind: "head", frag: head }, y: contentTop }], end: contentTop + head.h };
    planned.push(pg);
    const fresh = () => {
      pg = { lesson: L, continued: true, blocks: [], end: contentTop + contHead };
      planned.push(pg);
    };
    lesson.sections.forEach((section, si) => {
      const rows = rowsOf(section, si + 1, L, ctx);
      const headFrag = sectionHead(section, st, false);
      const gapBefore = pg.blocks.length ? A4.sectionGap : 0;
      if (pg.end + gapBefore + headFrag.h + rows[0].h > A4.bottom && pg.blocks.length) fresh();
      let y = pg.end + (pg.blocks.length ? A4.sectionGap : 0);
      pg.blocks.push({ block: { kind: "section", section: si, continued: false, frag: headFrag }, y });
      y += headFrag.h;
      rows.forEach((row, ri) => {
        if (ri > 0) y += A4.rowGap;
        if (y + row.h > A4.bottom && ri > 0) {
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
    });
  });

  // 2. Page numbers: cover, introduction, then lessons.
  const introPageNo = doc.intro ? 2 : null;
  const first = doc.intro ? 3 : 2;
  const lessonPages: number[] = [];
  planned.forEach((p, i) => {
    if (!p.continued) lessonPages.push(first + i);
  });
  const contents = [
    ...(introPageNo ? [{ label: "", title: "Unit introduction", page: introPageNo }] : []),
    ...doc.lessons.map((l, i) => ({ label: `Lesson ${i + 1}`, title: l.title, page: lessonPages[i] })),
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
      const grown = block.row.h + extra * block.row.spaces;
      shift += grown - block.row.h;
      return { kind: "row", section: block.section, cards: block.row.cards, y: yy, h: grown, natural: block.row.h };
    });
    return { lesson: p.lesson, continued: p.continued, pageNo: first + pi, extra, blocks };
  });
  return { pages, lessonPages, introPage: introPageNo, contents };
}

export function renderBooklet(saved: Booklet, options: BookletRenderOptions = {}): RenderedBooklet {
  const booklet = typesetForPrint(saved);
  const doc = booklet.document;
  const st = styles[options.style ?? "mathsdock"];
  const view = options.view ?? "pupil";
  const ctx: BCtx = { st, view, diagrams: 0, issues: [], where: { lesson: 0 }, compactTables: true, maths: doc.notation === "maths" };
  const issues: BookletIssue[] = [];
  const contentTop = A4.top;
  const contHead = CONTINUED_HEAD;
  const plan = planBooklet(booklet, options);

  // A character the font does not hold prints as a gap in the PDF and in another font in Word.
  const glyphs = (value: unknown, where: Omit<BookletIssue, "message">, place: string) => {
    for (const c of missingCharacters(value)) issues.push({ ...where, message: missingCharacterMessage(place, c) });
  };
  glyphs({ title: doc.title, code: doc.code, group: doc.group, coverNote: doc.coverNote }, { lesson: 0, page: 1 }, "The cover");
  if (doc.intro) glyphs(doc.intro, { lesson: 0, page: 2 }, "The unit introduction");

  const pages: string[] = [];
  pages.push(page(cover(doc, plan.contents, st, issues), `${doc.title}, cover${view === "answers" ? ", answers" : ""}`, options));
  if (doc.intro) pages.push(page(introPage(doc, doc.intro, st, issues, 2) + footer(doc, 2, st), `${doc.title}, unit introduction`, options));

  // Draw each page from the plan.
  for (const p of plan.pages) {
    const pageNo = p.pageNo;
    const lesson = doc.lessons[p.lesson - 1];
    const out: string[] = [];
    if (p.continued) {
      const label = fitLine(`Lesson ${p.lesson + (options.numbering?.lessonOffset ?? 0)} · ${lesson.title}`, A4.small, W);
      out.push(textSvg(parseRuns(label), A4.marginX, contentTop + base(A4.small), A4.small, st.muted), hline(A4.marginX, A4.marginX + W, contentTop + CONTINUED_RULE, st));
    }
    const extra = p.extra;
    for (const block of p.blocks) {
      const yy = block.y;
      if (block.kind === "head") {
        out.push(at(lessonHead(lesson, p.lesson + (options.numbering?.lessonOffset ?? 0), st), A4.marginX, yy));
        glyphs({ title: lesson.title, code: lesson.code, objective: lesson.objective, keyIdea: lesson.keyIdea }, { lesson: p.lesson, page: pageNo }, `Lesson ${p.lesson}`);
        continue;
      }
      if (block.kind === "section") {
        out.push(at(sectionHead(lesson.sections[block.section], st, block.continued), A4.marginX, yy));
        if (!block.continued) glyphs({ title: lesson.sections[block.section].title, instruction: lesson.sections[block.section].instruction }, { lesson: p.lesson, section: block.section + 1, page: pageNo }, `Lesson ${p.lesson}, ${sectionTitle(lesson.sections[block.section])} heading`);
        continue;
      }
      const section = lesson.sections[block.section];
      const cols = section.columns;
      const w = cols === 2 ? BOOKLET_WIDTHS.half : BOOKLET_WIDTHS.full;
      const grown = block.h;
      if (block.natural > A4.bottom - contentTop - contHead - 14)
        issues.push({ lesson: p.lesson, section: block.section + 1, question: block.cards[0].number ?? undefined, page: pageNo, message: `A card is ${n(block.natural)} mm tall, more than a page holds. Split it into two cards or reduce its working space; text is never shrunk.` });
      block.cards.forEach((c, k) => {
        ctx.where = { lesson: p.lesson, section: block.section + 1, question: c.number ?? undefined, page: pageNo };
        if (section.cards[c.index].stage) ctx.issues.push({ ...ctx.where, message: "A booklet card has a worksheet stage, which booklets do not print: sections have their own headings." });
        glyphs(section.cards[c.index], ctx.where, `Lesson ${p.lesson}, ${sectionTitle(section)}${c.number ? `, question ${c.number}` : ""}`);
        const natural = card(section.cards[c.index], c.number, w, { ...ctx, issues: [] }, extra, 0).h;
        const f = card(section.cards[c.index], c.number, w, ctx, extra, Math.max(0, grown - natural));
        out.push(at(f, A4.marginX + k * (w + A4.columnGap), yy));
      });
    }
    const shownPage = pageNo + (options.numbering?.pageOffset ?? 0);
    pages.push(page(out.join("") + footer(doc, shownPage, st), `${doc.title}, lesson ${p.lesson + (options.numbering?.lessonOffset ?? 0)}, page ${shownPage}${view === "answers" ? ", answers" : ""}`, options));
  }

  // Card-level issues carry the lesson, section and question they belong to.
  for (const i of ctx.issues) issues.push({ lesson: i.lesson, section: i.section, question: i.question, page: i.page, message: i.message });
  return { pages, issues: dedupe(issues), lessonPages: plan.lessonPages, introPage: plan.introPage };
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
  return [i.lesson ? `lesson ${i.lesson}` : i.page === 1 ? "cover" : i.lesson === 0 ? "unit introduction" : "", i.section && `section ${i.section}`, i.question && `question ${i.question}`, i.page && `page ${i.page}`].filter(Boolean).join(", ");
}

/** The printed pages of one lesson (0-based index), with the full booklet's page numbers. */
export function lessonPagesOf(booklet: Booklet, lesson: number, options: BookletRenderOptions = {}): { pages: string[]; issues: BookletIssue[] } {
  const r = renderBooklet(booklet, options);
  const start = r.lessonPages[lesson] - 1;
  const end = lesson + 1 < r.lessonPages.length ? r.lessonPages[lesson + 1] - 1 : r.pages.length;
  return { pages: r.pages.slice(start, end), issues: r.issues };
}

/** A one-lesson booklet that prints that lesson exactly as the full booklet does, for small
 * download links: no introduction, and numbering offsets so lesson and page numbers match. */
export function singleLessonBooklet(booklet: Booklet, lesson: number): { booklet: Booklet; numbering: { lessonOffset: number; pageOffset: number } } {
  const full = renderBooklet(booklet);
  const doc = booklet.document;
  return {
    booklet: { ...booklet, document: { ...doc, intro: null, lessons: [doc.lessons[lesson]] } },
    numbering: { lessonOffset: lesson, pageOffset: full.lessonPages[lesson] - 2 },
  };
}

/** File name for one lesson printed on its own. */
export function lessonFileName(booklet: Booklet, lesson: number, view: View = "pupil"): string {
  return bookletFileName(booklet, view).replace(/_Booklet/, `_Lesson ${lesson + 1}`);
}
