import { parseSchemeIndex, SCHEMES_PATH } from "../../../bankSchemes";
import { siteBase } from "../../site/routes";
import { parseSkillSets, type SkillSet } from "./model";

/**
 * The skill sheet banks named by the site's scheme index. They live in the private question bank, which the
 * site Worker serves only to signed-in staff. An empty list when there are none (for example in a checkout
 * without the bank), so the page simply offers no skill sheets; a bank that is present but invalid throws.
 */
export async function loadSkillSets(signal?: AbortSignal): Promise<SkillSet[]> {
  const get = async (path: string) => {
    const r = await fetch(siteBase() + path, { signal, headers: { Accept: "application/json" } });
    if (!r.ok || !(r.headers.get("content-type") ?? "").includes("json")) { await r.body?.cancel(); return null; }
    return r.json() as Promise<unknown>;
  };
  const raw = await get(SCHEMES_PATH);
  if (!raw) return [];
  const index = parseSchemeIndex(raw);
  if (!index.skillSheets) return [];
  const file = await get(index.skillSheets);
  return file ? parseSkillSets(file) : [];
}
