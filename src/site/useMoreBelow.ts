import { useEffect, useRef } from "react";

/**
 * Marks a scrolling settings column with `data-more` while there is more below its visible part, so a fade at its
 * foot shows that it scrolls (21 Nov 2026 review: folded groups below the fold were easy to miss).
 */
export function useMoreBelow<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      const more = el.scrollHeight - el.clientHeight - el.scrollTop > 4;
      if (more) el.dataset.more = "";
      else delete el.dataset.more;
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    const seen = new ResizeObserver(check);
    seen.observe(el);
    for (const child of el.children) seen.observe(child);
    // Only the column's own cards change its length; removed ones are let go.
    const added = new MutationObserver((changes) => {
      for (const c of changes) for (const n of c.removedNodes) if (n instanceof Element) seen.unobserve(n);
      for (const child of el.children) seen.observe(child);
      check();
    });
    added.observe(el, { childList: true });
    return () => {
      el.removeEventListener("scroll", check);
      seen.disconnect();
      added.disconnect();
    };
  }, []);
  return ref;
}
