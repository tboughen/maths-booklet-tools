/**
 * Cover lesson requests (docs/content/COVER-REQUESTS.md): the check the page shows before Build now, the
 * text read out of an attached file, and the calls to the site Worker (scripts/cloudflare/cover-requests.mjs).
 * The check reads the teacher's own words against the library's list of units and lessons, so a request
 * never reaches past the lesson the class is on. No Node or browser side effects.
 */
import { siteBase } from "../site/routes";
import { byLesson, type Library, type LibraryUnit, type Resource } from "./model";

export const COVER_TEXT_MAX = 2000;
export const COVER_ATTACHMENT_MAX = 20000;
export const COVER_FILE_MAX_BYTES = 15 * 1024 * 1024;

/** The suggestions that fill the box: the teacher completes the gaps. Never "starter", which means something else in teaching. */
export const coverSuggestions = [
  { label: "Revise our unit up to a lesson", text: "We're on unit … , lesson … . Revise the lessons so far." },
  { label: "Sparx codes", text: "Revise Sparx codes: … " },
  { label: "Mock revision", text: "Mock revision for Paper … ." },
  { label: "Use the file I've attached", text: "Revise the topics in the file I've attached." },
] as const;

export type CoverPlan = { unit: LibraryUnit | null; lessons: { code: string; title: string }[]; upTo: string | null; needsLesson: boolean };

/** The year's units, in teaching order. */
export function yearUnits(list: Library, year: number): LibraryUnit[] {
  // Scheme units only (NP17, A7), not shelves such as starters or mock revision.
  return list.years.find((y) => y.year === year)?.sections.flatMap((s) => s.units).filter((u) => /^[A-Z]{1,3}\d/.test(u.code)) ?? [];
}

/** The lesson's number within its unit: NP17.03 -> 3, A4.00 -> 0. */
const lessonNo = (code: string) => Number(/\.(\d+)/.exec(code)?.[1] ?? NaN);

/**
 * Reads "NP17, lesson 3", "NP17.03" or "lesson 3 of NP17" against the year's units. A unit with no lesson
 * named asks which lesson the class is on, so nothing later than that is revised.
 */
export function coverPlan(list: Library, year: number, text: string, upTo?: string | null): CoverPlan {
  // "none": the teacher said the code wasn't a unit (e.g. "print on A4"), so the build follows the description.
  if (upTo === "none") return { unit: null, lessons: [], upTo: null, needsLesson: false };
  const units = yearUnits(list, year);
  const codes = new Map(units.map((u) => [u.code.toUpperCase(), u]));
  let unit: LibraryUnit | null = null;
  let named: number | null = null;
  for (const m of text.matchAll(/\b([A-Za-z]{1,3}\d{1,2})(?:\.(\d{1,2}))?\b/g)) {
    const u = codes.get(m[1].toUpperCase());
    if (!u) continue;
    unit = u;
    if (m[2] !== undefined) named = Number(m[2]);
    break;
  }
  if (!unit) return { unit: null, lessons: [], upTo: null, needsLesson: false };
  const all = [...(unit.lessons ?? [])].sort((a, b) => byLesson(a.code, b.code));
  // Only a lesson number next to the unit counts ("NP17, lesson 3", "lesson 3 of NP17"), not "last lesson 5 pupils…".
  const code = unit.code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const said = new RegExp(`\\b${code}\\b[\\s,;:-]*(?:\\(?\\s*)?lesson\\s*(\\d{1,2})\\b|\\blesson\\s*(\\d{1,2})\\s+(?:of|in|from)\\s+${code}\\b`, "i").exec(text);
  if (named === null && said) named = Number(said[1] ?? said[2]);
  const chosen = upTo ? all.find((l) => l.code === upTo) : named === null ? undefined : all.find((l) => lessonNo(l.code) === named);
  if (!chosen) return { unit, lessons: [], upTo: null, needsLesson: all.length > 0 };
  return { unit, lessons: all.filter((l) => lessonNo(l.code) <= lessonNo(chosen.code)), upTo: chosen.code, needsLesson: false };
}

/** Sparx codes named in the description (U449, u638), upper-cased, in order, once each. */
export const sparxCodes = (text: string): string[] => [...new Set([...text.matchAll(/\bU\d{3}\b/gi)].map((m) => m[0].toUpperCase()))];

