import { typesetForPrint } from "./typeset";
import { card as measureCard, growLastSpace } from "./render";
import { A4, BANNER, BOOKEND, BOOKLET_WIDTHS, CONTENTS_HEADING, INTRO_TITLE, introLessons, planRevision, REVISION, retrievalHeadHeight, revisionAnswersSvg, placeRow, CONTINUED_HEAD, RETRIEVAL, retrievalAnswerWidth, retrievalQuestionWidth, retrievalRowHeights, DID_YOU_KNOW, didYouKnowBox, didYouKnowMaths, powersOnly, didYouKnowIcon, CONTINUED_RULE, fitLine, KEY_IDEA, keyIdeaLabelWidth, keyIdeaLines, keyIdeas, keyIdeaTextWidth, planBooklet, planNotes, renderBooklet, renderLessonNotes, STAGE_UNLIT, START_SIZES, startBlockHeight, startTextWidth, startTextX, unitLabel, type BookletIssue, type NotesPage, type PlannedLessonPage } from "./booklet-render";
import { LESSON_WORDS, lessonShift, lessonWords, sectionTitle, type Booklet, type LessonWords, type Intro, type Lesson, type Retrieval, type Revision, type Section } from "./booklet";
import {
  CARD_RULE,
  cardCell,
  cell,
  drawing,
  END_MM,
  gap,
  LAST_PARAGRAPH,
  lineBox,
  para,
  row,
  run,
  runs,
  tab,
  titleWordRuns,
  table,
  tw,
  WORD_FOOT_MM,
  WORD_NAMESPACES,
  WORD_WRAP_SLACK_MM,
  writePackage,
  XML_HEAD,
  type DocxOptions,
  type ExtraPart,
  type WordCtx,
} from "./docx";
import { SIZE, styles, type HouseStyle } from "./style";
import { plainWidth, wrap } from "./text";
import type { FontStyle } from "./metrics";

/**
 * Word (.docx) output for the A4 unit booklet, drawn from the same page plan as the SVG pages and
 * PDFs, so Word never decides where a page breaks:
 *
 * - every page opens with a 1 pt paragraph that starts a new page, and holds exactly the blocks the
 *   plan put on it, at the plan's heights, with exact gaps between them;
 * - question cards are the worksheet's Word cards (docx.ts): bordered cells pinned to at least the
 *   planned height, rows that cannot split across pages, exact line spacing and padding;
 * - a two-column row is one table row, so its cards share a height as they do on the page;
 * - the cover's contents and the footers' page numbers come from the plan;
 * - Word's bottom margin is WORD_FOOT_MM smaller than the layout's, so a card that Word draws a
 *   fraction taller never pushes the page's last row onto another page.
 *
 * docs/content/WORD-OUTPUT.md has the rules and the real-Word evidence.
 */

export interface BookletDocxOptions extends DocxOptions {
  /** A lesson printed on its own (from singleLessonBooklet): no cover, numbered as in the full booklet. */
  numbering?: { lessonOffset: number; pageOffset: number };
}
export interface RenderedBookletDocx {
  bytes: Uint8Array;
  /** Layout problems; the file is still written so the problem can be seen. */
  issues: BookletIssue[];
  /** Pages the file must print as, from the plan. */
  pages: number;
}

type Where = { lesson: number; section?: number; question?: number | string; page?: number };
type Ctx = WordCtx<Where>;
const S = SIZE;
const W = A4.page.width - 2 * A4.marginX;
const lh = lineBox;
const base = (size: number) => (lh(size) - size) / 2 + size * 0.82;
/** Word draws a 0.3 mm bottom border with its centre about 0.2 mm below the row's edge (probe P8). */
const BORDER_DROP = 0.2;
/** Footer: the hairline's centre and the text baseline, as on the SVG pages. */
const FOOT_TEXT_TOP = A4.footerBase - base(A4.pageNumber);
const FOOT_ROW = FOOT_TEXT_TOP - A4.footerRule + lh(A4.pageNumber);
/** Distance from the page's foot to the footer's last (1 pt) paragraph. */
const FOOTER_DISTANCE = A4.page.height - (A4.footerRule + FOOT_ROW + END_MM);

const lines = (src: string, size: number, width: number, style?: FontStyle, maths = false) => wrap(src, size, width, style, maths).length;

/** A paragraph of text at one size, with exact line spacing; Word's line is 1 mm longer than measured. */
function textPara(src: string, size: number, o: { color?: string; bold?: boolean; italic?: boolean; align?: "left" | "center" | "right"; left?: number; right?: number; maths?: boolean } = {}) {
  return para(runs(src, { color: o.color, bold: o.bold, italic: o.italic, sizeMm: size }, "regular", o.maths), { line: lh(size), align: o.align, left: o.left, right: o.right ?? -WORD_WRAP_SLACK_MM });
}
/** A rule of `h` millimetres: a one-row table shaded in its colour. */
const ruleTable = (width: number, h: number, colour: string) => table([width], [row([cell(gap(END_MM), { width, shade: colour })], { mm: h, exact: true })]);

/** A tinted note box with a navy bar on its left (the key idea, the cover note). */
function noteBox(source: string, st: HouseStyle): { xml: string; h: number } {
  const pad = 3;
  const h = lines(source, S.body, W - pad * 2 - 1) * lh(S.body) + pad * 2;
  const xml = table(
    [W],
    [
      row([
        cell(para(runs(source), {}), {
          width: W,
          shade: st.tint,
          borders: { left: { color: st.navy, width: 1.1 } },
          margin: { top: pad, left: pad + 1, bottom: pad, right: pad - WORD_WRAP_SLACK_MM },
        }),
      ]),
    ],
  );
  return { xml, h };
}

