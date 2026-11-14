import { aboutOf, type About } from "../../packages/envelope-core/src/about";

/** The undo step name for a title or note change (U8). */
export const TITLE_NOTE_STEP = "change title and note";

/** `envelope` with its title and note replaced by `about` (U34); blank values are left out. */
export function withAbout<T extends object>(envelope: T, about: About): T {
  const rest = { ...envelope } as T & About;
  delete rest.title;
  delete rest.note;
  return { ...rest, ...aboutOf(cleanAbout(about)) };
}

/** Trimmed, with blank values removed (the saved file never holds an empty title or note). */
export function cleanAbout(about: About): About {
  const title = about.title?.trim(),
    note = about.note?.trim();
  return { ...(title ? { title } : {}), ...(note ? { note } : {}) };
}
