import { boldLines } from "../../envelope-core/src/house-style";
import { richText, runWidth, type Run } from "./grouped";
import { CHART_ANSWER_COLOUR, FONT, MARGIN, esc, n, readNumber, stemLeaves, stemleafOf } from "./shared";
import type { Envelope, Target } from "./index";

/**
 * Stem-and-leaf diagrams as Edexcel prints them (measured on November 2017 1F Q10, June 2018 3F
 * Q14 and June 2025 1F Q18): 1 cm rows with 0.5 pt rules between them, a 1 cm stem column left
 * of one vertical line, leaves 5.5 mm apart, and a 0.5 pt key box to the right. Leaves print as
 * typed, never sorted. A hidden stem or row of leaves leaves its space for pupils; answers copies
 * print them in pink. Millimetres.
 */
const RULE_W = 0.5 * (25.4 / 72);
const ROW = 10;
const STEM_MIN = 10;
const PITCH = 5.5;
const FIRST = 5.3;
const KEY_GAP = 10;
const KEY_H = 10;
const KEY_BLANK = 50;
const BASE = FONT * 0.35;
const plain = (t: string): Run[] => [{ t, italic: false }];

export function stemleafLayout(e: Envelope) {
  const s = stemleafOf(e.document),
    issues: string[] = [],
    notes: string[] = [];
  const stemW = Math.max(STEM_MIN, Math.ceil(Math.max(0, ...s.rows.map((r) => runWidth(plain(r.stem.trim())))) + 4));
  const x0 = MARGIN,
    y0 = MARGIN,
    lineX = x0 + stemW,
    right = lineX + s.leafMm;
  const targets: Target[] = [];
  const rows = s.rows.map((r, i) => {
    const where = `Row ${i + 1}`;
    const leaves = stemLeaves(r.leaves);
    if (r.stem.trim() && readNumber(r.stem) === null) issues.push(`${where}: enter a number for the stem, or leave it blank.`);
    if (leaves === null) issues.push(`${where}: each leaf is one digit, 0 to 9.`);
    else if (leaves.length && FIRST + (leaves.length - 1) * PITCH + 2.5 > s.leafMm)
      issues.push(`${where}: ${leaves.length} leaves do not fit in a ${s.leafMm} mm leaves column. Make the column wider.`);
    else if (leaves.some((l, j) => j > 0 && l < leaves[j - 1])) notes.push(`${where}: the leaves are not in order; they print as typed.`);
    const top = y0 + i * ROW;
    targets.push({ series: 0, category: i, x: x0, y: top, width: right - x0, height: ROW });
    return {
      top,
      mid: top + ROW / 2,
      stem: r.stem.trim(),
      leaves: leaves ?? [],
      stemDrawn: r.stemShow === "show",
      leavesDrawn: r.leavesShow === "show",
      stemPink: STEM_REVEALED.has(r),
      leavesPink: LEAVES_REVEALED.has(r),
    };
  });
  const stems = s.rows.map((r) => readNumber(r.stem)).filter((v): v is number => v !== null);
  if (stems.some((v, j) => j > 0 && v <= stems[j - 1])) notes.push("The stems do not go up in order; they print as typed.");
  const k = s.key;
  const keyIntro = runWidth(plain("Key:")) + 2;
  // A hidden key's box is as wide as its answer, so both copies are the same size.
  const keyBody = runWidth(plain(k.stem.trim())) + 3 + runWidth(plain(`${k.leaf.trim()} represents ${k.represents.trim()}`));
  if (k.show === "show" && !(k.stem.trim() && k.leaf.trim() && k.represents.trim())) issues.push("Key: fill in the stem, the leaf and what they represent, or leave the key empty for pupils.");
  const keyW = k.show === "none" ? 0 : Math.max(KEY_BLANK, Math.ceil(keyIntro + keyBody + 6));
  const H = s.rows.length * ROW;
  const key = k.show === "none" ? null : { x: right + KEY_GAP, y: y0 + H / 2 - KEY_H / 2, width: keyW, height: KEY_H };
  const width = Math.ceil(((key ? key.x + key.width : right) + MARGIN) * 10) / 10,
    height = Math.ceil((y0 + Math.max(H, KEY_H) + MARGIN) * 10) / 10;
  if (width > 180) issues.push("The stem-and-leaf diagram is wider than 18 cm. Make the leaves column narrower.");
  return { settings: s, width, height, x0, y0, lineX, right, stemW, rows, key, keyIntro, targets, issues, notes };
}

/** Rows and keys an answer view shows only because they were saved hidden. */
const STEM_REVEALED = new WeakSet<object>();
const LEAVES_REVEALED = new WeakSet<object>();
const KEY_REVEALED = new WeakSet<object>();
export const markStemRevealed = (r: object) => void STEM_REVEALED.add(r);
export const markLeavesRevealed = (r: object) => void LEAVES_REVEALED.add(r);
export const markKeyRevealed = (k: object) => void KEY_REVEALED.add(k);

export function stemleafSvg(e: Envelope): string {
  const g = stemleafLayout(e),
    s = g.settings,
    out: string[] = [];
  const H = g.rows.length * ROW;
  const rule = (d: string) => out.push(`<path d="${d}" stroke="black" stroke-width="${n(RULE_W)}" fill="none"/>`);
  rule(`M${n(g.lineX)},${n(g.y0)}V${n(g.y0 + H)}`);
  for (let i = 1; i < g.rows.length; i++) rule(`M${n(g.x0)},${n(g.y0 + i * ROW)}H${n(g.right)}`);
  const ink = (pink: boolean) => (pink ? CHART_ANSWER_COLOUR : "black");
  for (const r of g.rows) {
    if (r.stemDrawn && r.stem) out.push(richText(plain(r.stem), g.x0 + g.stemW / 2, r.mid + BASE, "middle", ink(r.stemPink)));
    if (r.leavesDrawn) r.leaves.forEach((l, j) => out.push(richText(plain(l), g.lineX + FIRST + j * PITCH, r.mid + BASE, "middle", ink(r.leavesPink))));
  }
  if (g.key) {
    const k = s.key,
      kb = g.key,
      y = kb.y + kb.height / 2 + BASE;
    rule(`M${n(kb.x)},${n(kb.y)}h${n(kb.width)}v${n(kb.height)}h${n(-kb.width)}Z`);
    out.push(richText(plain("Key:"), kb.x + 3, y, "start"));
    const drawn = k.show === "show" || KEY_REVEALED.has(k);
    if (drawn) {
      const pink = ink(KEY_REVEALED.has(k));
      let x = kb.x + 3 + g.keyIntro;
      const stem = k.stem.trim();
      out.push(richText(plain(stem), x, y, "start", pink));
      x += runWidth(plain(stem)) + 1.5;
      out.push(`<path d="M${n(x)},${n(kb.y + 2.5)}V${n(kb.y + kb.height - 2.5)}" stroke="${pink}" stroke-width="${n(RULE_W)}" fill="none"/>`);
      x += 1.5;
      out.push(richText(plain(`${k.leaf.trim()} represents ${k.represents.trim()}`), x, y, "start", pink));
    }
  }
  const label = "Stem-and-leaf diagram";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(g.width)}mm" height="${n(g.height)}mm" viewBox="0 0 ${n(g.width)} ${n(g.height)}" role="img" aria-label="${esc(label)}"><rect width="${n(g.width)}" height="${n(g.height)}" fill="white"/>${boldLines(out.join(""), e.document.lines)}</svg>`;
}
