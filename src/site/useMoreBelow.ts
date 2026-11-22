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
    const added = new MutationObserver(() => {
      for (const child of el.children) seen.observe(child);
      check();
    });
    added.observe(el, { childList: true, subtree: true });
    return () => {
      el.removeEventListener("scroll", check);
      seen.disconnect();
      added.disconnect();
    };
  }, []);
  return ref;
}
