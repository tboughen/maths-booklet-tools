/**
 * Worked-solution notes (improvement item U116): short dark-pink guidance a teacher places beside
 * the black maths of any diagram. They follow the house worked-solution rulebook: the guidance sits
 * near the maths it explains, with no leader by default; a straight leader only when one is needed;
 * never an L-shaped leader. Notes print only on the answers (worked) copy, never on the pupil copy,
 * and they never change a diagram's printed size: each note must fit inside the artwork.
 *
 * Every family's envelope carries the same optional top-level `worked` list (spread from
 * aboutShape), so the website editors, worksheets, booklets and the connector all read one shape.
 * Positions are millimetres from the artwork's top-left corner, at its printed size.
 */
import { z } from "zod";
import { glyphAdvance } from "../../ratio-table-core/src/font-metrics";
import { ANSWER_COLOUR } from "./answer-state";

export const WORKED_MAX = 12;
export const WORKED_TEXT_MAX = 160;
/** Notes print at the house body size. */
export const WORKED_PT = 11;
export const WORKED_WIDTH_MM = 60;
const FONT_MM = (WORKED_PT * 25.4) / 72;
const LINE_MM = FONT_MM * 1.2;
const ASCENT = 0.78;
/** Space left between a note's box and the start of its leader. */
const GAP_MM = 0.8;
const TOLERANCE = 0.1;

const mm = (what: string) => z.number().finite().min(0).max(500).describe(what);
export const workedNoteSchema = z
  .object({
    text: z
      .string()
      .min(1)
      .max(WORKED_TEXT_MAX)
      .refine((t) => t.trim() === t && ![...t].some((c) => c.charCodeAt(0) < 32), "Use one line of text without leading or trailing spaces.")
      .describe("Dark-pink guidance for the worked copy, such as \"Multiply both by 3\". Wraps to widthMm."),
    x: mm("Left edge of the note, in mm from the artwork's left edge."),
    y: mm("Top of the note, in mm from the artwork's top edge."),
    widthMm: z.number().finite().min(10).max(200).optional().describe(`Wrapping width in mm (default ${WORKED_WIDTH_MM}).`),
    leader: z
      .object({ x: mm("Leader end, mm from the left edge."), y: mm("Leader end, mm from the top edge.") })
      .strict()
      .optional()
      .describe("Only when the note cannot sit right beside its maths: one straight line from the note to this point."),
  })
  .strict();
export type WorkedNote = z.infer<typeof workedNoteSchema>;
export const workedSchema = z
  .array(workedNoteSchema)
  .min(1)
  .max(WORKED_MAX)
  .optional()
  .describe("Worked-solution notes printed in dark pink on the answers copy only. Positions are mm from the artwork's top-left corner.");

/** The worked notes of a saved envelope, if any. */
export const workedOf = (envelope: unknown): WorkedNote[] => ((envelope ?? {}) as { worked?: WorkedNote[] }).worked ?? [];

const width = (s: string) => [...s].reduce((n, c) => n + glyphAdvance(c), 0) * FONT_MM;

