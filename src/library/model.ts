/**
 * The Resource library list (docs/content/RESOURCE-LIBRARY.md): every booklet, A3 worksheet,
 * starter and skill sheet we have made, at its newest version, by year and unit. The list and its
 * files are served by the site Worker behind staff sign-in; scripts/library/publish.mjs writes them.
 */
import { siteBase } from "../site/routes";

export type ResourceType = "unit-booklet" | "lesson-booklet" | "a3-worksheet" | "revision-lesson" | "starter" | "skill-sheet";
export type LibraryFile = { role: "pupil" | "answers" | "teacher-notes"; format: "pdf" | "docx"; name: string; bytes: number; href: string };
export type Resource = { id: string; year: number; unit: string; lesson?: string; title: string; type: ResourceType; status: "ready" | "waiting"; updated: string; files: LibraryFile[] };
export type LibraryUnit = { code: string; title: string };
export type LibraryYear = { year: number; sections: { name: string; units: LibraryUnit[] }[] };
export type Library = { schema: "mathsdock-library-served/1"; published: string; years: LibraryYear[]; resources: Resource[] };

export const typeNames: Record<ResourceType, string> = {
  "unit-booklet": "Unit booklet",
  "lesson-booklet": "Lesson booklet",
  "a3-worksheet": "A3 worksheet",
  "revision-lesson": "Revision lesson",
  starter: "Silent starter",
  "skill-sheet": "Skill sheet",
};
/** The dots on the Map: one colour each for booklets, A3 worksheets and the rest. */
export type Shelf = "booklets" | "worksheets" | "other";
export const shelfOf = (type: ResourceType): Shelf =>
  type === "unit-booklet" || type === "lesson-booklet" || type === "revision-lesson" ? "booklets" : type === "a3-worksheet" ? "worksheets" : "other";

const roleNames = { pupil: "Pupil", answers: "Answers", "teacher-notes": "Teacher notes" } as const;
export const fileLabel = (file: LibraryFile) => `${roleNames[file.role]} ${file.format === "pdf" ? "PDF" : "Word"}`;
export const fileHref = (file: LibraryFile) => siteBase() + file.href;

export async function loadLibrary(fetcher: typeof fetch = fetch): Promise<Library> {
  const response = await fetcher(`${siteBase()}library-data/library.json`, { cache: "no-cache" });
  if (!response.ok) throw new Error(response.status === 403 ? "Sign in again to see the library." : "The library could not be loaded. Try again in a minute.");
  const list = (await response.json()) as Library;
  if (list?.schema !== "mathsdock-library-served/1" || !Array.isArray(list.resources) || !Array.isArray(list.years) || !list.years.length) throw new Error("The library list is in a format this page does not know.");
  return list;
}

/** A7.3 before A7.10, and A7.11 before A7.11b. */
export const byLesson = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

export function unitOf(list: Library, year: number, code: string): LibraryUnit | undefined {
  return list.years.find((y) => y.year === year)?.sections.flatMap((s) => s.units).find((u) => u.code === code);
}
/** A scheme unit shows its code (A7); the extra shelves (starters, mock revision) show their name. */
export const isSchemeUnit = (code: string) => /^(A|NP|SP|GM)\d+$/.test(code);
export const unitLabel = (unit: LibraryUnit) => (isSchemeUnit(unit.code) ? unit.code : unit.title);
export const resourcesFor = (list: Library, year: number, unit: string) => list.resources.filter((r) => r.year === year && r.unit === unit);

/** A unit's resources in rows: the whole-unit ones first, then each lesson in order. */
export function lessonRows(resources: Resource[]) {
  const rows = new Map<string, Resource[]>();
  const order: ResourceType[] = ["unit-booklet", "lesson-booklet", "a3-worksheet", "revision-lesson", "starter", "skill-sheet"];
  const sorted = [...resources].sort((a, b) => (a.lesson ? 1 : 0) - (b.lesson ? 1 : 0) || byLesson(a.lesson ?? "", b.lesson ?? "") || order.indexOf(a.type) - order.indexOf(b.type) || byLesson(a.title, b.title));
  for (const r of sorted) {
    const key = r.lesson ?? (r.type === "unit-booklet" ? "" : r.id);
    rows.set(key, [...(rows.get(key) ?? []), r]);
  }
  return [...rows.entries()].map(([lesson, items]) => ({ lesson, title: items[0].type === "unit-booklet" && !lesson ? "Whole unit" : items[0].title, items }));
}

const normal = (text: string) => text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
/** Every resource whose code, title, unit, type or year has every word of the search. */
export function searchLibrary(list: Library, query: string): Resource[] {
  const words = normal(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return list.resources.filter((r) => {
    const unit = unitOf(list, r.year, r.unit);
    const text = normal(`${r.lesson ?? ""} ${r.unit} ${unit?.title ?? ""} ${r.title} ${typeNames[r.type]} year ${r.year} y${r.year} ${r.status === "waiting" ? "waiting" : "ready"}`);
    return words.every((w) => text.includes(w));
  }).sort((a, b) => a.year - b.year || byLesson(a.lesson ?? a.unit, b.lesson ?? b.unit) || byLesson(a.type, b.type));
}

export type View = "shelves" | "map";
export type LibraryState = { year: number; unit?: string; view: View; q: string };
/** The page's state from its address: `?year=9&unit=A7`, `?view=map`, `?q=gradient`. */
export function readState(search: string, fallbackYear = 7): LibraryState {
  const p = new URLSearchParams(search);
  const year = Number(p.get("year"));
  return { year: [7, 8, 9, 10, 11].includes(year) ? year : fallbackYear, unit: p.get("unit") || undefined, view: p.get("view") === "map" ? "map" : "shelves", q: p.get("q") ?? "" };
}
export function writeState(state: LibraryState): string {
  const p = new URLSearchParams();
  p.set("year", String(state.year));
  if (state.unit) p.set("unit", state.unit);
  if (state.view === "map") p.set("view", "map");
  if (state.q) p.set("q", state.q);
  return `?${p}`;
}
