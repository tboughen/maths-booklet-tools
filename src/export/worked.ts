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

/**
 * The printed size (cm) of one copy for PNG and Word: its layout size, or, when worked notes sit in
 * the margin and have grown the answers copy's page, that page's size, so the artwork stays at
 * actual size instead of being squeezed into the layout box.
 */
export function copySizeCm(svg: string, widthCm: number, heightCm: number) {
  if (!svg.includes('data-layer="worked"')) return { width: widthCm, height: heightCm };
  const s = artworkSizeMm(svg);
  const grown = s.width > 0 && s.height > 0 && (Math.abs(s.width / 10 - widthCm) > 0.001 || Math.abs(s.height / 10 - heightCm) > 0.001);
  return grown ? { width: s.width / 10, height: s.height / 10 } : { width: widthCm, height: heightCm };
}
