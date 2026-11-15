import { useId, useRef, useState } from "react";
import { useMenuDialog } from "./menuDialog";
import { NOTE_MAX, TITLE_MAX, type About } from "../../packages/envelope-core/src/about";

/** The "Title and note" dialog (U34); `useTitleNote` opens it. */
export function TitleNoteDialog(props: { about: About; disabled?: boolean; error?: string; onCancel: () => void; onSave: (next: About) => void }) {
  const [title, setTitle] = useState(props.about.title ?? "");
  const [note, setNote] = useState(props.about.note ?? "");
  const box = useRef<HTMLElement>(null);
  const id = useId();
  useMenuDialog(box, props.onCancel);
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
