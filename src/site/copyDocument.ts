// The editor modules retain their storage context for this tab's lifetime.
const suppliedCopy = new URL(location.href).searchParams.get("resourceCopy");
export const resourceCopyId =
  suppliedCopy && /^[a-f0-9-]{36}$/.test(suppliedCopy) ? suppliedCopy : null;

/** Separate worked documents have a distinct storage key, including after reload. */
export function copyStorageKey(base: string) {
  return resourceCopyId ? `${base}:worked:${resourceCopyId}` : base;
}

export function openWorkedDocument(
  tool: string,
  storage: string,
  text: string,
) {
  const id = crypto.randomUUID();
  const base = storage.replace(/:worked:[a-f0-9-]{36}$/, "");
  const key = `${base}:worked:${id}`;
  // Saving precedes opening: a blocked popup still has a real, retryable document.
  localStorage.setItem(key, text);
  const url = new URL(location.origin + location.pathname);
  url.searchParams.set("tool", tool);
  url.searchParams.set("resourceCopy", id);
  const opened = window.open(url.href, "_blank");
  if (opened) opened.opener = null;
  return url.href;
}
