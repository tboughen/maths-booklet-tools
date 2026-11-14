import { artworkSizeMm, withWorked, workedIssues, workedOf } from "../../packages/envelope-core/src/worked";

/**
 * Worked-solution notes (U116) in the website editors. They print only on the answers copy, so
 * every export passes whether it is making that copy; the pupil copy is never touched.
 */
export const answerArt = (svg: string, envelope: unknown, answers: boolean) => (answers ? withWorked(svg, workedOf(envelope)) : svg);

/**
 * For the on-screen preview: the notes when they fit, else the plain artwork (the issue is shown
 * beside it). The editors' controls sit over the artwork, so it keeps its size on screen and notes
 * in the margin overflow it; the printed answers copy grows to hold them instead.
 */
export function previewArt(svg: string, envelope: unknown, answers: boolean) {
  try {
    return answers ? withWorked(svg, workedOf(envelope), { inPlace: true }) : svg;
  } catch {
    return svg;
  }
}

/** The first problem with the notes on this answers artwork, or "" when they fit (or there are none). */
export function workedIssue(answerSvg: string, envelope: unknown): string {
  const notes = workedOf(envelope);
  return notes.length ? (workedIssues(notes, artworkSizeMm(answerSvg))[0] ?? "") : "";
}

/** The answers artwork's printed size in mm, for the dialog's live fit check. */
export const answerSize = (answerSvg: string) => artworkSizeMm(answerSvg);
