/**
 * The Resource library list (docs/content/RESOURCE-LIBRARY.md): every booklet and starter we have
 * made, by year and unit, with each unit's planned lessons, its versions (Main, Foundation, …) and
 * every replaced version kept in each resource's history. The list and its files are served by the
 * site Worker behind staff sign-in; scripts/library/publish.mjs writes them.
 */
import { siteBase } from "../site/routes";

export type ResourceType = "unit-booklet" | "lesson-booklet" | "revision-lesson" | "starter";
export type LibraryFile = { role: "pupil" | "answers"; format: "pdf" | "docx"; name: string; bytes: number; href: string };
export type Earlier = { updated: string; note?: string; files: LibraryFile[] };
export type Resource = {
  id: string; year: number; unit: string; lesson?: string; version: string; part?: string; note?: string;
  title: string; type: ResourceType; status: "ready" | "waiting"; updated: string; files: LibraryFile[]; history: Earlier[];
  /** Set when an editor ticked ✓ Checked on this version on the page (not in the published list). */
  checked?: Check;
};
export type Part = { name: string; from: string; to: string };
export type LibraryUnit = { code: string; title: string; lessons?: { code: string; title: string }[]; parts?: Part[] };
export type LibrarySection = { name: string; estimate?: boolean; units: LibraryUnit[] };
export type LibraryYear = { year: number; now?: string; sections: LibrarySection[] };
export type Library = { schema: "mathsdock-library-served/2"; published: string; years: LibraryYear[]; resources: Resource[] };

/**
 * An open feedback thread (scripts/cloudflare/library-feedback.mjs). A lesson of null is the whole unit,
 * unless `booklet` names a unit booklet (its part, or "Unit booklet"). `mine` marks comments the signed-in
 * person wrote, which they may delete.
 */
export type Comment = { id?: number; who: string; when: string; text: string; mine?: boolean };
export type Thread = { number: number; year: number; unit: string; version: string; lesson: string | null; booklet?: string | null; kind: "lesson" | "unit" | "booklet"; queued: boolean; agreed: boolean; opened: string; comments: Comment[] };
export const threadKey = (year: number, unit: string, version: string, lesson: string | null, booklet?: string | null) => `${year}|${unit}|${version}|${lesson ?? ""}|${booklet ?? ""}`;
export const threadMap = (threads: Thread[]) => new Map(threads.map((t) => [threadKey(t.year, t.unit, t.version, t.lesson, t.booklet), t]));
/** The name a unit booklet's feedback and checks go by. */
export const bookletName = (r: Resource) => r.part ?? "Unit booklet";

export const typeNames: Record<ResourceType, string> = {
  "unit-booklet": "Unit booklet",
  "lesson-booklet": "Lesson booklet",
  "revision-lesson": "Revision lesson",
  starter: "Silent starter",
};
const roleNames = { pupil: "Pupil", answers: "Answers" } as const;
export const fileLabel = (file: LibraryFile) => `${roleNames[file.role]} ${file.format === "pdf" ? "PDF" : "Word"}`;
export const fileHref = (file: LibraryFile) => siteBase() + file.href;

