import { useState } from "react";
import type { About } from "../../packages/envelope-core/src/about";
import { TitleNoteDialog } from "./TitleNoteDialog";
import { cleanAbout } from "./titleNoteData";
import type { FileMenuItem } from "./fileMenu";

const same = (a: About, b: About) => (a.title ?? "") === (b.title ?? "") && (a.note ?? "") === (b.note ?? "");

/**
 * The File menu's "Title and note…" item and its dialog (U34), the same in every editor. The title and note
 * are saved in the editable file and link and never printed. Saving makes one undo step; nothing changes on
 * Cancel. Pages pass the item to `diagramFileMenu` and render `dialog` anywhere.
 */
export function useTitleNote(options: { about: About; disabled?: boolean; onSave: (next: About) => void }) {
  const [open, setOpen] = useState(false);
  const item: FileMenuItem = { disabled: options.disabled, action: () => setOpen(true) };
  const dialog = open ? (
    <TitleNoteDialog
      about={options.about}
      disabled={options.disabled}
      onCancel={() => setOpen(false)}
      onSave={(next) => {
        setOpen(false);
        const clean = cleanAbout(next);
        if (!same(clean, options.about)) options.onSave(clean);
      }}
    />
  ) : null;
  return { item, dialog };
}
