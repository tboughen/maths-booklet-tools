import { useState } from "react";
import type { About } from "../../packages/envelope-core/src/about";
import { TitleNoteDialog } from "./TitleNoteDialog";
import { cleanAbout } from "./titleNoteData";
import type { FileMenuItem } from "./fileMenu";

const same = (a: About, b: About) => (a.title ?? "") === (b.title ?? "") && (a.note ?? "") === (b.note ?? "");

/**
 * The File menu's "Title and note…" item and its dialog (U34), the same in every editor. The title and note
 * are saved in the editable file and link and never printed. Saving makes one undo step; nothing changes on
 * Cancel. If the page refuses the change (`onSave` returns false or throws), the dialog stays open with what
 * was typed and says why. Pages pass the item to `diagramFileMenu` and render `dialog` anywhere; it shows only
 * while the page is active.
 */
export function useTitleNote(options: {
  about: About;
  active?: boolean;
  disabled?: boolean;
  onSave: (next: About) => boolean | void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  if (open && options.active === false) setOpen(false);
  const close = () => {
    setOpen(false);
    setError("");
  };
  const item: FileMenuItem = { disabled: options.disabled, action: () => setOpen(true) };
  const dialog =
    open && options.active !== false ? (
      <TitleNoteDialog
        about={options.about}
        disabled={options.disabled}
        error={error}
        onCancel={close}
        onSave={(next) => {
          const clean = cleanAbout(next);
          if (same(clean, options.about)) return close();
          try {
            if (options.onSave(clean) === false) return setError("The title and note could not be saved. Check the message on the page.");
          } catch (err) {
            return setError(err instanceof Error ? err.message : String(err));
          }
          close();
        }}
      />
    ) : null;
  return { item, dialog };
}