/** The key idea box (N3), as the SVG page draws it: "Key idea" in a left cell, each idea on its own line in a right cell. */
function keyIdeaBox(keyIdea: string, st: HouseStyle, maths: boolean): { xml: string; h: number } {
  const K = KEY_IDEA;
  const left = keyIdeaLabelWidth();
  const ideas = keyIdeas(keyIdea).map((idea) => ({ idea, ...keyIdeaLines(idea, keyIdeaTextWidth(), maths) }));
  const textH = ideas.reduce((h, f) => h + f.h, 0) + K.ideaGap * (ideas.length - 1);
  const label = cell(para(runs(K.label, { bold: true, color: st.navy }), {}), {
    width: left,
    shade: st.tint,
    borders: { left: { color: st.navy, width: K.bar } },
    margin: { top: K.pad, left: K.bar + K.pad, bottom: K.pad, right: 0 },
  });
  const text = cell(ideas.map((f, i) => para(runs(f.idea, {}, "regular", maths), { line: f.line, after: i < ideas.length - 1 ? K.ideaGap : 0 })).join(""), {
    width: W - left,
    shade: st.tint,
    margin: { top: K.pad, left: 0, bottom: K.pad, right: K.pad - WORD_WRAP_SLACK_MM },
  });
  return { xml: table([left, W - left], [row([label, text])]), h: textH + K.pad * 2 };
}

/** A navy tile with white bold text, `h` high: as a shaded cell's content, or nested inside a taller cell. */
function tile(text: string, w: number, h: number, size: number, st: HouseStyle) {
  const content = para(run(text, { bold: true, color: "#ffffff", sizeMm: size }), { align: "center", line: lh(size) });
  return table([w], [row([cell(content, { width: w, shade: st.navy, vAlign: "center" })], { mm: h, exact: true })]);
}

// ---------------------------------------------------------------- lesson pages

const pt = (v: number) => v * 0.3528;

/** A tile of centred lines on a shaded cell, exactly w by h: the lesson tiles and stage squares (N11). */
function linesTile(lines: { text: string; size: number; color: string; line?: number }[], w: number, h: number, shade: string): string {
  const content = lines.map((l) => para(run(l.text, { bold: true, color: l.color, sizeMm: l.size }), { align: "center", line: l.line ?? lh(l.size) })).join("");
  return table([w], [row([cell(content, { width: w, shade, vAlign: "center" })], { mm: h, exact: true })]);
}

