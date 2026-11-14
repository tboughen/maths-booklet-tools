/**
 * Rendered-page visual check (W31). After a worksheet or booklet PDF is written, its text is read
 * back with pdf.js, which shows where each run of text actually landed in the file, with the
 * embedded fonts' real glyph widths. Each run is then checked against the page's trim and against
 * the boxes the page SVG draws: every question card's frame and every diagram's box.
 *
 * - Clipping: text closer to the paper's edge than printers can print.
 * - Collision: text that crosses a card's frame or a diagram's box instead of sitting wholly inside
 *   or wholly outside it, for example a long word running out of its card, a diagram label cut off
 *   at its edge, or question text running into a diagram.
 *
 * This automates the PRODUCE step's "inspect the final page at its intended print size and zoom
 * in" for the faults a teacher would otherwise only see on paper. The layout model already plans
 * every box; this check confirms the written file matches it.
 */

const MM = 72 / 25.4;
/** Printers leave about this much unprinted at each edge of the paper. */
export const SAFE_EDGE_MM = 5;
/** How far a glyph box may cross a frame before it counts (glyph boxes are approximate). */
const SLACK_MM = 0.35;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Frame extends Box {
  kind: "card" | "diagram";
  /** The diagram's accessible name, for messages. */
  label?: string;
}
export interface TextRun extends Box {
  text: string;
}

const attr = (tag: string, name: string) => {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? m[1] : undefined;
};
const num = (tag: string, name: string, fallback = 0) => {
  const v = Number(attr(tag, name));
  return Number.isFinite(v) ? v : fallback;
};

/**
 * The card frames and diagram boxes a page SVG draws, in millimetres from the page's top-left
 * corner. Pages use millimetre user units and only translate() transforms.
 */
export function pageFrames(svg: string): Frame[] {
  const frames: Frame[] = [];
  const stack: { x: number; y: number; nested: boolean }[] = [];
  let x = 0,
    y = 0,
    depth = 0;
  const tags = svg.matchAll(/<(\/?)(svg|g|rect)\b([^>]*?)(\/?)>/g);
  let root = true;
  for (const [, close, name, rest, self] of tags) {
    const tag = ` ${rest}`;
    if (close) {
      const top = stack.pop();
      if (top) ({ x, y } = top);
      if (top?.nested) depth--;
      continue;
    }
    if (name === "svg") {
      if (root) {
        root = false;
        if (!self) stack.push({ x, y, nested: false });
        continue;
      }
      if (depth === 0)
        frames.push({ kind: "diagram", x: x + num(tag, "x"), y: y + num(tag, "y"), width: num(tag, "width"), height: num(tag, "height"), label: attr(tag, "aria-label") });
      if (!self) {
        stack.push({ x, y, nested: true });
        depth++;
      }
      continue;
    }
    if (depth > 0) {
      if (name === "g" && !self) stack.push({ x, y, nested: false });
      continue;
    }
    if (name === "g") {
      if (self) continue;
      stack.push({ x, y, nested: false });
      const t = attr(tag, "transform")?.match(/^translate\(\s*([-\d.]+)[\s,]+([-\d.]+)\s*\)$/);
      if (t) {
        x += Number(t[1]);
        y += Number(t[2]);
      }
      continue;
    }
    // A card's frame: the white rounded box with the house rule line.
    if (attr(tag, "rx") === "2" && attr(tag, "stroke-width") === "0.45") {
      const w = num(tag, "width"),
        h = num(tag, "height");
      frames.push({ kind: "card", x: x + num(tag, "x") - 0.15, y: y + num(tag, "y") - 0.15, width: w + 0.3, height: h + 0.3 });
    }
  }
  return frames;
}

/** pdf.js's getDocument, passed in so the website can use its worker build and Node the legacy one. */
export type GetDocument = (src: { data: Uint8Array; disableFontFace?: boolean; useSystemFonts?: boolean; verbosity?: number }) => {
  promise: Promise<{
    numPages: number;
    getPage(n: number): Promise<{
      getViewport(o: { scale: number }): { width: number; height: number };
      getTextContent(): Promise<{ items: unknown[] }>;
    }>;
    destroy(): Promise<void>;
  }>;
};

