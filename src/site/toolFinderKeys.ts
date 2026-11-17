import type { KeyboardEvent } from "react";

/**
 * The finder's keys, for the element that holds its search box and its panel: the arrows move
 * between the box and the tools, and Enter in the box opens the first tool found. Returns whether
 * the key was the finder's.
 */
export function finderKeys(event: KeyboardEvent<HTMLElement>, root: HTMLElement | null, box: HTMLInputElement | null) {
  if (event.key === "Enter" && event.target === box) {
    // Enter that confirms a word from an input method editor is not a choice of tool.
    if (event.nativeEvent.isComposing) return true;
    event.preventDefault();
    root?.querySelector<HTMLAnchorElement>("a.is-first")?.click();
    return true;
  }
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return false;
  event.preventDefault();
  const links = [...(root?.querySelectorAll<HTMLAnchorElement>("a[data-switch]") ?? [])];
  const at = links.indexOf(document.activeElement as HTMLAnchorElement);
  const next = event.key === "ArrowDown" ? at + 1 : at - 1;
  if (next < 0 || next >= links.length) box?.focus();
  else links[next].focus();
  return true;
}