/** The note's lines, wrapped at word boundaries to its width (a single long word stays whole). */
export function wrapNote(note: WorkedNote): string[] {
  const max = note.widthMm ?? WORKED_WIDTH_MM;
  const lines: string[] = [];
  let line = "";
  for (const word of note.text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && width(next) > max) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export interface NoteBox {
  x: number;
  y: number;
  width: number;
  height: number;
  lines: string[];
}
export function noteBox(note: WorkedNote): NoteBox {
  const lines = wrapNote(note);
  return { x: note.x, y: note.y, width: Math.max(...lines.map(width)), height: lines.length * LINE_MM, lines };
}

/** Where a straight leader starts: the point of the note's box nearest its end, moved off the text. */
function leaderStart(box: NoteBox, end: { x: number; y: number }) {
  const cx = Math.min(Math.max(end.x, box.x), box.x + box.width),
    cy = Math.min(Math.max(end.y, box.y), box.y + box.height);
  const dx = end.x - cx,
    dy = end.y - cy,
    d = Math.hypot(dx, dy);
  return d === 0 ? { x: cx, y: cy, length: 0 } : { x: cx + (dx / d) * GAP_MM, y: cy + (dy / d) * GAP_MM, length: d - GAP_MM };
}

const round = (v: number) => Math.round(v * 10) / 10;

/**
 * Specific problems with the notes on artwork of this printed size, in the order a teacher would
 * fix them. Empty when every note fits inside the artwork, clear of the others.
 */
export function workedIssues(notes: readonly WorkedNote[], size: { width: number; height: number }): string[] {
  const issues: string[] = [];
  const boxes = notes.map(noteBox);
  boxes.forEach((b, i) => {
    const name = `Worked note ${i + 1}`;
    const right = b.x + b.width - size.width,
      bottom = b.y + b.height - size.height;
    if (right > TOLERANCE) issues.push(`${name} runs ${round(right)} mm past the right edge of the diagram (${round(size.width)} mm wide). Move it left or narrow its width.`);
    if (bottom > TOLERANCE) issues.push(`${name} runs ${round(bottom)} mm below the bottom of the diagram (${round(size.height)} mm tall). Move it up or shorten it.`);
    const end = notes[i].leader;
    if (end) {
      if (end.x > size.width + TOLERANCE || end.y > size.height + TOLERANCE) issues.push(`${name}'s leader ends outside the diagram. Point it at the maths it explains.`);
      else if (leaderStart(b, end).length < 1) issues.push(`${name}'s leader ends on the note itself. Remove the leader or point it at the maths.`);
    }
    for (let j = 0; j < i; j++) {
      const o = boxes[j];
      if (b.x < o.x + o.width - TOLERANCE && o.x < b.x + b.width - TOLERANCE && b.y < o.y + o.height - TOLERANCE && o.y < b.y + b.height - TOLERANCE)
        issues.push(`${name} overlaps worked note ${j + 1}. Move one of them.`);
    }
  });
  return issues;
}

/** Printed size of an SVG root in millimetres, and its viewBox. */
function frame(svg: string) {
  const tag = svg.match(/<svg\b[^>]*>/)?.[0] ?? "";
  const read = (name: string) => {
    const m = tag.match(new RegExp(`\\s${name}="([\\d.]+)(mm|cm|in|pt|px)?"`));
    if (!m) return NaN;
    const k = { mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, px: 25.4 / 96 }[(m[2] ?? "px") as "mm"];
    return Number(m[1]) * k;
  };
  const box = tag.match(/\sviewBox="([^"]+)"/)?.[1].trim().split(/[\s,]+/).map(Number);
  const w = read("width"),
    h = read("height");
  const vb = box && box.length === 4 && box.every(Number.isFinite) ? box : [0, 0, w, h];
  return { width: w, height: h, vb };
}

/** The printed size (mm) of an SVG, for checking notes against it. */
export const artworkSizeMm = (svg: string) => {
  const f = frame(svg);
  return { width: f.width, height: f.height };
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (v: number) => String(Math.round(v * 1e4) / 1e4);

/**
 * The artwork with its worked notes drawn on top in dark pink, as the last layer. With no notes the
 * SVG is returned unchanged. Notes that do not fit throw the first specific issue, so a copy never
 * prints guidance cut off at the edge.
 */
export function withWorked(svg: string, notes: readonly WorkedNote[]): string {
  if (!notes.length) return svg;
  const f = frame(svg);
  if (!(f.width > 0 && f.height > 0)) throw Error("The diagram did not report its printed size, so its worked notes cannot be placed.");
  const issues = workedIssues(notes, f);
  if (issues.length) throw Error(issues[0]);
  const sx = f.vb[2] / f.width,
    sy = f.vb[3] / f.height;
  const X = (mmX: number) => n(f.vb[0] + mmX * sx),
    Y = (mmY: number) => n(f.vb[1] + mmY * sy);
  const texts: string[] = [],
    leaders: string[] = [];
  for (const note of notes) {
    const b = noteBox(note);
    b.lines.forEach((line, i) =>
      texts.push(`<text x="${X(b.x)}" y="${Y(b.y + i * LINE_MM + (LINE_MM - FONT_MM) / 2 + ASCENT * FONT_MM)}">${esc(line)}</text>`),
    );
    if (note.leader) {
      const s = leaderStart(b, note.leader);
      leaders.push(`<line x1="${X(s.x)}" y1="${Y(s.y)}" x2="${X(note.leader.x)}" y2="${Y(note.leader.y)}"/>`);
    }
  }
  const drawn =
    `<g data-layer="worked" font-family="STIX Two Text,STIX Two Math,serif" font-size="${n(FONT_MM * sy)}">` +
    (leaders.length ? `<g fill="none" stroke="${ANSWER_COLOUR}" stroke-width="${n(0.35 * sx)}" stroke-linecap="round">${leaders.join("")}</g>` : "") +
    `<g fill="${ANSWER_COLOUR}">${texts.join("")}</g></g>`;
  const close = svg.lastIndexOf("</svg>");
  return `${svg.slice(0, close)}${drawn}${svg.slice(close)}`;
}
