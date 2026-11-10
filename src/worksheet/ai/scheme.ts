import { z } from "zod";
import { parseSchemeIndex, SCHEMES_PATH } from "../../../bankSchemes";
import { siteBase } from "../../site/routes";

/**
 * A scheme of work: units, each with numbered objectives. The department's own scheme is school
 * information, so it is never part of this repository: it is served from the private question bank
 * behind staff sign-in, or a teacher imports a scheme file, which stays on their device.
 */
const objective = z.object({ code: z.string().max(16), level: z.string().max(4).optional(), text: z.string().min(1).max(300) });
const unit = z.object({
  code: z.string().max(12),
  title: z.string().max(120),
  strand: z.string().max(60).optional(),
  hours: z.number().nullable().optional(),
  years: z.array(z.number().int()).optional(),
  objectives: z.array(objective).max(60),
});
export const schemeSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("scheme-of-work"),
  name: z.string().max(120),
  levels: z.record(z.string(), z.string()).optional(),
  units: z.array(unit).min(1).max(400),
});
export type Scheme = z.infer<typeof schemeSchema>;
export type SchemeObjective = z.infer<typeof objective>;

const IMPORTED = "maths-booklet-tools:worksheet-scheme:v1";

/** Reads JSON, or null for anything else (the site answers unknown paths with its HTML page). */
async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const r = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!r.ok || !(r.headers.get("content-type") ?? "").includes("json")) {
    // Release the unread body: an unread body keeps the request open, and the page never settles.
    await r.body?.cancel();
    return null;
  }
  return r.json();
}

/**
 * The department's scheme: the site's scheme index names its file in the private bank, which the
 * site Worker serves only to signed-in staff. Null when there is none, so teachers type objectives.
 */
export async function loadSchoolScheme(signal?: AbortSignal): Promise<Scheme | null> {
  try {
    const index = parseSchemeIndex(await getJson(siteBase() + SCHEMES_PATH, signal));
    if (!index.school) return null;
    const parsed = schemeSchema.safeParse(await getJson(siteBase() + index.school, signal));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Reads a scheme file: MathsDock scheme JSON, or a CSV whose columns are code, objective and optionally unit. */
export function parseScheme(text: string, fileName: string): Scheme {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    let raw: unknown;
    try {
      raw = JSON.parse(trimmed);
    } catch {
      throw Error("This scheme file is not valid JSON.");
    }
    const parsed = schemeSchema.safeParse(raw);
    if (!parsed.success) throw Error(`This is not a MathsDock scheme file: ${parsed.error.issues[0].path.join(".")} ${parsed.error.issues[0].message}`);
    return parsed.data;
  }
  const rows = trimmed.split(/\r?\n/).map(csvRow).filter((r) => r.some((c) => c.trim()));
  if (rows.length && /code/i.test(rows[0][0] ?? "") && /objective/i.test(rows[0][1] ?? "")) rows.shift();
  const units = new Map<string, Scheme["units"][number]>();
  for (const [code = "", text = "", unitTitle = ""] of rows) {
    if (!text.trim()) continue;
    const unitCode = code.split(".")[0].trim() || "Objectives";
    const u = units.get(unitCode) ?? { code: unitCode, title: unitTitle.trim() || unitCode, objectives: [] };
    u.objectives.push({ code: code.trim().slice(0, 16), text: text.trim().slice(0, 300) });
    units.set(unitCode, u);
  }
  if (!units.size) throw Error("No objectives found. A CSV scheme needs the columns code, objective and optionally unit.");
  return schemeSchema.parse({ schemaVersion: 1, kind: "scheme-of-work", name: fileName.replace(/\.[^.]+$/, "").slice(0, 120), units: [...units.values()] });
}

function csvRow(line: string): string[] {
  const out: string[] = [];
  let cell = "",
    quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(cell);
      cell = "";
    }
    else cell += c;
  }
  out.push(cell);
  return out;
}

export function loadImportedScheme(): Scheme | null {
  try {
    const parsed = schemeSchema.safeParse(JSON.parse(localStorage.getItem(IMPORTED) ?? "null"));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
export function saveImportedScheme(s: Scheme | null) {
  try {
    if (s) localStorage.setItem(IMPORTED, JSON.stringify(s));
    else localStorage.removeItem(IMPORTED);
  } catch {
    /* kept for this page only */
  }
}