/** The one-line check shown under the description, which also goes in the request for the build. */
export function planSentence(plan: CoverPlan, group: string, attachment: string | null, text = ""): string {
  const codes = sparxCodes(text);
  const file = (codes.length ? `, with Sparx ${codes.join(", ")}` : "") + (attachment ? `, using the attached file (${attachment})` : "");
  if (!plan.unit && codes.length) return `I'll make one cover lesson for ${group} revising Sparx ${codes.join(", ")}${attachment ? `, using the attached file (${attachment})` : ""}.`;
  if (!plan.unit) return `I'll make one cover lesson for ${group} from your description${file}.`;
  if (!plan.lessons.length) return `I'll make one cover lesson for ${group} on ${plan.unit.code} ${plan.unit.title}${file}.`;
  const first = plan.lessons[0].code, last = plan.lessons[plan.lessons.length - 1].code;
  const range = first === last ? first : `${first} to ${last}`;
  return `I'll make one cover lesson for ${group} revising ${range}: ${plan.lessons.map((l) => l.title.trim().replace(/\.$/, "")).join("; ")}${file}.`;
}

/** The words in a PowerPoint or Word file: every text run, slide by slide. Images and layout are not kept. */
export async function officeText(bytes: Uint8Array): Promise<string> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(bytes, { filter: (f) => /^(ppt\/slides\/slide\d+|word\/document)\.xml$/.test(f.name) });
  const names = Object.keys(files).sort((a, b) => byLesson(a, b));
  const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  return names
    .map((n) => [...strFromU8(files[n]).matchAll(/<(?:a|w):t(?:\s[^>]*)?>([^<]*)<\/(?:a|w):t>/g)].map((m) => decode(m[1])).join(" ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((t, i) => (names[i].startsWith("ppt") ? `Slide ${i + 1}: ${t}` : t))
    .join("\n")
    .slice(0, COVER_ATTACHMENT_MAX);
}

export type CoverLogEntry = { number: number; when: string; since?: string | null; year: number; tier: string | null; className?: string | null; room?: string | null; date?: string | null; who: string; mine: boolean; text: string; state: "waiting" | "building" | "ready" | "stopped" };
/** `absent` is the tick "This is cover work for myself or a colleague." (the field keeps its first name). */
export type CoverRequestBody = { year: number; tier: "Foundation" | "Higher" | null; className: string; room: string; date: string; absent: true; text: string; plan: string; attachment: { name: string; text: string } | null };
export const COVER_FIELD_MAX = 20;

export type CoverLog = { requests: CoverLogEntry[]; building: boolean };
/** The cover lessons deleted from the list, and whether the signed-in teacher may delete one. */
export async function loadCoverRemoved(fetcher: typeof fetch = fetch): Promise<{ removed: string[]; canDelete: boolean }> {
  const response = await fetcher(`${siteBase()}api/library/cover?only=removed`, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The deleted list could not be loaded.");
  return data;
}
export async function loadCoverLog(fetcher: typeof fetch = fetch): Promise<CoverLog> {
  const response = await fetcher(`${siteBase()}api/library/cover`, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The requests could not be loaded.");
  return data;
}

export async function sendCoverRequest(body: CoverRequestBody, fetcher: typeof fetch = fetch): Promise<{ number: number; started: boolean }> {
  const response = await fetcher(`${siteBase()}api/library/cover`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The request could not be sent. Try again, or tell Tim.");
  return data;
}

/**
 * Cover work (Tim, 27 Nov): a resource on a Review and cover shelf whose note starts "Cover request #N" (built from a
 * request) or "Cover lesson" (made by hand). It lives only in the Cover library, never on the shelves, search or Map.
 */
export const isCoverWork = (r: { unit: string; note?: string }) => r.unit === "REVIEW" && /^(Cover request #\d+|Cover lesson)/.test(r.note ?? "");
export const COVER_KEEP_DAYS = 7;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (day: string, n: number) => { const [y, m, d] = day.split("-").map(Number); return iso(new Date(y, m - 1, d + n)); };
/** Today in the UK, YYYY-MM-DD: the same clock the Worker checks the date against. */
export const localToday = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
/** The date box's starting value: the next weekday after today (term dates are not known here). */
export function nextSchoolDay(now = new Date()): string {
  let day = addDays(localToday(now), 1);
  while ([0, 6].includes(weekday(day))) day = addDays(day, 1);
  return day;
}
const weekday = (day: string) => { const [y, m, d] = day.split("-").map(Number); return new Date(y, m - 1, d).getDay(); };
/** The latest date a request may name, as the Worker checks it. */
export const lastCoverDate = (now = new Date()) => addDays(localToday(now), 30);
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** The build bar (Tim, 28 Nov): fills to 90% over 16 minutes, then waits there until the booklet is ready. */
export const COVER_BUILD_MINUTES = 16;
export function buildProgress(since: string, now = Date.now()): { fraction: number; words: string } {
  const minutes = Math.max(0, (now - Date.parse(since)) / 60000);
  if (minutes >= COVER_BUILD_MINUTES) return { fraction: 0.9, words: "Taking longer than usual, nearly there" };
  const left = Math.ceil(COVER_BUILD_MINUTES - minutes);
  return { fraction: (0.9 * minutes) / COVER_BUILD_MINUTES, words: `About ${left} minute${left === 1 ? "" : "s"} left` };
}
/** "2026-11-28" as "Sat 28 Nov". */
export function ukDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${DAYS[new Date(y, m - 1, d).getDay()]} ${d} ${MONTHS[m - 1]}`;
}

/** One entry in the Cover library: a request, the booklet it built, or both. */
export type CoverEntry = {
  key: string; number: number | null; year: number; tier: string | null; className: string | null; room: string | null;
  /** The lesson's date, YYYY-MM-DD. */
  date: string; who: string | null; mine: boolean; state: CoverLogEntry["state"]; text: string; resource: Resource | null;
  /** When it was asked for (ISO), and when its build started, for the progress bar. */
  asked: string | null; since: string | null;
};
const noteNumber = (note = "") => { const m = /^Cover request #(\d+)/.exec(note); return m ? Number(m[1]) : null; };
/** A build's note says "Cover request #N. Class 10X2, room M4, 2026-11-28."; a hand-made one may give only a date. */
function fromNote(note = "") {
  const m = /Class (.+?), room (.+?), (\d{4}-\d{2}-\d{2})/.exec(note);
  return { className: m?.[1] ?? null, room: m?.[2] ?? null, date: m?.[3] ?? /\d{4}-\d{2}-\d{2}/.exec(note)?.[0] ?? null };
}

/**
 * The Cover library: the request log merged with the built cover booklets (matched by "Cover request #N"), grouped by
 * the date the cover is for (Tim, 28 Nov): today, coming up (soonest first), the last 7 days and older (most recent first).
 * Deleted booklets, and requests whose booklet was deleted, are left out.
 */
export function coverLibrary(log: CoverLogEntry[], resources: Resource[], removed: Set<string>, now = new Date()): { today: CoverEntry[]; coming: CoverEntry[]; recent: CoverEntry[]; older: CoverEntry[] } {
  const covers = resources.filter(isCoverWork);
  const gone = new Set(covers.filter((r) => removed.has(r.id)).map((r) => noteNumber(r.note)).filter((n) => n !== null));
  const live = covers.filter((r) => !removed.has(r.id));
  const byNumber = new Map(live.map((r) => [noteNumber(r.note), r] as const).filter(([n]) => n !== null));
  const used = new Set<Resource>();
  const entries: CoverEntry[] = [];
  for (const q of log) {
    if (gone.has(q.number)) continue;
    const r = byNumber.get(q.number) ?? null;
    if (r) used.add(r);
    const note = fromNote(r?.note);
    entries.push({ key: `q${q.number}`, number: q.number, year: q.year, tier: q.tier, className: q.className ?? note.className, room: q.room ?? note.room, date: q.date ?? note.date ?? localToday(new Date(q.when)), who: q.mine ? "You" : q.who, mine: q.mine, state: r ? "ready" : q.state, text: q.text, resource: r, asked: q.when, since: q.since ?? q.when });
  }
  for (const r of live) {
    if (used.has(r)) continue;
    const note = fromNote(r.note);
    entries.push({ key: r.id, number: noteNumber(r.note), year: r.year, tier: null, className: note.className, room: note.room, date: note.date ?? r.updated.slice(0, 10), who: null, mine: false, state: "ready", text: r.title, resource: r, asked: null, since: null });
  }
  entries.sort((a, b) => b.date.localeCompare(a.date) || (b.number ?? 0) - (a.number ?? 0));
  const day = localToday(now);
  const cut = addDays(day, -COVER_KEEP_DAYS);
  return {
    today: entries.filter((e) => e.date === day),
    coming: entries.filter((e) => e.date > day).reverse(),
    recent: entries.filter((e) => e.date < day && e.date >= cut),
    older: entries.filter((e) => e.date < cut),
  };
}

/** Deletes one cover booklet from the Cover library (library editors only). Its files stay in the private store. */
export async function removeCoverLesson(id: string, fetcher: typeof fetch = fetch): Promise<string[]> {
  const response = await fetcher(`${siteBase()}api/library/cover`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove", id }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The cover lesson could not be deleted. Try again.");
  return data.removed ?? [];
}
