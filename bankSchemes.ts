// Schemes of work served from the private question bank (school information, so the files live in
// the bank repository, never here). `bank/schemes.json` names each scheme's source file; a release
// rewrites each name to the file's immutable `bank/assets/sha256/<hash>.json` object, served by the
// site Worker only to signed-in staff. No Node or browser side effects.

export const SCHEMES_PATH = "bank/schemes.json";
export const schemeIds = ["school"] as const;
export type SchemeId = (typeof schemeIds)[number];
export interface SchemeIndex {
  schemaVersion: 1;
  /** The department's own scheme, shown first on the Worksheets page. */
  school?: string;
}

const sourcePath = /^bank\/assets\/schemes\/[a-z0-9-]+\.json$/;
const releasedPath = /^bank\/assets\/sha256\/[a-f0-9]{64}\.json$/;

/** A scheme file path as the source index names it, or as a release rewrites it. */
export const schemePath = (path: unknown): path is string =>
  typeof path === "string" && (sourcePath.test(path) || releasedPath.test(path));

/** Reads a scheme index; throws on anything else so a bad file never reaches a release. */
export function parseSchemeIndex(value: unknown): SchemeIndex {
  const index = value as Partial<SchemeIndex> | null;
  if (!index || typeof index !== "object" || Array.isArray(index) || index.schemaVersion !== 1) throw new Error("Invalid scheme index");
  for (const key of Object.keys(index)) {
    if (key === "schemaVersion") continue;
    if (!(schemeIds as readonly string[]).includes(key) || !schemePath(index[key as SchemeId])) throw new Error("Invalid scheme index entry");
  }
  return index as SchemeIndex;
}
