import type { ComponentType } from "react";
import { normalizeCode } from "../bank/model";
import { bookletTools, pageHref, siteSection, siteSections } from "./registry";
import { searchTool } from "./toolCatalogue";

export type Icon = ComponentType<{ size?: number; "aria-hidden"?: boolean | "true" | "false" }>;
export type Found = { key: string; href: string; icon: Icon; name: string; note: string };

/** A Sparx code is a letter and three digits, such as U332. */
const sparxCode = (query: string) => {
  const code = normalizeCode(query);
  return /^[A-Z]\d{3}$/.test(code) ? code : "";
};

/** What the search box finds: a Sparx code, the six pages, and diagram tools by name or teaching topic. */
export function searchHome(query: string): Found[] {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const found: Found[] = [];
  const code = sparxCode(query);
  if (code) {
    // Home does not hold the catalogue, so it cannot say whether the code has questions.
    const bank = siteSection("question-bank");
    found.push({ key: "code", href: `${bank.href}?code=${code}`, icon: bank.icon, name: `Sparx code ${code}`, note: "Look it up in the Question bank." });
  }
  for (const s of siteSections)
    if (words.every((word) => `${s.name} ${s.description}`.toLocaleLowerCase().includes(word)))
      found.push({ key: s.id, href: s.href, icon: s.icon, name: s.name, note: s.description });
  for (const tool of bookletTools) {
    const match = searchTool(tool, query);
    if (match.found)
      found.push({ key: tool.id, href: pageHref(tool.id), icon: tool.icon, name: tool.name, note: match.matched ? `Diagram tool. Matches “${match.matched}”.` : "Diagram tool." });
  }
  return found;
}
