import { useEffect, useRef, type FocusEvent, type KeyboardEvent, type RefObject } from "react";

/**
 * The finder's keys, for the element that holds its search box and its panel: the arrows move
 * between the box and the tools, and Enter in the box opens the first tool found.
 */
export function finderKeys(event: KeyboardEvent<HTMLElement>, root: HTMLElement | null, box: HTMLInputElement | null) {
  if (event.key === "Enter" && event.target === box) {
    // Enter that confirms a word from an input method editor is not a choice of tool.
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    root?.querySelector<HTMLAnchorElement>("a.is-first")?.click();
    return;
  }
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  event.preventDefault();
  const links = [...(root?.querySelectorAll<HTMLAnchorElement>("a[data-switch]") ?? [])];
  const at = links.indexOf(document.activeElement as HTMLAnchorElement);
  const next = event.key === "ArrowDown" ? at + 1 : at - 1;
  if (next < 0 || next >= links.length) box?.focus();
  else links[next].focus();
}

/**
 * While the finder is open, a press outside it closes it, and so does leaving the page by a link
 * or the browser's Back button: the page stays mounted while hidden, and should not come back
 * with the finder still open.
 */
export function useFinderDismiss(open: boolean, root: RefObject<HTMLElement | null>, shut: () => void) {
  const latest = useRef(shut);
  useEffect(() => {
    latest.current = shut;
  });
  useEffect(() => {
    if (!open) return;
    const close = () => latest.current();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    window.addEventListener("pointerdown", outside);
    window.addEventListener("popstate", close);
    return () => {
      window.removeEventListener("pointerdown", outside);
      window.removeEventListener("popstate", close);
    };
  }, [open, root]);
}

/** Whether focus has gone from the finder to something outside it (Tab out). A click elsewhere is a press outside. */
export const focusLeft = (event: FocusEvent<HTMLElement>, root: HTMLElement | null) =>
  Boolean(event.relatedTarget && !root?.contains(event.relatedTarget as Node));
