import { A4, BOOKLET_WIDTHS, CONTINUED_HEAD, CONTINUED_RULE, fitLine, planBooklet, renderBooklet, type BookletIssue, type PlannedLessonPage } from "./booklet-render";
import { sectionTitle, type Booklet, type Intro, type Lesson, type Section } from "./booklet";
import {
  CARD_RULE,
  cardCell,
  cell,
  END_MM,
  gap,
  LAST_PARAGRAPH,
  lineBox,
  para,
  row,
  run,
  runs,
  tab,
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

type Where = { lesson: number; section?: number; question?: number; page?: number };
type Ctx = WordCtx<Where>;
const S = SIZE;
const W = A4.page.width - 2 * A4.marginX;
const lh = lineBox;
const base = (size: number) => (lh(size) - size) / 2 + size * 0.82;
/** Word draws a 0.3 mm bottom border with its centre about 0.2 mm below the row's edge (probe P8). */
const BORDER_DROP = 0.2;
/** Footer: the hairline's centre and the text baseline, as on the SVG pages. */
const FOOT_TEXT_TOP = A4.footerBase - base(A4.small);
const FOOT_ROW = FOOT_TEXT_TOP - A4.footerRule + lh(A4.small);
/** Distance from the page's foot to the footer's last (1 pt) paragraph. */
const FOOTER_DISTANCE = A4.page.height - (A4.footerRule + FOOT_ROW + END_MM);

const lines = (src: string, size: number, width: number, style?: FontStyle) => wrap(src, size, width, style).length;

/** A paragraph of text at one size, with exact line spacing; Word's line is 1 mm longer than measured. */
function textPara(src: string, size: number, o: { color?: string; bold?: boolean; italic?: boolean; align?: "left" | "center" | "right"; left?: number; right?: number } = {}) {
  return para(runs(src, { color: o.color, bold: o.bold, italic: o.italic, sizeMm: size }), { line: lh(size), align: o.align, left: o.left, right: o.right ?? -WORD_WRAP_SLACK_MM });
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

/** A navy tile with white bold text, `h` high: as a shaded cell's content, or nested inside a taller cell. */
function tile(text: string, w: number, h: number, size: number, st: HouseStyle) {
  const content = para(run(text, { bold: true, color: "#ffffff", sizeMm: size }), { align: "center", line: lh(size) });
  return table([w], [row([cell(content, { width: w, shade: st.navy, vAlign: "center" })], { mm: h, exact: true })]);
}

// ---------------------------------------------------------------- lesson pages

/** The lesson's tile, title, objective and key idea; the same geometry as the SVG lessonHead. */
function lessonHead(lesson: Lesson, number: number, st: HouseStyle): { xml: string; h: number } {
  const x = A4.lessonTile + 3.5;
  const titleH = lines(lesson.title, A4.lessonTitle, W - x, "bold") * lh(A4.lessonTitle);
  const single = titleH <= lh(A4.lessonTitle) + 0.01;
  // SVG: a single line sits centred on the tile; longer titles start 0.6 mm above it.
  const svgBottom = single ? A4.lessonTile : Math.max(A4.lessonTile, titleH - 0.6);
  const rowH = single ? A4.lessonTile : Math.max(A4.lessonTile, titleH);
  const title = cell(textPara(lesson.title, A4.lessonTitle, { color: st.navy, bold: true, right: 0 }), { width: W - x + WORD_WRAP_SLACK_MM, vAlign: single ? "center" : "top" });
  const number_ = single
    ? cell(para(run(String(number), { bold: true, color: "#ffffff", sizeMm: A4.lessonTitle }), { align: "center", line: lh(A4.lessonTitle) }), { width: A4.lessonTile, shade: st.navy, vAlign: "center" })
    : cell(tile(String(number), A4.lessonTile, A4.lessonTile, A4.lessonTitle, st), { width: A4.lessonTile });
  const out = [table([A4.lessonTile, 3.5, W - x + WORD_WRAP_SLACK_MM], [row([number_, cell(gap(END_MM), { width: 3.5 }), title], { mm: rowH, exact: true })])];
  let y = svgBottom + 1.4;
  out.push(gap(y - rowH));
  const objective = [lesson.code, lesson.objective].filter((s) => s.trim()).join(" • ");
  if (objective) {
    out.push(textPara(objective, A4.small, { color: st.muted }));
    y += lines(objective, A4.small, W) * lh(A4.small);
  }
  if (lesson.keyIdea.trim()) {
    out.push(gap(2.6));
    const box = noteBox(`**Key idea** ${lesson.keyIdea}`, st);
    out.push(box.xml);
    y += 2.6 + box.h;
  }
  return { xml: out.join(""), h: y };
}

/** A section's heading, its instruction (on the same line when it fits) and the navy rule under it. */
function sectionHead(section: Section, st: HouseStyle, continued: boolean): { xml: string; h: number } {
  const title = sectionTitle(section) + (continued ? " (continued)" : "");
  const titleW = plainWidth(title, A4.heading, "bold");
  const ins = continued ? "" : section.instruction.trim();
  const inline = !!ins && plainWidth(ins, A4.small) <= W - titleW - 4;
  const head = runs(title, { bold: true, color: st.navy, sizeMm: A4.heading });
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

/** The running header of a continued page: lesson and title, then a hairline. */
function continuedHead(label: string, st: HouseStyle): string {
  const h = CONTINUED_RULE - BORDER_DROP;
  return (
    table([W], [row([cell(para(runs(label, { color: st.muted, sizeMm: A4.small }), { line: lh(A4.small) }), { width: W, borders: { bottom: { color: st.rule, width: 0.3 } } })], { mm: h, exact: true })]) +
    gap(CONTINUED_HEAD - h)
  );
}

function lessonPage(doc: Booklet["document"], p: PlannedLessonPage, ctx: Ctx, lessonOffset: number): string {
  const st = ctx.st;
  const lesson = doc.lessons[p.lesson - 1];
  const shownLesson = p.lesson + lessonOffset;
  const out: string[] = [];
  let cursor = A4.top;
  if (p.continued) {
    out.push(continuedHead(fitLine(`Lesson ${shownLesson} · ${lesson.title}`, A4.small, W), st));
    cursor += CONTINUED_HEAD;
  }
  for (const block of p.blocks) {
    const space = block.y - cursor;
    if (space > 0.005) out.push(gap(space));
    if (block.kind === "head") {
      const head = lessonHead(lesson, shownLesson, st);
      out.push(head.xml);
      cursor = block.y + head.h;
      continue;
    }
    const section = lesson.sections[block.section];
    if (block.kind === "section") {
      const head = sectionHead(section, st, block.continued);
      out.push(head.xml);
      cursor = block.y + head.h;
      continue;
    }
    // A row of cards: one table row that cannot split, every card pinned to the row's planned height.
    const w = section.columns === 2 ? BOOKLET_WIDTHS.half : BOOKLET_WIDTHS.full;
    const grid: number[] = [];
    const cells: string[] = [];
    block.cards.forEach((c, k) => {
      if (k) {
        grid.push(A4.columnGap + CARD_RULE);
        cells.push(cell(gap(END_MM), { width: A4.columnGap + CARD_RULE }));
      }
      ctx.where = { lesson: p.lesson, section: block.section + 1, question: c.number ?? undefined, page: p.pageNo };
      grid.push(w - CARD_RULE);
      cells.push(cardCell(section.cards[c.index], c.number, w, ctx, p.extra));
    });
    out.push(table(grid, [row(cells, { mm: block.h - 2 * CARD_RULE }, true)]));
    cursor = block.y + block.h;
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
  out.push(para(runs("Contents", { bold: true, color: st.navy, sizeMm: A4.heading }), { line: lh(A4.heading) }), gap(1), ruleTable(W, 0.5, st.navy), gap(2));
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
  out.push(textPara("Unit introduction", A4.lessonTitle, { color: st.navy, bold: true }));
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
        para(runs(title, { bold: true, color: st.navy }), {}) +
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
        const h = Math.max(lines(k.meaning, S.body, W - ww - 4.8), lines(k.word, S.body, ww - 4.8, "bold")) * lh(S.body) + 2.6;
        return row(
          [
            cell(gap(1.3) + para(runs(k.word, { bold: true, color: st.navy })), { width: ww, borders, margin }),
            cell(gap(1.3) + para(runs(k.meaning)), { width: W - ww, borders, margin }),
          ],
          { mm: h - line.width * (i === intro.keywords.length - 1 ? 2 : 1) },
          true,
        );
      }),
    ];
    out.push(table([ww, W - ww], rows));
  }
  return out.join("");
}

