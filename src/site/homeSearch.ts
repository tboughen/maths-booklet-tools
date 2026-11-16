import type { ComponentType } from "react";
import { bookletTools, pageHref, siteSections } from "./registry";
import { searchTool } from "./toolCatalogue";

export type Icon = ComponentType<{ size?: number; "aria-hidden"?: boolean | "true" | "false" }>;
export type Found = { key: string; href: string; icon: Icon; name: string; note: string };
const section = (id: (typeof siteSections)[number]["id"]) => siteSections.find((s) => s.id === id)!;

/** A Sparx code is a letter and three digits, such as U332. */
const sparxCode = (query: string) => {
  const code = query.replace(/\s/g, "").toUpperCase();
  return /^[A-Z]\d{3}$/.test(code) ? code : "";
};

/** What the search box finds: a Sparx code, the six pages, and diagram tools by name or teaching topic. */
export function searchHome(query: string): Found[] {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const found: Found[] = [];
  const code = sparxCode(query);
  if (code) {
    const bank = section("question-bank");
    found.push({ key: "code", href: `${bank.href}?code=${code}`, icon: bank.icon, name: `Sparx code ${code}`, note: "Open its questions in the Question bank." });
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
