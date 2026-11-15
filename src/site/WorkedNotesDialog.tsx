import { useId, useRef, useState } from "react";
import { WORKED_MARGIN_MM, WORKED_MAX, WORKED_TEXT_MAX, WORKED_WIDTH_MM, workedIssues, type WorkedNote } from "../../packages/envelope-core/src/worked";
import { useMenuDialog } from "./menuDialog";
import { draftOf, notesFromDrafts, type Draft } from "./workedNotesData";

/** The "Worked notes" dialog (U116); `useWorkedNotes` opens it. */
export function WorkedNotesDialog(props: {
  notes: readonly WorkedNote[];
  size?: { width: number; height: number };
  disabled?: boolean;
  error?: string;
  onCancel: () => void;
  onSave: (next: WorkedNote[]) => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>(() => props.notes.map(draftOf));
  const box = useRef<HTMLElement>(null);
  const id = useId();
  useMenuDialog(box, props.onCancel);
  const parsed = notesFromDrafts(drafts);
  const issues = parsed.issue ? [parsed.issue] : props.size ? workedIssues(parsed.notes, props.size) : [];
  const change = (i: number, patch: Partial<Draft>) => setDrafts(drafts.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const field = (i: number, key: "x" | "y" | "width" | "lx" | "ly", label: string) => (
    <label className="worked-note-number">
      {label}
      <input type="number" inputMode="decimal" step="0.5" min={key === "width" ? 10 : key === "x" || key === "y" ? -WORKED_MARGIN_MM : 0} value={drafts[i][key]} onChange={(event) => change(i, { [key]: event.target.value })} />
    </label>
  );
  return (
    <div className="word-help-backdrop">
      <section ref={box} role="dialog" aria-modal="true" aria-labelledby={`${id}-heading`} className="word-help-dialog title-note-dialog worked-notes-dialog">
        <h2 id={`${id}-heading`}>Worked notes</h2>
        <p id={`${id}-help`} className="title-note-help">
          Dark-pink guidance printed beside the maths on the answers copy only. Place each note near the step it explains; add a straight leader only if
          it cannot sit right beside it. Positions are millimetres from the top-left corner of the diagram
          {props.size ? `, which is ${Math.round(props.size.width)} × ${Math.round(props.size.height)} mm` : ""}. On a small diagram a note can
          sit in a margin up to {WORKED_MARGIN_MM} mm beside it (a negative position is left of or above it); the answers copy grows to hold it,
          and the diagram stays at its printed size.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!issues.length) props.onSave(parsed.notes);
          }}
        >
          {drafts.length === 0 && <p className="title-note-help">No worked notes yet.</p>}
          {drafts.map((d, i) => (
            <fieldset key={i} className="worked-note">
              <legend>Note {i + 1}</legend>
              <div className="title-note-field">
                <label htmlFor={`${id}-${i}-text`}>Guidance</label>
                <textarea id={`${id}-${i}-text`} value={d.text} rows={2} maxLength={WORKED_TEXT_MAX} onChange={(event) => change(i, { text: event.target.value.replace(/\n/g, " ") })} />
                <small>
                  {d.text.length} of {WORKED_TEXT_MAX} characters
                </small>
              </div>
              <div className="worked-note-row">
                {field(i, "x", "Across (mm)")}
                {field(i, "y", "Down (mm)")}
                {field(i, "width", "Width (mm)")}
              </div>
              <label className="worked-note-check">
                <input type="checkbox" checked={d.leader} onChange={(event) => change(i, { leader: event.target.checked })} /> Straight leader to the maths
              </label>
              {d.leader && (
                <div className="worked-note-row">
                  {field(i, "lx", "Leader ends across (mm)")}
                  {field(i, "ly", "Leader ends down (mm)")}
                </div>
              )}
              <button type="button" onClick={() => setDrafts(drafts.filter((_, j) => j !== i))}>
                Remove note {i + 1}
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            disabled={drafts.length >= WORKED_MAX}
            onClick={() => setDrafts([...drafts, { text: "", x: "2", y: "2", width: String(WORKED_WIDTH_MM), leader: false, lx: "2", ly: "2" }])}
          >
            Add a worked note
          </button>
          {(issues.length > 0 || props.error) && (
            <ul className="title-note-error" role="alert">
              {[...issues, ...(props.error ? [props.error] : [])].map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
          <div className="graph-import-actions">
            <button type="button" onClick={props.onCancel}>
              Cancel
            </button>
            <button type="submit" className="primary-panel-button" disabled={props.disabled || issues.length > 0}>
              Save worked notes
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

