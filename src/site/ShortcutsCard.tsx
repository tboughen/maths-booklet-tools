import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { SHORTCUTS_EVENT, isTypingTarget, modalOpen } from "../editor-kit/shortcuts";

const rows: [keys: string[][], what: string][] = [
  [[["Ctrl", "Z"], ["Ctrl", "Y"]], "Undo, redo"],
  [[["Delete"]], "Remove the selected label, point, arrow, line or shading"],
  [[["←", "→", "↑", "↓"]], "Move the selected object 1 mm (hold Shift for 5 mm)"],
  [[["Tab"]], "Move between the parts of the diagram you can click"],
  [[["Enter"], ["Esc"]], "Apply an edit, cancel it or deselect"],
  [[["?"]], "Show this list"],
];

/**
 * The keyboard shortcuts every diagram editor shares, on one small card (21 Nov 2026 usability
 * review). Press ? anywhere outside a text field, or choose "Keyboard shortcuts" in the File menu.
 * Mounted by `EditorToolbar`; a page that is switched away from does not answer the key.
 */
export function ShortcutsCard({ active, anchor }: { active?: boolean; anchor: RefObject<HTMLElement | null> }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  // Focus goes back where it was when the card closes.
  const returnTo = useRef<HTMLElement | null>(null);
  const show = () => {
    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    const back = returnTo.current;
    returnTo.current = null;
    if (back?.isConnected) requestAnimationFrame(() => back.focus());
  };
  // A page that is switched away from closes its card, so it never covers another tool.
  if (open && active === false) setOpen(false);
  useEffect(() => {
    if (active === false) return;
    const visible = () => Boolean(anchor.current?.getClientRects().length);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "?" || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      if (isTypingTarget(event.target) || modalOpen() || !visible()) return;
      // Not over an open Download or File menu.
      if (document.querySelector('[role="menu"]')) return;
      event.preventDefault();
      show();
    };
    const onAsk = () => {
      if (visible()) show();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(SHORTCUTS_EVENT, onAsk);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(SHORTCUTS_EVENT, onAsk);
    };
  }, [active, anchor]);
  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal?.();
  }, [open]);
  if (!open) return null;
  return createPortal(
    <dialog
      ref={dialog}
      className="shortcuts-card"
      aria-labelledby="shortcuts-card-title"
      aria-modal="true"
      onKeyDown={(event) => event.stopPropagation()}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header>
        <h2 id="shortcuts-card-title">Keyboard shortcuts</h2>
        <button type="button" onClick={close}>
          Close
        </button>
      </header>
      <table>
        <tbody>
          {rows.map(([keys, what]) => (
            <tr key={what}>
              <th scope="row">
                {keys.map((combo, i) => (
                  <span key={i} className="shortcuts-combo">
                    {i > 0 && <span className="shortcuts-or"> / </span>}
                    {combo.map((key) => (
                      <kbd key={key}>{key}</kbd>
                    ))}
                  </span>
                ))}
              </th>
              <td>{what}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>Not every tool has objects to move. On a Mac, use Cmd in place of Ctrl.</p>
    </dialog>,
    document.body,
  );
}