export async function loadLibrary(fetcher: typeof fetch = fetch): Promise<Library> {
  const response = await fetcher(`${siteBase()}library-data/library.json`, { cache: "no-cache" });
  if (!response.ok) throw new Error(response.status === 403 ? "Sign in again to see the library." : "The library could not be loaded. Try again in a minute.");
  let list = (await response.json()) as Library;
  // The list published before schema 2 still loads until the next publish: booklets only, Main version.
  if ((list?.schema as string) === "mathsdock-library-served/1" && Array.isArray(list.resources)) {
    list = { ...list, schema: "mathsdock-library-served/2", resources: list.resources.filter((r) => r.type in typeNames).map((r) => ({ ...r, version: "Main", history: [], files: r.files.filter((f) => f.role === "pupil" || f.role === "answers") })) };
  }
  if (list?.schema !== "mathsdock-library-served/2" || !Array.isArray(list.resources) || !Array.isArray(list.years) || !list.years.length) throw new Error("The library list is in a format this page does not know.");
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
/** The short name inside a ring: the code, or ST, MR and so on for the extra shelves. */
export const ringLabel = (unit: LibraryUnit) => (isSchemeUnit(unit.code) ? unit.code : ({ STARTERS: "ST", MOCK: "MR", REVIEW: "REV" } as Record<string, string>)[unit.code] ?? unit.code.slice(0, 3));
export const resourcesFor = (list: Library, year: number, unit: string) => list.resources.filter((r) => r.year === year && r.unit === unit);

/** Main first, then the other versions in the order they were added. */
export function versionsOf(list: Library, year: number, unit: string): string[] {
  return ["Main", ...new Set(resourcesFor(list, year, unit).map((r) => r.version).filter((v) => v !== "Main"))];
}

export type LessonState = "none" | "waiting" | "ready" | "feedback";
export type LessonRow = { code: string; title: string; resource?: Resource; state: LessonState; thread?: Thread };
/**
 * One row per lesson of one version: the planned lessons in order, with any made lesson the plan does
 * not name (A4.00 Unit start) in its place. Starters and booster booklets have no lesson code, so each
 * is a row of its own. Open feedback makes a row violet, whether the lesson is ready or not.
 */
export function lessonPlan(list: Library, year: number, code: string, version: string, threads = new Map<string, Thread>()): LessonRow[] {
  const unit = unitOf(list, year, code);
  const made = resourcesFor(list, year, code).filter((r) => r.version === version && r.type !== "unit-booklet");
  const rows = new Map<string, LessonRow>();
  for (const l of unit?.lessons ?? []) rows.set(l.code, { code: l.code, title: l.title, state: "none" });
  for (const r of made) {
    const key = r.lesson ?? r.id;
    rows.set(key, { code: r.lesson ?? "", title: rows.get(key)?.title ?? r.title, resource: r, state: r.status });
  }
  const ordered = [...rows.entries()].sort(([a, x], [b, y]) => (x.code && y.code ? byLesson(a, b) : x.code ? -1 : y.code ? 1 : byLesson(x.title, y.title))).map(([, row]) => row);
  for (const row of ordered) {
    const thread = row.code ? threads.get(threadKey(year, code, version, row.code)) : undefined;
    if (thread) Object.assign(row, { thread, state: "feedback" });
  }
  return ordered;
}
/** Where each part starts and ends among the rows, or null for a unit in one booklet. */
export function partRanges(unit: LibraryUnit | undefined, rows: LessonRow[]) {
  if (!unit?.parts?.length) return null;
  return unit.parts.map((p) => ({ ...p, start: rows.findIndex((r) => r.code === p.from), end: rows.findIndex((r) => r.code === p.to) })).filter((p) => p.start >= 0 && p.end >= p.start);
}
export const unitBooklets = (list: Library, year: number, unit: string, version: string) => resourcesFor(list, year, unit).filter((r) => r.type === "unit-booklet" && r.version === version);
export const countState = (rows: LessonRow[], state: LessonState) => rows.filter((r) => r.state === state).length;
/** "5 of 13 ready · 2 waiting", or "Nothing yet". */
export function summary(rows: LessonRow[]) {
  if (rows.every((r) => r.state === "none")) return "Nothing yet";
  const ready = rows.filter((r) => r.resource?.status === "ready").length, waiting = rows.filter((r) => r.resource?.status === "waiting").length;
  return [`${ready} of ${rows.length} ready`, waiting ? `${waiting} waiting` : ""].filter(Boolean).join(" · ");
}

const normal = (text: string) => text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
/** Every resource whose code, title, unit, type, version or year has every word of the search. */
export function searchLibrary(list: Library, query: string): Resource[] {
  const words = normal(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return list.resources.filter((r) => {
    const unit = unitOf(list, r.year, r.unit);
    const text = normal(`${r.lesson ?? ""} ${r.unit} ${unit?.title ?? ""} ${r.title} ${typeNames[r.type]} ${r.version} ${r.part ?? ""} year ${r.year} y${r.year} ${r.status === "waiting" ? "waiting" : "ready"}`);
    return words.every((w) => text.includes(w));
  }).sort((a, b) => a.year - b.year || byLesson(a.lesson ?? a.unit, b.lesson ?? b.unit) || byLesson(a.type, b.type) || byLesson(a.version, b.version));
}

export type View = "shelves" | "map";
export type LibraryState = { year: number; unit?: string; version?: string; view: View; q: string };
/** The page's state from its address: `?year=9&unit=A7&version=Foundation`, `?view=map`, `?q=gradient`. */
export function readState(search: string, fallbackYear = 7): LibraryState {
  const p = new URLSearchParams(search);
  const year = Number(p.get("year"));
  return { year: [7, 8, 9, 10, 11].includes(year) ? year : fallbackYear, unit: p.get("unit") || undefined, version: p.get("version") || undefined, view: p.get("view") === "map" ? "map" : "shelves", q: p.get("q") ?? "" };
}
export function writeState(state: LibraryState): string {
  const p = new URLSearchParams();
  p.set("year", String(state.year));
  if (state.unit) p.set("unit", state.unit);
  if (state.unit && state.version && state.version !== "Main") p.set("version", state.version);
  if (state.view === "map") p.set("view", "map");
  if (state.q) p.set("q", state.q);
  return `?${p}`;
}

/** An editor's ✓ Checked on one version of a booklet: it stays only while that version is current. */
export type Check = { updated: string; by: string; at: string };
export type Checks = Record<string, Check>;
/** The list as the page shows it: a waiting booklet checked at its current version is ready. */
export function applyChecks(list: Library, checks: Checks): Library {
  if (!Object.keys(checks).length) return list;
  return { ...list, resources: list.resources.map((r) => { const c = checks[r.id]; return c && c.updated === r.updated && r.status === "waiting" ? { ...r, status: "ready", checked: c } : r; }) };
}

/** Feedback from the Worker. `off` when the Worker has no GitHub token yet. */
export type Feedback = { threads: Thread[]; checks: Checks; canAct: boolean; me: string } | { off: string };
export async function loadFeedback(fetcher: typeof fetch = fetch): Promise<Feedback> {
  const response = await fetcher(`${siteBase()}api/library/feedback`, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(body.threads)) return { off: body.error ?? "Feedback could not be loaded." };
  return { threads: body.threads, checks: body.checks && typeof body.checks === "object" ? body.checks : {}, canAct: body.canAct === true, me: String(body.me ?? "") };
}
export type FeedbackAction = { action: "comment" | "delete" | "queue" | "unqueue" | "no-change" | "restore" | "agree" | "keep" | "check" | "uncheck"; year: number; unit: string; version: string; lesson?: string | null; booklet?: string | null; text?: string; updated?: string; id?: string; close?: boolean; cancelQueued?: boolean; comment?: number };

/** What an action does to the feedback the page holds, so the page can show it before the Worker answers. */
export function predictFeedback(old: Feedback, a: FeedbackAction): Feedback {
  if ("off" in old) return old;
  if (a.action === "check" && a.id && a.updated) return { ...old, checks: { ...old.checks, [a.id]: { updated: a.updated, by: old.me, at: new Date().toISOString() } }, threads: a.close ? old.threads.filter((t) => !same(t, a) || (t.queued && !a.cancelQueued)) : old.threads };
  if (a.action === "delete") return { ...old, threads: old.threads.flatMap((t) => { if (!same(t, a)) return [t]; const comments = t.comments.filter((c) => c.id !== a.comment); return comments.length ? [{ ...t, comments }] : []; }) };
  if (a.action === "uncheck" && a.id) { const checks = { ...old.checks }; delete checks[a.id]; return { ...old, checks }; }
  if (a.action === "no-change" || a.action === "keep") return { ...old, threads: old.threads.filter((t) => !same(t, a)) };
  const lesson = a.lesson ?? null, booklet = a.booklet ?? null, found = old.threads.find((t) => same(t, a));
  const thread: Thread = found ?? { number: 0, year: a.year, unit: a.unit, version: a.version, lesson, booklet, kind: lesson ? "lesson" : booklet ? "booklet" : "unit", queued: false, agreed: false, opened: new Date().toISOString(), comments: [] };
  const note = a.action === "comment" ? a.text?.trim() : a.action === "restore" ? `Make the version of ${a.updated} current again.` : a.action === "agree" ? "Agreed: plan the change." : "";
  const next: Thread = {
    ...thread,
    queued: a.action === "queue" || a.action === "restore" ? true : a.action === "unqueue" ? false : thread.queued,
    agreed: a.action === "agree" || thread.agreed,
    comments: note ? [...thread.comments, { who: old.me, when: new Date().toISOString(), text: note, mine: true }] : thread.comments,
  };
  return { ...old, threads: found ? old.threads.map((t) => (t === found ? next : t)) : [next, ...old.threads] };
}
const same = (t: Thread, a: FeedbackAction) => t.year === a.year && t.unit === a.unit && t.version === a.version && t.lesson === (a.lesson ?? null) && (t.booklet ?? null) === (a.booklet ?? null);
export async function sendFeedback(action: FeedbackAction, fetcher: typeof fetch = fetch) {
  const response = await fetcher(`${siteBase()}api/library/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? "That could not be saved.");
  return typeof body.warning === "string" ? body.warning : "";
}
