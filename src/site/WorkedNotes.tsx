import { useState } from "react";
import type { WorkedNote } from "../../packages/envelope-core/src/worked";
import type { FileMenuItem } from "./fileMenu";
import { WorkedNotesDialog } from "./WorkedNotesDialog";

const same = (a: readonly WorkedNote[], b: readonly WorkedNote[]) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The File menu's "Worked notes…" item and its dialog (U116), the same in every editor with an
 * answers copy. `size` is the answers copy's printed size in mm, for the live fit check. Saving
 * makes one undo step; nothing changes on Cancel. If the page refuses the change, the dialog stays
 * open with what was typed and says why.
 */
export function useWorkedNotes(options: {
  notes: readonly WorkedNote[];
  size?: { width: number; height: number };
  active?: boolean;
  disabled?: boolean;
  onSave: (next: WorkedNote[]) => boolean | void;
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
      <WorkedNotesDialog
        notes={options.notes}
        size={options.size}
        disabled={options.disabled}
        error={error}
        onCancel={close}
        onSave={(next) => {
          if (same(next, options.notes)) return close();
          try {
            if (options.onSave(next) === false) return setError("The worked notes could not be saved. Check the message on the page.");
          } catch (err) {
            return setError(err instanceof Error ? err.message : String(err));
          }
          close();
        }}
      />
    ) : null;
  return { item, dialog };
}
