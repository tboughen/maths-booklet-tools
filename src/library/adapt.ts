/**
 * Adaptations (docs/content/RESOURCE-LIBRARY.md, Tim 28 Nov 2026): a teacher asks for an easier, harder or
 * differently taught version of one lesson or a whole unit. It is built from Main and joins the library as a
 * version beside Main, named by kind and class ("Easier (9X)"). The calls to the site Worker
 * (scripts/cloudflare/adapt-requests.mjs). No Node or browser side effects.
 */
import { siteBase } from "../site/routes";

export type AdaptKind = "easier" | "harder" | "different";
export const adaptKinds: Record<AdaptKind, string> = { easier: "Easier", harder: "Harder", different: "Different approach" };
export const ADAPT_TEXT_MAX = 2000;
export const ADAPT_CLASS_MAX = 12;
export const ADAPT_NAME_MAX = 24;
/** The same rule the bank list and the Worker use for version names. */
export const versionName = /^[A-Za-z0-9][A-Za-z0-9 ()+&,'-]{0,39}$/;

const tidy = (text: string, max: number) => text.replace(/[^A-Za-z0-9 +&,'-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max).trim();
/** "Easier" with class 9X is "Easier (9X)"; a different approach may carry the teacher's own short name instead. */
export function adaptName(kind: AdaptKind, className: string, own = ""): string {
  const base = (kind === "different" && tidy(own, ADAPT_NAME_MAX)) || adaptKinds[kind];
  const group = tidy(className, ADAPT_CLASS_MAX);
  return group ? `${base} (${group})` : base;
}

/** The kind an existing adaptation was made as: from its booklets, or read from its name. */
export const kindOf = (name: string, recorded?: AdaptKind): AdaptKind => recorded ?? (/^easier/i.test(name) ? "easier" : /^harder/i.test(name) ? "harder" : "different");

export type AdaptRequestBody = { year: number; unit: string; lesson: string | null; kind: AdaptKind; name: string; text: string };
export type AdaptAsked = { number: number; when: string; lesson: string | null; kind: AdaptKind; name: string; who: string; mine: boolean };

export async function loadAdaptRequests(year: number, unit: string, fetcher: typeof fetch = fetch): Promise<AdaptAsked[]> {
  const response = await fetcher(`${siteBase()}api/library/adapt?year=${year}&unit=${encodeURIComponent(unit)}`, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The requests could not be loaded.");
  return data.requests ?? [];
}

export async function sendAdaptRequest(body: AdaptRequestBody, fetcher: typeof fetch = fetch): Promise<{ number: number | null }> {
  const response = await fetcher(`${siteBase()}api/library/adapt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The request could not be sent. Try again, or tell Tim.");
  return data;
}
