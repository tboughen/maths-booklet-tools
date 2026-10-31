/**
 * Page addresses. Every page has its own path, such as `/tools/venn` or
 * `/question-bank`; page state (question, filters, diagram links) stays in the
 * query string and hash. Old `?tool=` links are upgraded to these paths.
 *
 * This module holds no page code, so link helpers can import it cheaply.
 * `registry.ts` checks that `toolIds` matches its booklet tools.
 */
export const toolIds = [
  "bar-model",
  "expanding-factorising",
  "triangle",
  "venn",
  "graph",
  "ratio-table",
  "value-table-graph",
  "cuboids",
  "number-line",
] as const;
export type ToolId = (typeof toolIds)[number];
/** Pages a link can point to. */
export type LinkPageId =
  | ToolId
  | "home"
  | "booklet-tools"
  | "question-bank"
  | "assessment-follow-up";
/** Every page the site can show, including the not-found page. */
export type PageId = LinkPageId | "not-found";

type LocationLike = { pathname: string };

const sitePaths: Partial<Record<LinkPageId, string>> = {
  home: "",
  "booklet-tools": "tools",
  "question-bank": "question-bank",
  "assessment-follow-up": "assessment-follow-up",
};

/** The site's root path; always ends with `/`. */
export function siteBase(): string {
  const base = import.meta.env?.BASE_URL || "/";
  return base.endsWith("/") ? base : `${base}/`;
}

/** The path of a page, such as `/tools/venn`. */
export function pageHref(id: LinkPageId): string {
  return siteBase() + (sitePaths[id] ?? `tools/${id}`);
}

const isTool = (id: string): id is ToolId =>
  (toolIds as readonly string[]).includes(id);

/** The page a path shows. Unknown paths show the not-found page. */
export function readPage(where: LocationLike = location): PageId {
  const base = siteBase();
  const path = `${where.pathname.replace(/\/{2,}/g, "/").replace(/\/+$/, "")}/`;
  if (!path.startsWith(base)) return "not-found";
  const rest = path.slice(base.length, -1);
  if (rest === "" || rest === "index.html") return "home";
  if (rest === "tools") return "booklet-tools";
  if (rest === "question-bank" || rest === "assessment-follow-up") return rest;
  const tool = /^tools\/([a-z-]+)$/.exec(rest)?.[1];
  return tool && isTool(tool) ? tool : "not-found";
}

/**
 * The path form of an old `?tool=` link, keeping its other query values and
 * hash; null when the link has no `tool` value. Unknown tools go to a path
 * that shows the not-found page.
 */
export function upgradeLegacyLink(href: string): string | null {
  const url = new URL(href);
  const tool = url.searchParams.get("tool");
  if (tool === null) return null;
  url.searchParams.delete("tool");
  const known =
    tool === "" || tool === "home"
      ? "home"
      : tool === "booklet-tools" ||
          tool === "question-bank" ||
          tool === "assessment-follow-up" ||
          isTool(tool)
        ? tool
        : null;
  url.pathname = known
    ? pageHref(known)
    : `${siteBase()}tools/${encodeURIComponent(tool)}`;
  return url.href;
}

/** True when an editor link opens the given tool, in either address form. */
export function linkOpensTool(href: string | URL, tool: ToolId): boolean {
  const url = new URL(href);
  const legacy = url.searchParams.get("tool");
  return legacy !== null ? legacy === tool : readPage(url) === tool;
}

/** Points a URL at a tool's page, clearing any other query values. */
export function setToolPage(url: URL, tool: ToolId): URL {
  url.pathname = pageHref(tool);
  url.search = "";
  return url;
}

/** Editor links made by the shared cores use `?tool=`; the site shows the path form. */
export const pathLink = (href: string): string => upgradeLegacyLink(href) ?? href;