/** The lesson's start block (N11) and key idea; the same geometry as the SVG lessonHead. */
function lessonHead(doc: Booklet["document"], lesson: Lesson, number: number, ctx: Ctx): { xml: string; h: number } {
  const st = ctx.st;
  const B = BOOKEND;
  const h = startBlockHeight(doc, lesson);
  const tw_ = startTextWidth();
  const tagW = W - startTextX() - tw_;
  const unit = unitLabel(doc);
  const navy = (content: string, width: number, vAlign: "top" | "center" = "center") => cell(content, { width, shade: st.navy, vAlign });
  const tileCell = navy(linesTile([{ text: lessonWords(doc).badge, size: pt(10), color: st.navy, line: 5 }, { text: String(number), size: pt(26), color: st.navy, line: 10.5 }], B.tile, B.tile, "#ffffff"), B.tile);
  const text =
    (unit ? textPara(unit, START_SIZES.unit, { color: "#ffffff", bold: true, right: 0 }) + gap(START_SIZES.gap) : "") +
    textPara(lesson.title, START_SIZES.title, { color: "#ffffff", bold: true, right: 0 });
  const tag = para(run(B.start, { bold: true, color: "#ffffff", sizeMm: pt(14) }), { align: "right", line: lh(pt(14)), right: B.startPad });
  const out = [
    table(
      [B.startPad, B.tile, 5, tw_ + WORD_WRAP_SLACK_MM, tagW - WORD_WRAP_SLACK_MM],
      [row([navy(gap(END_MM), B.startPad), tileCell, navy(gap(END_MM), 5), navy(text, tw_ + WORD_WRAP_SLACK_MM), navy(tag, tagW - WORD_WRAP_SLACK_MM)], { mm: h, exact: true })],
    ),
  ];
  let y = h;
  if (lesson.keyIdea.trim()) {
    out.push(gap(3));
    const box = keyIdeaBox(lesson.keyIdea, st, !!ctx.maths);
    out.push(box.xml);
    y += 3 + box.h;
  }
  if (lesson.didYouKnow.trim()) {
    // The "Did you know?" box (N12, option H): a bordered cell of exact height, the icon as a small
    // picture beside the label, the fact under them, and the pale drop line as a thin shaded row.
    // Word prints top and bottom borders outside the row height (probe P1), so the row is two edges
    // shorter and one edge narrower; Word's corners are square where the SVG's are rounded.
    const D = DID_YOU_KNOW;
    const b = didYouKnowBox(lesson.didYouKnow, !!ctx.maths);
    const s = D.icon;
    const icon = drawing({ svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${s}mm" height="${s}mm" viewBox="0 0 ${s} ${s}" role="img" aria-label="Lightbulb">${didYouKnowIcon(s, st.navy)}</svg>`, widthMm: s, heightMm: s }, s, 0, ctx);
    const iconRun = icon.match(/<w:r><w:drawing>[\s\S]*?<\/w:drawing><\/w:r>/)?.[0] ?? "";
    const label = para(iconRun + run("  ", { sizeMm: pt(6) }) + run(D.label, { bold: true, color: st.navy, sizeMm: D.size, spacingMm: D.tracking }), { line: D.labelLine });
    const edge = { color: D.edgeColour, width: D.edge };
    const content = gap(D.padTop - D.edge) + label + textPara(lesson.didYouKnow.trim(), D.size, { maths: didYouKnowMaths(lesson.didYouKnow, !!ctx.maths) });
    out.push(gap(D.gap));
    out.push(
      table(
        [W - D.edge],
        [
          row([cell(content, { width: W - D.edge, borders: { top: edge, left: edge, bottom: edge, right: edge }, margin: { top: 0, left: D.padX - D.edge, bottom: 0, right: D.padX - D.edge - WORD_WRAP_SLACK_MM } })], { mm: b.h - 2 * D.edge, exact: true }),
          // The drop line is the same table's second row: two tables touching would merge in Word.
          row([cell(gap(END_MM), { width: W - D.edge, shade: st.tint })], { mm: D.drop, exact: true }),
        ],
      ),
    );
    y += D.gap + b.total;
  }
  return { xml: out.join(""), h: y };
}

/** The corner badge and stage squares of a later page (N11): right on odd printed pages, left on even. */
function cornerBadge(number: number, squares: string[], lit: string | null, pageNo: number, st: HouseStyle, words: LessonWords): string {
  const B = BOOKEND;
  const right = pageNo % 2 === 1;
  const badge = cell(linesTile([{ text: words.badge, size: pt(10), color: "#ffffff", line: 4.6 }, { text: String(number), size: pt(24), color: "#ffffff", line: 9 }], B.badgeW, B.badgeH, st.navy), { width: B.badgeW });
  const sq: { xml: string; w: number }[] = [];
  squares.forEach((label, i) => {
    if (i) sq.push({ xml: cell(gap(END_MM), { width: B.squareGap }), w: B.squareGap });
    const on = label === lit;
    sq.push({ xml: cell(linesTile([{ text: label, size: pt(16), color: on ? "#ffffff" : STAGE_UNLIT }], B.square, B.square, on ? st.navy : st.tint), { width: B.square, vAlign: "center" }), w: B.square });
  });
  const run_ = sq.reduce((k, c) => k + c.w, 0);
  const between = squares.length ? [{ xml: cell(gap(END_MM), { width: B.badgeGap }), w: B.badgeGap }] : [];
  const used = B.badgeW + run_ + (squares.length ? B.badgeGap : 0);
  const rest = { xml: cell(gap(END_MM), { width: W - used }), w: W - used };
  const cells = right ? [rest, ...sq, ...between, { xml: badge, w: B.badgeW }] : [{ xml: badge, w: B.badgeW }, ...between, ...sq, rest];
  return table(
    cells.map((c) => c.w),
    [row(cells.map((c) => c.xml), { mm: B.badgeH, exact: true })],
  );
}

/** A section's heading, its instruction (on the same line when it fits) and the navy rule under it. */
function sectionHead(section: Section, st: HouseStyle, continued: boolean, maths: boolean): { xml: string; h: number } {
  const title = sectionTitle(section) + (continued ? " (continued)" : "");
  const titleW = plainWidth(title, A4.heading, "bold");
  const ins = continued ? "" : section.instruction.trim();
  const inline = !!ins && plainWidth(ins, A4.small) <= W - titleW - 4;
  const head = titleWordRuns(title, { bold: true, color: st.navy, sizeMm: A4.heading }, maths);
  const out = [
    para(inline ? head + tab() + runs(ins, { color: st.muted, sizeMm: A4.small }) : head, { line: lh(A4.heading), tabs: inline ? [{ pos: titleW + 4 }] : undefined, right: -WORD_WRAP_SLACK_MM }),
  ];
  let h = lh(A4.heading);
  if (ins && !inline) {
    out.push(textPara(ins, A4.small, { color: st.muted }));
    h += lines(ins, A4.small, W) * lh(A4.small);
  }
  out.push(gap(0.8), ruleTable(W, 0.5, st.navy), gap(2.5));
  return { xml: out.join(""), h: h + 3.8 };
}

/** A cycle banner: one navy row, the label in white bold on the left and START or STOP on the right. */
function banner(label: string, end: boolean, st: HouseStyle): string {
  const o = { bold: true, color: "#ffffff", sizeMm: S.body };
  const tag = end ? BANNER.end : BANNER.start;
  const room = W - 2 * BANNER.pad - plainWidth(tag, S.body, "bold") - 6;
  const text = para(runs(fitLine(label, S.body, room, "bold"), o) + tab(o) + run(tag, o), { line: lh(S.body), left: BANNER.pad, right: BANNER.pad, tabs: [{ pos: W - BANNER.pad, align: "right" }] });
  return table([W], [row([cell(text, { width: W, shade: st.navy, vAlign: "center" })], { mm: BANNER.h, exact: true })]);
}

/** The running header of a continued page: lesson and title, then a hairline. */
function continuedHead(label: string, st: HouseStyle): string {
  const h = CONTINUED_RULE - BORDER_DROP;
  return (
    table([W], [row([cell(para(runs(label, { color: st.muted, sizeMm: A4.small }), { line: lh(A4.small) }), { width: W, borders: { bottom: { color: st.rule, width: 0.3 } } })], { mm: h, exact: true })]) +
    gap(CONTINUED_HEAD - h)
  );
}

function lessonPage(doc: Booklet["document"], p: PlannedLessonPage, ctx: Ctx, lessonOffset: number, pageOffset: number): string {
  const st = ctx.st;
  const lesson = doc.lessons[p.lesson - 1];
  const shownLesson = p.lesson + lessonOffset;
  const out: string[] = [];
  let cursor = BOOKEND.top;
  if (p.continued) {
    out.push(cornerBadge(shownLesson, p.squares, p.stage, p.pageNo + pageOffset, st, lessonWords(doc)));
    cursor += BOOKEND.badgeH;
  }
  for (const block of p.blocks) {
    const space = block.y - cursor;
    if (space > 0.005) out.push(gap(space));
    if (block.kind === "head") {
      const head = lessonHead(doc, lesson, shownLesson, ctx);
      out.push(head.xml);
      cursor = block.y + head.h;
      continue;
    }
    const section = lesson.sections[block.section];
    if (block.kind === "banner") {
      out.push(banner(block.end ? section.endBanner : section.startBanner, block.end, st));
      cursor = block.y + block.h;
      continue;
    }
    if (block.kind === "section") {
      const head = sectionHead(section, st, block.continued, !!ctx.maths);
      out.push(head.xml);
      cursor = block.y + head.h;
      continue;
    }
    // A row of cards: one table row that cannot split, every card pinned to the row's planned height.
    // A tall row is one table: the tall card merged down the stacked cards' rows and the gaps between them.
    const quiet = { ...ctx, issues: [] };
    const places = placeRow(section, block, block.h, (i, w) => measureCard(section.cards[i], block.cards.find((c) => c.index === i)?.number ?? null, w, quiet, p.extra, 0).h);
    // The card as printed: spare height in its last working space, as the PDF does (N18).
    const fit = (c: { index: number; number: number | string | null; w: number; h: number }) =>
      growLastSpace(section.cards[c.index], c.h - measureCard(section.cards[c.index], c.number, c.w, quiet, p.extra, 0).h) ?? section.cards[c.index];
    const where = (c: { number: number | string | null }) => (ctx.where = { lesson: p.lesson, section: block.section + 1, question: c.number ?? undefined, page: p.pageNo });
    const gapCell = () => cell(gap(END_MM), { width: A4.columnGap + CARD_RULE });
    if (block.shape.kind === "tall") {
      const [tall, ...stack] = places;
      const left = block.shape.side === "left";
      const tw_ = tall.w - CARD_RULE;
      const rule = { color: st.rule, width: CARD_RULE };
      const sides = (first: string, second: string) => (left ? [first, gapCell(), second] : [second, gapCell(), first]);
      const rows: string[] = [];
      // Merged cells below the first carry the tall card's sides; the last one draws its bottom border.
      const below = (bottom: boolean) => cell(gap(END_MM), { width: tw_, vMerge: "continue", borders: bottom ? { left: rule, right: rule, bottom: rule } : { left: rule, right: rule } });
      stack.forEach((c, j) => {
        const last = j === stack.length - 1;
        where(tall);
        const tallCell = j === 0 ? cardCell(fit(tall), tall.number, tall.w, ctx, p.extra, "restart") : below(last);
        where(c);
        rows.push(row(sides(tallCell, cardCell(fit(c), c.number, c.w, ctx, p.extra)), { mm: c.h - 2 * CARD_RULE }, true));
        if (!last) rows.push(row(sides(below(false), cell(gap(END_MM), { width: c.w - CARD_RULE })), { mm: A4.rowGap, exact: true }, true));
      });
      // Word must not break the table between its rows: every row but the last keeps with the next.
      for (let r = 0; r < rows.length - 1; r++) rows[r] = rows[r].replaceAll("<w:pPr>", "<w:pPr><w:keepNext/>");
      const grid = left ? [tw_, A4.columnGap + CARD_RULE, stack[0].w - CARD_RULE] : [stack[0].w - CARD_RULE, A4.columnGap + CARD_RULE, tw_];
      out.push(table(grid, rows));
      cursor = block.y + block.h;
      continue;
    }
    const grid: number[] = [];
    const cells: string[] = [];
    places.forEach((c, k) => {
      if (k) {
        grid.push(A4.columnGap + CARD_RULE);
        cells.push(gapCell());
      }
      where(c);
      grid.push(c.w - CARD_RULE);
      cells.push(cardCell(fit(c), c.number, c.w, ctx, p.extra));
    });
    out.push(table(grid, [row(cells, { mm: block.h - 2 * CARD_RULE }, true)]));
    cursor = block.y + block.h;
  }
  return out.join("");
}

/** A teaching-notes page of the answers copy, line for line as the SVG page places it. */
function notesPage(p: NotesPage, st: HouseStyle): string {
  const out: string[] = [];
  let cursor = A4.top;
  for (const l of p.lines) {
    const space = l.y - cursor;
    if (space > 0.005) out.push(gap(space));
    if (l.kind === "running") {
      out.push(continuedHead(l.text, st));
      cursor = l.y + CONTINUED_HEAD;
      continue;
    }
    if (l.kind === "title") out.push(textPara(l.text, l.size, { color: st.navy, bold: true }));
    else if (l.kind === "subtitle") out.push(textPara(fitLine(l.text, l.size, W), l.size, { color: st.muted }));
    else if (l.bullet)
      out.push(para(run("•", { color: st.ink, sizeMm: l.size }) + tab() + runs(l.text, { color: st.ink, sizeMm: l.size }), { line: lh(l.size), left: l.indent, hanging: l.indent - 1.2, tabs: [{ pos: l.indent }], right: -WORD_WRAP_SLACK_MM }));
    else out.push(textPara(l.text, l.size, { color: st.ink, left: l.indent || undefined }));
    cursor = l.y + lh(l.size);
  }
  return out.join("");
}

// ---------------------------------------------------------------- cover and introduction

function cover(doc: Booklet["document"], contents: { label: string; title: string; page: number }[], st: HouseStyle): string {
  const out: string[] = [];
  const code = doc.code.trim();
  const codeSize = 16 * 0.3528;
  const tileW = code ? Math.max(18, plainWidth(doc.code, codeSize, "bold") + 8) : 0;
  const tx = code ? tileW + 5 : 0;
  const groupW = doc.group.trim() ? plainWidth(doc.group, A4.small, "bold") + 6 : 0;
  const titleW = W - tx - (groupW ? groupW + 4 : 0);
  const titleH = lines(doc.title, A4.coverTitle, titleW, "bold") * lh(A4.coverTitle);
  // SVG: a title shorter than the tile is centred on it; a taller one starts 1 mm above it.
  const svgBottom = Math.max(18, titleH < 18 ? 18 : titleH - 1);
  const rowH = Math.max(18, titleH);
  const grid: number[] = [];
  const cells: string[] = [];
  if (code) {
    grid.push(tileW, 5);
    const codeRun = para(run(doc.code, { bold: true, color: "#ffffff", sizeMm: codeSize }), { align: "center", line: lh(codeSize) });
    cells.push(
      rowH > 18 ? cell(tile(doc.code, tileW, 18, codeSize, st), { width: tileW }) : cell(codeRun, { width: tileW, shade: st.navy, vAlign: "center" }),
      cell(gap(END_MM), { width: 5 }),
    );
  }
  const titleCellW = titleW + WORD_WRAP_SLACK_MM;
  grid.push(titleCellW);
  cells.push(cell(textPara(doc.title, A4.coverTitle, { color: st.navy, bold: true, right: 0 }), { width: titleCellW, vAlign: titleH < 18 ? "center" : "top" }));
  if (groupW) {
    grid.push(4 - WORD_WRAP_SLACK_MM, groupW);
    const pill = table([groupW], [row([cell(para(runs(doc.group, { bold: true, color: st.navy, sizeMm: A4.small }), { align: "center", line: lh(A4.small) }), { width: groupW, shade: st.tint, vAlign: "center" })], { mm: 6.4, exact: true })]);
    cells.push(cell(gap(END_MM), { width: 4 - WORD_WRAP_SLACK_MM }), cell(pill, { width: groupW }));
  }
  out.push(table(grid, [row(cells, { mm: rowH, exact: true })]));
  let cursor = A4.top + rowH;
  let y = A4.top + svgBottom + 10;
  if (doc.nameLine) {
    // SVG: y is the Name baseline, with the writing lines 0.8 mm below it.
    const top = y - base(S.body);
    out.push(gap(top - cursor));
    out.push(
      para(run("Name") + tab() + tab() + tab() + run("Class") + tab() + tab(), {
        tabs: [
          { pos: 13 },
          { pos: 120, leader: "underscore" },
          { pos: 128 },
          { pos: 141 },
          { pos: W, align: "right", leader: "underscore" },
        ],
      }),
    );
    cursor = top + lh(S.body);
    y += 12;
  }
  out.push(gap(y - cursor));
  out.push(para(runs(CONTENTS_HEADING, { bold: true, color: st.navy, sizeMm: A4.heading }), { line: lh(A4.heading) }), gap(1), ruleTable(W, 0.5, st.navy), gap(2));
  y += lh(A4.heading) + 1 + 2.5;
  const rowMm = 8.6;
  const textTop = rowMm / 2 + S.body * 0.34 - base(S.body);
  const rows = contents.map((c) => {
    const lw = c.label ? plainWidth(c.label, S.body, "bold") + 5 : 0;
    const pw = plainWidth(String(c.page), S.body);
    const t = fitLine(c.title, S.body, W - lw - pw - 12);
    const content =
      (c.label ? runs(c.label, { bold: true, color: st.navy }) + tab() : "") + runs(t) + tab() + run(String(c.page));
    const tabs = [...(c.label ? [{ pos: lw }] : []), { pos: W, align: "right" as const, leader: "dot" as const }];
    return row([cell(gap(textTop) + para(content, { tabs }), { width: W, borders: { bottom: { color: st.rule, width: 0.15 } } })], { mm: rowMm, exact: true }, true);
  });
  out.push(table([W], rows));
  y += rowMm * contents.length;
  if (doc.coverNote.trim()) {
    y += 8;
    out.push(gap(8), noteBox(doc.coverNote, st).xml);
  }
  return out.join("");
}

function introPage(doc: Booklet["document"], intro: Intro, st: HouseStyle): string {
  const out: string[] = [];
  out.push(textPara(INTRO_TITLE, A4.lessonTitle, { color: st.navy, bold: true }));
  const sub = [doc.code, doc.title].filter((s) => s.trim()).join(" • ");
  if (sub) out.push(para(runs(fitLine(sub, A4.small, W), { color: st.muted, sizeMm: A4.small }), { line: lh(A4.small) }));
  out.push(gap(4));
  const boxes: [string, string[]][] = (
    [
      ["What do I need to remember?", intro.remember],
      ["What will I learn?", intro.learn],
      ["How does this progress?", intro.next],
    ] as [string, string[]][]
  ).filter(([, l]) => l.length);
  const rule = { color: st.rule, width: CARD_RULE };
  if (boxes.length) {
    const gapMm = 4;
    const bw = (W - gapMm * (boxes.length - 1)) / boxes.length;
    const pad = S.cardPad;
    const heights = boxes.map(([title, list]) => {
      let yy = lines(title, S.body, bw - pad * 2, "bold") * lh(S.body) + 1.6;
      for (const b of list) yy += lines(b, S.body, bw - pad * 2 - 4.2) * lh(S.body) + 0.6;
      return yy;
    });
    const h = Math.max(...heights) + pad * 2;
    const grid: number[] = [];
    const cells: string[] = [];
    boxes.forEach(([title, list], i) => {
      if (i) {
        grid.push(gapMm + CARD_RULE);
        cells.push(cell(gap(END_MM), { width: gapMm + CARD_RULE }));
      }
      const body =
        gap(pad - rule.width) +
        para(titleWordRuns(title, { bold: true, color: st.navy }, doc.notation === "maths"), {}) +
        gap(1.6) +
        list.map((b) => para(run("•") + tab() + runs(b), { left: 4.2, hanging: 4.2 - 0.8 })).join(gap(0.6)) +
        gap(0.6 + pad - rule.width);
      grid.push(bw - CARD_RULE);
      cells.push(cell(body, { width: bw - CARD_RULE, borders: { top: rule, left: rule, bottom: rule, right: rule }, margin: { left: pad, right: pad - rule.width - WORD_WRAP_SLACK_MM } }));
    });
    out.push(table(grid, [row(cells, { mm: h - 2 * rule.width }, true)]), gap(7));
  }
  if (intro.keywords.length) {
    out.push(para(runs("Key words", { bold: true, color: st.navy, sizeMm: A4.heading }), { line: lh(A4.heading) }), gap(1.5));
    const ww = Math.min(60, Math.max(32, ...intro.keywords.map((k) => plainWidth(k.word, S.body, "bold") + 6)));
    const line = { color: st.rule, width: 0.35 };
    const borders = { top: line, left: line, bottom: line, right: line };
    const margin = { left: 2.4, right: 2.4 - WORD_WRAP_SLACK_MM };
    // Borders print outside a minimum row height (probe P1): each row gives one rule back, the last two.
    const rows = [
      row(
        [
          cell(para(runs("Word", { bold: true })), { width: ww, borders, shade: st.tableHead, vAlign: "center", margin }),
          cell(para(runs("Meaning", { bold: true })), { width: W - ww, borders, shade: st.tableHead, vAlign: "center", margin }),
        ],
        { mm: 6.4 - line.width },
        true,
      ),
      ...intro.keywords.map((k, i) => {
        const h = Math.max(lines(k.meaning, S.body, W - ww - 4.8, "regular", powersOnly(k.meaning, doc.notation === "maths")), lines(k.word, S.body, ww - 4.8, "bold")) * lh(S.body) + 2.6;
        return row(
          [
            cell(gap(1.3) + para(runs(k.word, { bold: true, color: st.navy })), { width: ww, borders, margin }),
            cell(gap(1.3) + para(runs(k.meaning, {}, "regular", powersOnly(k.meaning, doc.notation === "maths"))), { width: W - ww, borders, margin }),
          ],
          { mm: h - line.width * (i === intro.keywords.length - 1 ? 2 : 1) },
          true,
        );
      }),
    ];
    out.push(table([ww, W - ww], rows));
  }
  // The topic's lessons, this booklet's highlighted (N30), as the SVG page places them.
  const lessonLines = introLessons(doc, intro);
  if (lessonLines.length) {
    out.push(gap(7), para(runs("Lessons in this topic", { bold: true, color: st.navy, sizeMm: A4.heading }), { line: lh(A4.heading) }), gap(1.5));
    const rows = lessonLines.map((line, i) => {
      const on = intro.highlight.includes(i);
      const h = lines(line, S.body, W - 4, on ? "bold" : "regular") * lh(S.body) + 1.2;
      return row([cell(gap(0.6) + para(runs(line, on ? { bold: true, color: st.navy } : {}), { left: 2 }), { width: W, ...(on ? { shade: st.tint } : {}) })], { mm: h, exact: true });
    });
    out.push(table([W], rows));
  }
  return out.join("");
}

/** The fold-over retrieval page (N12), as the SVG page draws it: questions, a dashed fold line, then the answers strip. */
function retrievalPageXml(r: Retrieval, st: HouseStyle, maths: boolean): string {
  const R = RETRIEVAL;
  const out: string[] = [];
  out.push(para(titleWordRuns(r.title, { bold: true, color: st.navy, sizeMm: A4.lessonTitle }, maths), { line: lh(A4.lessonTitle), right: -WORD_WRAP_SLACK_MM }), gap(1));
  if (r.instruction.trim()) out.push(textPara(r.instruction, S.body));
  out.push(gap(4));
  const qw = retrievalQuestionWidth();
  const leftW = R.num + qw + R.gap;
  const rightW = R.strip;
  const fold = { color: st.ink, width: 0.4, style: "dashed" as const };
  const line = { color: st.rule, width: 0.35 };
  const margin = { left: R.gap, right: 1 - WORD_WRAP_SLACK_MM };
  const headRow = row(
    [
      cell(para(runs("Questions", { bold: true, color: st.navy })), { width: R.num + qw + WORD_WRAP_SLACK_MM, span: 2, vAlign: "bottom" }),
      cell(gap(END_MM), { width: R.gap - WORD_WRAP_SLACK_MM, borders: { right: fold } }),
      cell(para(runs("Answers", { bold: true, color: st.navy })), { width: rightW, margin, borders: { left: fold }, vAlign: "bottom" }),
    ],
    { mm: lh(S.body) + 1.5, exact: true },
  );
  const heights = retrievalRowHeights(r, maths);
  const rows = r.items.map((it, i) => {
    const h = heights[i];
    const b = { top: line, ...(i === r.items.length - 1 ? { bottom: line } : {}) };
    const q = wrap(it.question, S.body, qw, "regular", powersOnly(it.question, maths)).length * lh(S.body);
    const write = h - R.pad * 2 - q - retrievalHeadHeight(it);
    return row(
      [
        cell(gap(R.pad + retrievalHeadHeight(it)) + para(runs(String(i + 1), { bold: true, color: st.navy })), { width: R.num, borders: b }),
        cell(gap(R.pad) + (it.heading?.trim() ? para(titleWordRuns(it.heading, { bold: true, color: st.navy }, maths), { line: lh(S.body), left: -R.num }) + gap(1.6) : "") + para(runs(it.question, {}, "regular", powersOnly(it.question, maths))) + gap(Math.max(END_MM, write - lh(S.body))) + para(tab(), { tabs: [{ pos: qw, align: "right", leader: "dot" }] }), { width: qw + WORD_WRAP_SLACK_MM, borders: b }),
        cell(gap(END_MM), { width: R.gap - WORD_WRAP_SLACK_MM, borders: { ...b, right: fold } }),
        cell(gap(Math.max(END_MM, h - R.pad - wrap(it.answer, S.body, retrievalAnswerWidth(), "regular", powersOnly(it.answer, maths)).length * lh(S.body))) + para(runs(it.answer, {}, "regular", powersOnly(it.answer, maths))), { width: rightW, margin, borders: { ...b, left: fold } }),
      ],
      // Word prints row borders outside an exact row height (probe P1): each row's top rule, and the
      // last row's bottom rule too, come off its height so the table is as tall as the PDF's.
      { mm: h - line.width - (i === r.items.length - 1 ? line.width : 0), exact: true },
      true,
    );
  });
  out.push(table([R.num, qw + WORD_WRAP_SLACK_MM, R.gap - WORD_WRAP_SLACK_MM, rightW], [headRow, ...rows]));
  out.push(gap(1.5), para(runs("Fold back along the dashed line", { italic: true, color: st.muted, sizeMm: A4.small }), { line: lh(A4.small), left: leftW - 30, right: rightW - 30, align: "center" }));
  return out.join("");
}

/** The "Do it" revision page (N30), as the SVG page places it: cards in rows, then the upside-down answers as a picture. */
function revisionPageXml(r: Revision, ctx: Ctx): string {
  const st = ctx.st;
  const maths = !!ctx.maths;
  const out: string[] = [];
  out.push(para(titleWordRuns(r.title, { bold: true, color: st.navy, sizeMm: A4.lessonTitle }, maths), { line: lh(A4.lessonTitle), right: -WORD_WRAP_SLACK_MM }), gap(1));
  if (r.instruction.trim()) out.push(textPara(r.instruction, S.body));
  out.push(gap(4));
  const quiet = { ...ctx, issues: [] };
  const L = planRevision(r, (c, w) => measureCard(r.cards[c], null, w, quiet, 0, 0).h, maths);
  let cursor = L.top;
  const gapCell = () => cell(gap(END_MM), { width: A4.columnGap + CARD_RULE });
  for (const rw of L.rows) {
    if (rw.y - cursor > 0.005) out.push(gap(rw.y - cursor));
    const w = rw.wide ? BOOKLET_WIDTHS.full : BOOKLET_WIDTHS.half;
    const grid: number[] = [];
    const cells: string[] = [];
    rw.cards.forEach((ci, k) => {
      if (k) {
        grid.push(A4.columnGap + CARD_RULE);
        cells.push(gapCell());
      }
      const fit = growLastSpace(r.cards[ci], rw.h - measureCard(r.cards[ci], null, w, quiet, 0, 0).h) ?? r.cards[ci];
      grid.push(w - CARD_RULE);
      cells.push(cardCell(fit, null, w, ctx, 0));
    });
    out.push(table(grid, [row(cells, { mm: rw.h - 2 * CARD_RULE }, true)]));
    cursor = rw.y + rw.h;
  }
  if (L.answers.length) {
    const h = L.answers.length * lh(REVISION.answerSize) + REVISION.answerGap;
    if (L.answersTop - cursor > 0.005) out.push(gap(L.answersTop - cursor));
    const dash = `<line x1="0" y1="1.2" x2="${W}" y2="1.2" stroke="${st.navy}" stroke-width="0.35" stroke-dasharray="2.4 1.6"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${h}mm" viewBox="0 0 ${W} ${h}" font-family="Inter" role="img" aria-label="Answers, upside down">${dash}${revisionAnswersSvg(L.answers, st, maths, 0, REVISION.answerGap)}</svg>`;
    out.push(drawing({ svg, widthMm: W, heightMm: h }, W, 0, ctx));
  }
  return out.join("");
}

// ---------------------------------------------------------------- footer and package

function footerPart(label: string, st: HouseStyle, empty: boolean): string {
  const o = { color: st.navy, sizeMm: A4.pageNumber, bold: true };
  const content = empty
    ? ""
    : table(
        [W],
        [
          row(
            [
              cell(
                gap(FOOT_TEXT_TOP - A4.footerRule) +
                  para(run("Page ", o) + `<w:fldSimple w:instr=" PAGE ">${run("1", o)}</w:fldSimple>`, { line: lh(A4.pageNumber), align: "center" }),
                { width: W },
              ),
            ],
            { mm: FOOT_ROW, exact: true },
          ),
        ],
      );
  return `${XML_HEAD}<w:ftr ${WORD_NAMESPACES}>${content}${gap(END_MM)}</w:ftr>`;
}

/** The end band in the footer of a lesson's last page (N11): lesson tile, "End of lesson N" (or the booklet's own name), the page number and STOP. */
function endBandFooter(number: number, st: HouseStyle, words: LessonWords = LESSON_WORDS): string {
  const B = BOOKEND;
  const size = pt(14);
  const o = { bold: true, color: "#ffffff", sizeMm: size };
  const navy = (content: string, width: number) => cell(content, { width, shade: st.navy, vAlign: "center" });
  const restW = W - 3 - B.endTile - 3;
  const text = para(run(`${words.end} ${number}`, o) + tab(o) + run("Page ", o) + `<w:fldSimple w:instr=" PAGE ">${run("1", o)}</w:fldSimple>` + tab(o) + run(B.stop, o), {
    line: lh(size),
    tabs: [
      { pos: W / 2 - (3 + B.endTile + 3), align: "center" },
      { pos: restW - 5, align: "right" },
    ],
  });
  const band = table([3, B.endTile, 3, restW], [row([navy(gap(END_MM), 3), navy(linesTile([{ text: String(number), size, color: st.navy }], B.endTile, B.endTile, "#ffffff"), B.endTile), navy(gap(END_MM), 3), navy(text, restW)], { mm: B.endH, exact: true })]);
  return `${XML_HEAD}<w:ftr ${WORD_NAMESPACES}>${band}${gap(END_MM)}</w:ftr>`;
}
/** Distance from the page's foot to the end band footer's last (1 pt) paragraph, so the band's top is at BOOKEND.endTop. */
const END_FOOTER_DISTANCE = A4.page.height - (BOOKEND.endTop + BOOKEND.endH + END_MM);
/** On a lesson's last page the text area stops at the end band's top (2 mm below the layout's 281 mm, not WORD_FOOT_MM), so the band never overlaps it. */
const END_BOTTOM = A4.page.height - BOOKEND.endTop;

const pageOpen = (breakBefore: boolean) => para("", { line: END_MM, markMm: END_MM, pageBreakBefore: breakBefore });
/** The space from the page's top margin (the corner badge's top) to the cover's and introduction's own top. */
const COVER_DROP = A4.top - BOOKEND.top;

/** The Word file for one view of a booklet, or of one lesson printed on its own. */
export async function writeBookletDocx(saved: Booklet, options: BookletDocxOptions): Promise<RenderedBookletDocx> {
  const booklet = typesetForPrint(saved);
  const view = options.view ?? "pupil";
  const st = styles.mathsdock;
  const doc = booklet.document;
  const numbering = options.numbering;
  // The SVG layout's own checks come first: Word output never hides a problem the pages have.
  const rendered = renderBooklet(booklet, { view, numbering });
  const plan = planBooklet(booklet, { view, numbering });
  const ctx: Ctx = { st, view, diagrams: 0, issues: [], where: { lesson: 0 }, media: [], rels: [], pictures: [], maths: booklet.document.notation === "maths" };

  // Each page with the footer it prints: none (cover), the page number, or a lesson's end band (N11).
  const pages: { xml: string; footer: string }[] = [];
  if (!numbering) {
    pages.push({ xml: gap(COVER_DROP) + cover(doc, plan.contents, st), footer: "page" });
    if (doc.intro) pages.push({ xml: gap(COVER_DROP) + introPage(doc, doc.intro, st), footer: "page" });
  }
  const lessonOffset = (numbering?.lessonOffset ?? 0) + lessonShift(doc);
  for (const p of plan.pages) pages.push({ xml: lessonPage(doc, p, ctx, lessonOffset, numbering?.pageOffset ?? 0), footer: p.last ? `end:${p.lesson + lessonOffset}` : "page" });
  if (doc.retrieval && plan.retrievalPage) pages.push({ xml: gap(COVER_DROP) + retrievalPageXml(doc.retrieval, st, doc.notation === "maths"), footer: "page" });
  if (doc.revision && plan.revisionPage) {
    ctx.where = { lesson: 0, page: plan.revisionPage };
    pages.push({ xml: gap(COVER_DROP) + revisionPageXml(doc.revision, ctx), footer: "page" });
  }

  const label = fitLine([doc.code, doc.title].filter((s) => s.trim()).join(" · "), A4.small, W - 30);
  const footerType = "application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml";
  const parts: ExtraPart[] = [{ name: "footer1.xml", id: "rIdFooter1", relType: "footer", contentType: footerType, xml: footerPart(label, st, false) }];
  // The cover has no footer: the whole booklet's first page uses an empty one.
  if (!numbering) parts.push({ name: "footer2.xml", id: "rIdFooter2", relType: "footer", contentType: footerType, xml: footerPart(label, st, true) });
  const endFooters = new Map<string, string>();
  const footerId = (kind: string) => {
    if (kind === "page") return "rIdFooter1";
    if (!endFooters.has(kind)) {
      const k = endFooters.size + 1;
      const id = `rIdEndFooter${k}`;
      endFooters.set(kind, id);
      parts.push({ name: `footer-end${k}.xml`, id, relType: "footer", contentType: footerType, xml: endBandFooter(Number(kind.slice(4)), st, lessonWords(doc)) });
    }
    return endFooters.get(kind)!;
  };
  const firstPage = numbering ? plan.pages[0].pageNo + numbering.pageOffset : 1;
  const P = A4.page;
  // A lesson's last page is a Word section of its own, so its footer can be the end band.
  const sectPr = (kind: string, first: boolean) =>
    `<w:sectPr><w:footerReference w:type="default" r:id="${footerId(kind)}"/>${first && !numbering ? `<w:footerReference w:type="first" r:id="rIdFooter2"/>` : ""}` +
    `<w:type w:val="nextPage"/><w:pgSz w:w="${tw(P.width)}" w:h="${tw(P.height)}"/>` +
    `<w:pgMar w:top="${tw(BOOKEND.top - END_MM)}" w:right="${tw(A4.marginX)}" w:bottom="${tw(kind === "page" ? P.height - A4.bottom - WORD_FOOT_MM : END_BOTTOM)}" w:left="${tw(A4.marginX)}" w:header="0" w:footer="${tw(kind === "page" ? FOOTER_DISTANCE : END_FOOTER_DISTANCE)}" w:gutter="0"/>` +
    `${first ? `<w:pgNumType w:start="${firstPage}"/>` : ""}<w:cols w:space="0"/>${first && !numbering ? "<w:titlePg/>" : ""}<w:docGrid w:linePitch="360"/></w:sectPr>`;
  let body = "";
  let first = true;
  pages.forEach((pg, i) => {
    // A page that follows a section break needs no page break of its own.
    const afterBreak = i > 0 && pages[i - 1].footer !== pg.footer;
    body += pageOpen(i > 0 && !afterBreak) + pg.xml;
    const next = pages[i + 1];
    if (next && next.footer !== pg.footer) {
      body += `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${tw(END_MM)}" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr>${sectPr(pg.footer, first)}</w:pPr></w:p>`;
      first = false;
    }
  });
  const sect = sectPr(pages[pages.length - 1].footer, first);

  const issues = [...rendered.issues];
  for (const i of ctx.issues) if (!issues.some((j) => j.message === i.message && j.lesson === i.lesson && j.section === i.section && j.question === i.question)) issues.push(i);
  const lessonNo = numbering ? ` lesson ${numbering.lessonOffset + 1 + lessonShift(doc)}` : "";
  const bytes = await writePackage({
    body: body + LAST_PARAGRAPH + sect,
    ctx,
    options,
    title: `${doc.title}${lessonNo}${view === "answers" ? " (answers)" : ""}`,
    subject: [doc.code, doc.group].filter(Boolean).join(" "),
    keywords: ["MathsDock booklet", doc.code, doc.group, view === "answers" ? "answers" : "pupil"].filter(Boolean).join("; "),
    description: `Made by MathsDock from the booklet source. Edit the source and remake this file to keep the pupil and answer copies in step.`,
    pages: pages.length,
    parts,
  });
  return { bytes, issues, pages: pages.length };
}

/** A lesson's teaching notes as a Word file: the same pages as renderLessonNotes, numbered from 1. */
export async function writeLessonNotesDocx(saved: Booklet, lesson: number, options: DocxOptions & { numbering?: { lessonOffset: number } }): Promise<RenderedBookletDocx> {
  const booklet = typesetForPrint(saved);
  const st = styles.mathsdock;
  const doc = booklet.document;
  const shown = lesson + 1 + (options.numbering?.lessonOffset ?? 0) + lessonShift(doc);
  const rendered = renderLessonNotes(booklet, lesson, { numbering: options.numbering });
  const ctx: Ctx = { st, view: "answers", diagrams: 0, issues: [], where: { lesson: lesson + 1 }, media: [], rels: [], pictures: [], maths: doc.notation === "maths" };
  const pages = planNotes(doc.lessons[lesson], shown, lessonWords(doc)).map((np) => notesPage(np, st));
  if (!pages.length) throw Error(`Lesson ${shown} has no teaching notes to print.`);
  const body = pages.map((xml, i) => pageOpen(i === 0) + xml).join("");
  const label = fitLine([doc.code, doc.title].filter((s) => s.trim()).join(" · "), A4.small, W - 30);
  const parts: ExtraPart[] = [{ name: "footer1.xml", id: "rIdFooter1", relType: "footer", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml", xml: footerPart(label, st, false) }];
  const P = A4.page;
  const sect =
    `<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter1"/><w:pgSz w:w="${tw(P.width)}" w:h="${tw(P.height)}"/>` +
    `<w:pgMar w:top="${tw(A4.top - END_MM)}" w:right="${tw(A4.marginX)}" w:bottom="${tw(P.height - A4.bottom - WORD_FOOT_MM)}" w:left="${tw(A4.marginX)}" w:header="0" w:footer="${tw(FOOTER_DISTANCE)}" w:gutter="0"/>` +
    `<w:pgNumType w:start="1"/><w:cols w:space="0"/><w:docGrid w:linePitch="360"/></w:sectPr>`;
  const bytes = await writePackage({
    body: body + LAST_PARAGRAPH + sect,
    ctx,
    options,
    title: `${doc.title} lesson ${shown} teaching notes`,
    subject: [doc.code, doc.group].filter(Boolean).join(" "),
    keywords: ["MathsDock booklet", "teaching notes", doc.code, doc.group].filter(Boolean).join("; "),
    description: "Made by MathsDock from the booklet source: the lesson's teaching notes.",
    pages: pages.length,
    parts,
  });
  return { bytes, issues: rendered.issues, pages: pages.length };
}

/** The booklet's Word file name: the PDF's name ending .docx. */
export const bookletDocxName = (pdfName: string) => pdfName.replace(/\.pdf$/, ".docx");
