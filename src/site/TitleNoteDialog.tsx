import { useEffect, useId, useRef, useState } from "react";
import { NOTE_MAX, TITLE_MAX, type About } from "../../packages/envelope-core/src/about";

/** The "Title and note" dialog (U34); `useTitleNote` opens it. */
export function TitleNoteDialog(props: { about: About; disabled?: boolean; error?: string; onCancel: () => void; onSave: (next: About) => void }) {
  const [title, setTitle] = useState(props.about.title ?? "");
  const [note, setNote] = useState(props.about.note ?? "");
  const box = useRef<HTMLElement>(null);
  const id = useId();
  const cancel = useRef(props.onCancel);
  cancel.current = props.onCancel;
  useEffect(() => {
    const previous = document.activeElement;
    // After the File menu has closed and handed focus back, so the title field keeps it.
    const start = window.setTimeout(() => box.current?.querySelector<HTMLInputElement>("input")?.focus());
    function keys(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        cancel.current();
      }
      if (event.key !== "Tab") return;
      const controls = box.current?.querySelectorAll<HTMLElement>("input, textarea, button:not(:disabled)");
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
  }, []);
  return (
    <div className="word-help-backdrop">
      <section ref={box} role="dialog" aria-modal="true" aria-labelledby={`${id}-heading`} className="word-help-dialog title-note-dialog">
        <h2 id={`${id}-heading`}>Title and note</h2>
        <p id={`${id}-help`} className="title-note-help">
          Saved in the editable file and link, for you. Never printed on the resource.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            props.onSave({ title, note });
          }}
        >
          <div className="title-note-field">
            <label htmlFor={`${id}-title`}>Title</label>
            <input id={`${id}-title`} value={title} maxLength={TITLE_MAX} aria-describedby={`${id}-help ${id}-title-count`} onChange={(event) => setTitle(event.target.value)} />
            <small id={`${id}-title-count`}>
              {title.length} of {TITLE_MAX} characters
            </small>
          </div>
          <div className="title-note-field">
            <label htmlFor={`${id}-note`}>Note</label>
            <textarea id={`${id}-note`} value={note} rows={5} maxLength={NOTE_MAX} aria-describedby={`${id}-note-count`} onChange={(event) => setNote(event.target.value)} />
            <small id={`${id}-note-count`}>
              {note.length} of {NOTE_MAX} characters
            </small>
          </div>
          {props.error && (
            <p className="title-note-error" role="alert">
              {props.error}
            </p>
          )}
          <div className="graph-import-actions">
            <button type="button" onClick={props.onCancel}>
              Cancel
            </button>
            <button type="submit" className="primary-panel-button" disabled={props.disabled}>
              Save title and note
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
