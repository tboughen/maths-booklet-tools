/**
 * Teacher notes in Present (docs/tools/PRESENT-BOOKLETS.md): the NCETM chips and the Watch for / Ask boxes are printed
 * only in a booklet's answers copy. Present reads where they are from the answers PDF itself (its links, and the text
 * in the misconception band of the footer) and, on the pupil copy, shows those parts of the answers page on screen
 * only. Nothing is redrawn, so they look exactly as printed, and the pupil PDF and every download stay unchanged.
 */
import type { PDFDocumentProxy } from "pdfjs-dist";

const MM = 72 / 25.4;
/**
 * The misconception band in millimetres from the top of an A4 page, matching `MISCONCEPTION.top`/`h` and `A4.marginX`
 * in packages/resource-core/src/booklet-render.ts (teacherNotes.test.ts checks they still agree), with a little room.
 */
export const BAND = { top: 284.3 - 0.3, bottom: 284.3 + 8.7 + 0.3, left: 12 - 0.3, right: 210 - 12 + 0.3 } as const;

/** A rectangle in PDF points from the page's top-left corner. */
export type Box = { x: number; y: number; w: number; h: number };
export type SideNotes = { links: { url: string; box: Box; label?: string }[]; watch?: string; ask?: string; band?: Box };
type TextItem = { str: string; transform: number[] };

/** The part of the band left of the page number is Watch for, the part right of it is Ask. */
export function bandText(items: TextItem[], page: { width: number; height: number }) {
  const top = page.height - BAND.bottom * MM, bottom = page.height - BAND.top * MM;
  const left: string[] = [], right: string[] = [];
  for (const item of items) {
    const [x, y] = [item.transform[4], item.transform[5]];
    if (y < top || y > bottom || !item.str.trim() || /^Page \d+$/.test(item.str.trim())) continue;
    (x < page.width / 2 ? left : right).push(item.str);
  }
  const clean = (parts: string[]) => parts.join(" ").replace(/\s+/g, " ").trim();
  const watch = clean(left), ask = clean(right);
  if (!/^Watch for\b/i.test(watch)) return {};
  return { watch: watch.replace(/^Watch for:?\s*/i, ""), ask: ask.replace(/^Ask:?\s*/i, "") || undefined };
}

/** The notes on one side of the answers copy, or none for a side (or an older booklet) without any. */
export async function sideNotes(answers: PDFDocumentProxy, n: number): Promise<SideNotes> {
  const page = await answers.getPage(n);
  const view = page.getViewport({ scale: 1 });
  const size = { width: view.width, height: view.height };
  const links: SideNotes["links"] = [];
  for (const a of (await page.getAnnotations()) as { subtype?: string; url?: string; rect?: number[] }[]) {
    if (a.subtype !== "Link" || !a.url || !a.rect || !/^https?:/i.test(a.url)) continue;
    const [x1, y1, x2, y2] = a.rect;
    links.push({ url: a.url, box: { x: Math.min(x1, x2), y: size.height - Math.max(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) } });
  }
  const items = (await page.getTextContent()).items as TextItem[];
  // A chip's own words ("NCETM Explain  Gradient 4.2") name the link in the column.
  for (const link of links) {
    const inside = items.filter((t) => { const x = t.transform[4], y = size.height - t.transform[5]; return x >= link.box.x - 1 && x <= link.box.x + link.box.w && y >= link.box.y - 1 && y <= link.box.y + link.box.h + 2; });
    const label = inside.map((t) => t.str).join(" ").replace(/\s+/g, " ").trim();
    if (label) link.label = label;
  }
  const text = bandText(items, size);
  const band = text.watch ? { x: BAND.left * MM, y: BAND.top * MM, w: (BAND.right - BAND.left) * MM, h: (BAND.bottom - BAND.top) * MM } : undefined;
  return { links, ...text, band };
}

export const hasNotes = (notes?: SideNotes) => !!notes && (notes.links.length > 0 || !!notes.watch);
