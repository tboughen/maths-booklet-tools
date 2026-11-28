/**
 * What Present remembers for a class (docs/tools/PRESENT-BOOKLETS.md): its ink on each side of one exact build, the
 * side it stopped at, and the teacher's recent classes. Each record is kept in this browser at once and on the site
 * (scripts/cloudflare/present-ink.mjs, behind staff sign-in) a few seconds later, so it follows the teacher between
 * computers; the newer copy wins. A class is only a short label the teacher types, such as 9X: no pupil data.
 */
import type { Stroke } from "../../bank/annotations";
import { siteBase } from "../../site/routes";

export type Stopped = { side: number; at: string; flag: boolean };
export type ClassRecord = { schema: 1; sides: Record<string, Stroke[]>; stopped?: Stopped; updated: string };
export type RecentClass = { name: string; last: string };

const RECENT = "present-classes";
const recordKey = (className: string, buildKey: string) => `present-ink|${className}|${buildKey}`;
const MAX_RECENT = 8;

/** "9 x" and "9X " are the same class. */
export function className(text: string) {
  return text.trim().replace(/\s+/g, "").toUpperCase().slice(0, 12);
}

function read<T>(key: string): T | undefined {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : undefined; } catch { return undefined; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export function recentClasses(): RecentClass[] {
  const list = read<RecentClass[]>(RECENT);
  return Array.isArray(list) ? list.filter((c) => typeof c?.name === "string" && c.name).slice(0, MAX_RECENT) : [];
}
export function rememberClass(name: string, now = new Date().toISOString()) {
  const next = [{ name, last: now }, ...recentClasses().filter((c) => c.name !== name)].slice(0, MAX_RECENT);
  write(RECENT, next);
  return next;
}

export function loadClass(name: string, buildKey: string): ClassRecord | undefined {
  const record = read<ClassRecord>(recordKey(name, buildKey));
  return record?.schema === 1 && record.sides && typeof record.sides === "object" ? record : undefined;
}

/** Points to a tenth of a PDF point: plenty for ink, and a booklet's ink stays small. */
const tidy = (strokes: Stroke[]) => strokes.map((s) => ({ ...s, points: s.points.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10] as [number, number]) }));

/** The record Present saves: empty sides left out, points tidied. */
export function classRecord(sides: Record<string, Stroke[]>, stopped: Stopped | undefined, now = new Date().toISOString()): ClassRecord {
  const kept: Record<string, Stroke[]> = {};
  for (const [side, strokes] of Object.entries(sides)) if (strokes.length) kept[side] = tidy(strokes);
  return { schema: 1, sides: kept, stopped, updated: now };
}

/** Saves a class's ink and place for one build in this browser. Returns false when the browser refuses (storage full or blocked). */
export function saveClass(name: string, buildKey: string, record: ClassRecord) {
  return write(recordKey(name, buildKey), record);
}

/** The newer of two copies of a record (this browser's and the site's). */
export function newerRecord(a: ClassRecord | undefined, b: ClassRecord | undefined) {
  return !a ? b : !b ? a : b.updated > a.updated ? b : a;
}

/** The newest build this class has saved anything for, among the booklet's builds, here or on the site. */
export function lastBuildFor(name: string, buildKeys: string[], site: { build: string; updated: string }[] = []) {
  let best: { key: string; updated: string } | undefined;
  for (const key of buildKeys) {
    const record = loadClass(name, key);
    const updated = [record?.updated, site.find((b) => b.build === key)?.updated].filter((u): u is string => !!u).sort().pop();
    if (updated && (!best || updated > best.updated)) best = { key, updated };
  }
  return best?.key;
}

// The site copy. Every call answers undefined when the site cannot be reached or saving there is not available
// (a preview, or signed out), so Present carries on with this browser's copy.
const inkUrl = (query: Record<string, string>) => `${siteBase()}api/present/ink?${new URLSearchParams(query)}`;
async function siteJson<T>(response: Response): Promise<T | undefined> {
  if (!response.ok || !/^application\/json/i.test(response.headers.get("Content-Type") || "")) return undefined;
  return (await response.json().catch(() => undefined)) as T | undefined;
}

/** The site's copy of a class's record for one build: null when the site has none. */
export async function loadClassSite(name: string, buildKey: string, fetcher: typeof fetch = fetch): Promise<ClassRecord | null | undefined> {
  try {
    const body = await siteJson<{ record: ClassRecord | null }>(await fetcher(inkUrl({ class: name, build: buildKey }), { cache: "no-store" }));
    if (!body || !("record" in body)) return undefined;
    return body.record?.schema === 1 && body.record.sides ? body.record : null;
  } catch { return undefined; }
}

/** The builds the site holds ink for, for this class. */
export async function siteBuilds(name: string, fetcher: typeof fetch = fetch) {
  try {
    const body = await siteJson<{ builds: { build: string; updated: string }[] }>(await fetcher(inkUrl({ class: name }), { cache: "no-store" }));
    return Array.isArray(body?.builds) ? body.builds : undefined;
  } catch { return undefined; }
}

/** Saves the record on the site. keepalive lets a save started as the page closes finish (small records only). */
export async function saveClassSite(name: string, buildKey: string, record: ClassRecord, options: { keepalive?: boolean; fetcher?: typeof fetch } = {}) {
  const body = JSON.stringify({ class: name, build: buildKey, record });
  try {
    const response = await (options.fetcher ?? fetch)(`${siteBase()}api/present/ink`, { method: "PUT", headers: { "Content-Type": "application/json" }, body, keepalive: !!options.keepalive && body.length < 60_000 });
    return !!(await siteJson<{ ok: boolean }>(response))?.ok;
  } catch { return false; }
}
