/**
 * One naming rule for every download (improvement item U33):
 * mathsdock-<tool>-<short content>-<date>.<ext>, for example mathsdock-triangle-1ma1-jun-2018-1h-q4-2026-11-14.png.
 * The short content is the resource's title when it has one, otherwise its source question; it is left out when
 * there is neither. Today only expanding-factorising, triangle and bar-model documents carry a source question;
 * the resource title every tool will save (U34) arrives with the shared envelope rework and is read here.
 * Teacher copies add "answers". File contents never change.
 */
import type { ToolId } from "../site/routes";

const slug = (text: string, max = 40) =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");

/** Local calendar date, so a file saved in a lesson carries that day's date. */
export const fileDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** The short content for a saved resource: its title, else its source question id. */
export function contentHint(resource: unknown): string {
  const doc = (resource as { document?: Record<string, unknown> } | null)?.document;
  const pick = [doc?.title, doc?.sourceId].find((value) => typeof value === "string" && value.trim());
  return typeof pick === "string" ? slug(pick) : "";
}

export function downloadName(
  tool: ToolId,
  extension: "svg" | "png" | "json" | "pdf" | "docx",
  options: { resource?: unknown; content?: string; answers?: boolean; recovery?: boolean; date?: Date } = {},
): string {
  const content = options.content !== undefined ? slug(options.content) : contentHint(options.resource);
  const parts = ["mathsdock", tool, content, options.answers ? "answers" : "", options.recovery ? "recovery" : "", fileDate(options.date)];
  return `${parts.filter(Boolean).join("-")}.${extension}`;
}
