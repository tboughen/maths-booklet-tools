import { WORKED_WIDTH_MM, type WorkedNote } from "../../packages/envelope-core/src/worked";

/** The undo step name for a worked-note change (U8). */
export const WORKED_STEP = "change worked notes";

/** `envelope` with its worked notes replaced; an empty list removes the field from the file. */
export function withWorkedNotes<T extends object>(envelope: T, notes: readonly WorkedNote[]): T {
  const rest = { ...envelope } as T & { worked?: WorkedNote[] };
  delete rest.worked;
  return notes.length ? { ...rest, worked: notes.map((n) => ({ ...n })) } : rest;
}

export type Draft = { text: string; x: string; y: string; width: string; leader: boolean; lx: string; ly: string };
export const draftOf = (n: WorkedNote): Draft => ({
  text: n.text,
  x: String(n.x),
  y: String(n.y),
  width: String(n.widthMm ?? WORKED_WIDTH_MM),
  leader: !!n.leader,
  lx: String(n.leader?.x ?? n.x),
  ly: String(n.leader?.y ?? n.y),
});
const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

/** The drafts as notes, or the first field problem in words. */
export function notesFromDrafts(drafts: readonly Draft[]): { notes: WorkedNote[]; issue?: string } {
  const notes: WorkedNote[] = [];
  for (const [i, d] of drafts.entries()) {
    const name = `Worked note ${i + 1}`;
    const text = d.text.replace(/\s+/g, " ").trim();
    if (!text) return { notes, issue: `${name} has no text. Type the guidance or remove the note.` };
    const [x, y, width, lx, ly] = [d.x, d.y, d.width, d.lx, d.ly].map(num);
    if (!(x >= 0) || !(y >= 0)) return { notes, issue: `${name} needs a position of 0 mm or more across and down.` };
    if (!(width >= 10 && width <= 200)) return { notes, issue: `${name}'s width must be between 10 and 200 mm.` };
    if (d.leader && (!(lx >= 0) || !(ly >= 0))) return { notes, issue: `${name}'s leader needs an end point of 0 mm or more across and down.` };
    notes.push({ text, x, y, ...(width !== WORKED_WIDTH_MM ? { widthMm: width } : {}), ...(d.leader ? { leader: { x: lx, y: ly } } : {}) });
  }
  return { notes };
}

