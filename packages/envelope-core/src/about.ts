/**
 * A diagram's own title and note (U34): the teacher's name for it and a free note, saved in the
 * editable file beside the drawing. Neither is printed: the artwork, previews and print files are
 * the same with or without them. Every family's envelope carries the same two optional fields at
 * its top level, after `document`, so a file without them keeps its exact canonical text and hash.
 */
import { z } from "zod";

export const TITLE_MAX = 80;
export const NOTE_MAX = 600;

/** Spread into a family's envelope object schema, after `document`. */
export const aboutShape = {
  title: z.string().min(1).max(TITLE_MAX).optional().describe("The teacher's name for this diagram. Saved in the editable file; never printed."),
  note: z.string().min(1).max(NOTE_MAX).optional().describe("A free note about this diagram (source, class, intent). Saved in the editable file; never printed."),
};

export type About = { title?: string; note?: string };

/** The title and note of a saved envelope, to carry onto one rebuilt from it. */
export function aboutOf(envelope: unknown): About {
  const e = (envelope ?? {}) as About;
  return { ...(e.title !== undefined ? { title: e.title } : {}), ...(e.note !== undefined ? { note: e.note } : {}) };
}
