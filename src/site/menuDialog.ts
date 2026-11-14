import { useEffect, useRef, type RefObject } from "react";

/**
 * Keyboard and focus behaviour of a dialog opened from the File menu (U34, U116): the first field
 * takes focus, Escape cancels, Tab stays inside the dialog, and on close focus returns to where the
 * teacher was (or the File button, since the menu item has gone with the menu).
 */
export function useMenuDialog(box: RefObject<HTMLElement | null>, onCancel: () => void) {
  const cancel = useRef(onCancel);
  cancel.current = onCancel;
  useEffect(() => {
    const previous = document.activeElement;
    // After the File menu has closed and handed focus back, so the title field keeps it.
    const start = window.setTimeout(() => box.current?.querySelector<HTMLElement>("input, textarea")?.focus());
    function keys(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        cancel.current();
      }
      if (event.key !== "Tab") return;
      const controls = box.current?.querySelectorAll<HTMLElement>("input, textarea, select, button:not(:disabled)");
      if (!controls?.length) return;
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", keys);
    return () => {
      window.clearTimeout(start);
      window.removeEventListener("keydown", keys);
      // Back to where the teacher was: the File menu item has gone with the menu, so its File button.
      const target =
        previous instanceof HTMLElement && previous.isConnected
          ? previous
          : Array.from(document.querySelectorAll<HTMLElement>("button.file-menu-button")).find((b) => b.offsetParent !== null);
      target?.focus();
    };
  }, [box]);
}
