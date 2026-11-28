import { pageHref, type ToolId } from "./routes";

// The editor modules retain their storage context for this tab's lifetime.
const suppliedCopy = new URL(location.href).searchParams.get("resourceCopy");
export const resourceCopyId =
  suppliedCopy && /^[a-f0-9-]{36}$/.test(suppliedCopy) ? suppliedCopy : null;

/**
 * A diagram tool opened inside the Booklet builder's diagram dialog (?embed=booklet on a resource copy): the page
 * shows the tool alone, records no recent work and does not leave the tool.
 */
export const embeddedInBooklet = resourceCopyId !== null && new URL(location.href).searchParams.get("embed") === "booklet";

/** Separate worked documents have a distinct storage key, including after reload. */
export function copyStorageKey(base: string) {
  return resourceCopyId ? `${base}:worked:${resourceCopyId}` : base;
}

export function openWorkedDocument(
  tool: ToolId,
  storage: string,
  text: string,
) {
  const id = crypto.randomUUID();
  const base = storage.replace(/:worked:[a-f0-9-]{36}$/, "");
  const key = `${base}:worked:${id}`;
  // Saving precedes opening: a blocked popup still has a real, retryable document.
  localStorage.setItem(key, text);
  const url = new URL(pageHref(tool), location.origin);
  url.searchParams.set("resourceCopy", id);
  const opened = window.open(url.href, "_blank");
  if (opened) opened.opener = null;
  return url.href;
}