/** Every run of printed text on each page of a PDF, in millimetres from the page's top-left corner. */
export async function pdfTextRuns(getDocument: GetDocument, bytes: Uint8Array): Promise<TextRun[][]> {
  const doc = await getDocument({ data: bytes.slice(), disableFontFace: true, useSystemFonts: false, verbosity: 0 }).promise;
  try {
    const pages: TextRun[][] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const height = page.getViewport({ scale: 1 }).height;
      const runs: TextRun[] = [];
      for (const raw of (await page.getTextContent()).items) {
        const it = raw as { str?: string; transform?: number[]; width?: number };
        if (!it.str?.trim() || !it.transform || !it.width) continue;
        const [a, b, c, d, e, f] = it.transform;
        // Rotated text (axis titles) belongs to a diagram; its box is not axis-aligned.
        if (Math.abs(b) > 1e-6 || Math.abs(c) > 1e-6 || a <= 0) continue;
        const size = d / MM,
          baseline = (height - f) / MM;
        // Ascent and descent of the house fonts, as a share of the font size.
        runs.push({ text: it.str, x: e / MM, y: baseline - size * 0.76, width: it.width / MM, height: size * 0.98 });
      }
      pages.push(runs);
    }
    return pages;
  } finally {
    await doc.destroy();
  }
}

const overlap = (a: Box, b: Box) =>
  Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > SLACK_MM && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > SLACK_MM;
const inside = (a: Box, b: Box) =>
  a.x >= b.x - SLACK_MM && a.y >= b.y - SLACK_MM && a.x + a.width <= b.x + b.width + SLACK_MM && a.y + a.height <= b.y + b.height + SLACK_MM;
const r = (v: number) => Math.round(v * 10) / 10;
const quote = (s: string) => `"${s.length > 40 ? `${s.slice(0, 37)}…` : s}"`;

export interface PageProblem {
  /** 0-based page (a worksheet side or a booklet page). */
  page: number;
  /** Where the text starts, in millimetres from the page's top-left corner. */
  x: number;
  y: number;
  message: string;
}

/**
 * Specific problems on the written pages, worded for a teacher, in page order. Empty when every
 * run of text sits inside the printable area and wholly inside or outside each card and diagram.
 */
export function pageProblems(pages: readonly string[], runs: readonly TextRun[][]): PageProblem[] {
  const problems: PageProblem[] = [];
  pages.forEach((svg, page) => {
    const size = svg.match(/<svg\b[^>]*\bwidth="([\d.]+)mm"[^>]*\bheight="([\d.]+)mm"/);
    if (!size) return;
    const W = Number(size[1]),
      H = Number(size[2]);
    const frames = pageFrames(svg);
    const seen = new Set<string>();
    for (const run of runs[page] ?? []) {
      const add = (message: string) => {
        if (seen.has(message)) return;
        seen.add(message);
        problems.push({ page, x: r(run.x), y: r(run.y), message });
      };
      const edge = Math.min(run.x, run.y, W - run.x - run.width, H - run.y - run.height);
      if (edge < SAFE_EDGE_MM - SLACK_MM)
        add(
          edge < 0
            ? `The text ${quote(run.text)} runs ${r(-edge)} mm off the page. Move or shorten it.`
            : `The text ${quote(run.text)} is ${r(edge)} mm from the edge of the paper; printers leave about ${SAFE_EDGE_MM} mm unprinted, so it may be cut off.`,
        );
      // One message per run: the first frame it crosses, usually its own card.
      const frame = frames.find((f) => overlap(run, f) && !inside(run, f));
      if (frame)
        add(
          frame.kind === "card"
            ? `The text ${quote(run.text)} crosses the edge of its question card. Shorten it or break it onto another line.`
            : `The text ${quote(run.text)} crosses the edge of ${frame.label ? `the diagram "${frame.label}"` : "a diagram"}. Move the text or the diagram so they do not overlap.`,
        );
    }
  });
  return problems;
}

/** The rendered-page check on a written PDF: its problems, worded for a teacher. */
export async function checkRenderedPages(getDocument: GetDocument, bytes: Uint8Array, pages: readonly string[]): Promise<PageProblem[]> {
  return pageProblems(pages, await pdfTextRuns(getDocument, bytes));
}
