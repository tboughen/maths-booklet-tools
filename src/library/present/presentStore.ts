/**
 * What Present remembers for a class (docs/tools/PRESENT-BOOKLETS.md): its ink on each side of one exact build, the
 * side it stopped at, and the teacher's recent classes. Kept in this browser for now; the shape is the one a site store
 * behind staff sign-in will keep later. A class is only a short label the teacher types, such as 9X: no pupil data.
 */
import type { Stroke } from "../../bank/annotations";

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

/** Saves a class's ink and place for one build. Returns false when the browser refuses (storage full or blocked). */
export function saveClass(name: string, buildKey: string, sides: Record<string, Stroke[]>, stopped: Stopped | undefined, now = new Date().toISOString()) {
  const kept: Record<string, Stroke[]> = {};
  for (const [side, strokes] of Object.entries(sides)) if (strokes.length) kept[side] = tidy(strokes);
  return write(recordKey(name, buildKey), { schema: 1, sides: kept, stopped, updated: now } satisfies ClassRecord);
}

/** The newest build this class has saved anything for, among the booklet's builds. */
export function lastBuildFor(name: string, buildKeys: string[]) {
  let best: { key: string; updated: string } | undefined;
  for (const key of buildKeys) {
    const record = loadClass(name, key);
    if (record && (!best || record.updated > best.updated)) best = { key, updated: record.updated };
  }
  return best?.key;
}