// ---------------------------------------------------------------- footer and package

function footerPart(label: string, st: HouseStyle, empty: boolean): string {
  const o = { color: st.muted, sizeMm: A4.small };
  const content = empty
    ? ""
    : table(
        [W],
        [
          row(
            [
              cell(
                gap(FOOT_TEXT_TOP - A4.footerRule) +
                  para(runs(label, o) + tab(o) + run("Page ", o) + `<w:fldSimple w:instr=" PAGE ">${run("1", o)}</w:fldSimple>`, { line: lh(A4.small), tabs: [{ pos: W, align: "right" }] }),
                { width: W, borders: { top: { color: st.rule, width: 0.3 } } },
              ),
            ],
            { mm: FOOT_ROW, exact: true },
          ),
        ],
      );
  return `${XML_HEAD}<w:ftr ${WORD_NAMESPACES}>${content}${gap(END_MM)}</w:ftr>`;
}

const pageOpen = (first: boolean) => para("", { line: END_MM, markMm: END_MM, pageBreakBefore: !first });

/** The Word file for one view of a booklet, or of one lesson printed on its own. */
export async function writeBookletDocx(booklet: Booklet, options: BookletDocxOptions): Promise<RenderedBookletDocx> {
  const view = options.view ?? "pupil";
  const st = styles.mathsdock;
  const doc = booklet.document;
  const numbering = options.numbering;
  // The SVG layout's own checks come first: Word output never hides a problem the pages have.
  const rendered = renderBooklet(booklet, { view, numbering });
  const plan = planBooklet(booklet, { view, numbering });
  const ctx: Ctx = { st, view, diagrams: 0, issues: [], where: { lesson: 0 }, media: [], rels: [], pictures: [], compactTables: true };

  const pages: string[] = [];
  if (!numbering) {
    pages.push(cover(doc, plan.contents, st));
    if (doc.intro) pages.push(introPage(doc, doc.intro, st));
  }
  for (const p of plan.pages) pages.push(lessonPage(doc, p, ctx, numbering?.lessonOffset ?? 0));
  const body = pages.map((xml, i) => pageOpen(i === 0) + xml).join("");

  const label = fitLine([doc.code, doc.title].filter((s) => s.trim()).join(" · "), A4.small, W - 30);
  const parts: ExtraPart[] = [{ name: "footer1.xml", id: "rIdFooter1", relType: "footer", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml", xml: footerPart(label, st, false) }];
  // The cover has no footer: the whole booklet's first page uses an empty one.
  if (!numbering) parts.push({ name: "footer2.xml", id: "rIdFooter2", relType: "footer", contentType: parts[0].contentType, xml: footerPart(label, st, true) });
  const firstPage = numbering ? plan.pages[0].pageNo + numbering.pageOffset : 1;
  const P = A4.page;
  const sect =
    `<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter1"/>${numbering ? "" : `<w:footerReference w:type="first" r:id="rIdFooter2"/>`}` +
    `<w:pgSz w:w="${tw(P.width)}" w:h="${tw(P.height)}"/>` +
    `<w:pgMar w:top="${tw(A4.top - END_MM)}" w:right="${tw(A4.marginX)}" w:bottom="${tw(P.height - A4.bottom - WORD_FOOT_MM)}" w:left="${tw(A4.marginX)}" w:header="0" w:footer="${tw(FOOTER_DISTANCE)}" w:gutter="0"/>` +
    `<w:pgNumType w:start="${firstPage}"/><w:cols w:space="0"/>${numbering ? "" : "<w:titlePg/>"}<w:docGrid w:linePitch="360"/></w:sectPr>`;

  const issues = [...rendered.issues];
  for (const i of ctx.issues) if (!issues.some((j) => j.message === i.message && j.lesson === i.lesson && j.section === i.section && j.question === i.question)) issues.push(i);
  const lessonNo = numbering ? ` lesson ${numbering.lessonOffset + 1}` : "";
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

/** The booklet's Word file name: the PDF's name ending .docx. */
export const bookletDocxName = (pdfName: string) => pdfName.replace(/\.pdf$/, ".docx");
