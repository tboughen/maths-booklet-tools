/**
 * Cover lesson requests (docs/content/COVER-REQUESTS.md): the check the page shows before Build now, the
 * text read out of an attached file, and the calls to the site Worker (scripts/cloudflare/cover-requests.mjs).
 * The check reads the teacher's own words against the library's list of units and lessons, so a request
 * never reaches past the lesson the class is on. No Node or browser side effects.
 */
import { siteBase } from "../site/routes";
import { byLesson, type Library, type LibraryUnit } from "./model";

export const COVER_TEXT_MAX = 2000;
export const COVER_ATTACHMENT_MAX = 20000;
export const COVER_FILE_MAX_BYTES = 15 * 1024 * 1024;

/** The suggestions that fill the box: the teacher completes the gaps. Never "starter", which means something else in teaching. */
export const coverSuggestions = [
  { label: "Revise our unit up to a lesson", text: "We're on unit … , lesson … . Revise the lessons so far." },
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

/** The one-line check the teacher confirms, which also goes in the request for the build. */
export function planSentence(plan: CoverPlan, group: string, attachment: string | null): string {
  const file = attachment ? `, using the attached file (${attachment})` : "";
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

export type CoverLogEntry = { number: number; when: string; year: number; tier: string | null; who: string; mine: boolean; text: string; state: "waiting" | "building" | "ready" | "stopped" };
export type CoverRequestBody = { year: number; tier: "Foundation" | "Higher" | null; absent: true; text: string; plan: string; attachment: { name: string; text: string } | null };

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

/** Cover lessons are short-lived (Tim, 26 Nov): a lesson a cover request built, on a Review and cover shelf. */
export const isCoverLesson = (r: { unit: string; note?: string }) => r.unit === "REVIEW" && /^Cover request #\d+/.test(r.note ?? "");
export const COVER_KEEP_DAYS = 7;
const dayMs = 86400000;
/** After 7 days a cover lesson folds away into "Old cover lessons". */
export const isOldCover = (r: { unit: string; note?: string; updated: string }, now = Date.now()) =>
  isCoverLesson(r) && now - Date.parse(r.updated.length === 10 ? `${r.updated}T12:00:00` : r.updated) > COVER_KEEP_DAYS * dayMs;
/** The requests the page lists: the last 7 days only. */
export const recentRequests = (log: CoverLogEntry[], now = Date.now()) => log.filter((r) => now - Date.parse(r.when) <= COVER_KEEP_DAYS * dayMs);

/** Deletes one cover lesson from the library list (library editors only). Its files stay in the private store. */
export async function removeCoverLesson(id: string, fetcher: typeof fetch = fetch): Promise<string[]> {
  const response = await fetcher(`${siteBase()}api/library/cover`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove", id }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The cover lesson could not be deleted. Try again.");
  return data.removed ?? [];
}
