import { useId, useRef, useState } from "react";
import { WORKED_MAX, WORKED_TEXT_MAX, WORKED_WIDTH_MM, workedIssues, type WorkedNote } from "../../packages/envelope-core/src/worked";
import type { FileMenuItem } from "./fileMenu";
import { useMenuDialog } from "./menuDialog";

/** The undo step name for a worked-note change (U8). */
export const WORKED_STEP = "change worked notes";

/** `envelope` with its worked notes replaced; an empty list removes the field from the file. */
export function withWorkedNotes<T extends object>(envelope: T, notes: readonly WorkedNote[]): T {
  const rest = { ...envelope } as T & { worked?: WorkedNote[] };
  delete rest.worked;
  return notes.length ? { ...rest, worked: notes.map((n) => ({ ...n })) } : rest;
}

type Draft = { text: string; x: string; y: string; width: string; leader: boolean; lx: string; ly: string };
const draftOf = (n: WorkedNote): Draft => ({
  text: n.text,
  x: String(n.x),
  y: String(n.y),
  width: String(n.widthMm ?? WORKED_WIDTH_MM),
  leader: !!n.leader,
  lx: String(n.leader?.x ?? n.x),
  ly: String(n.leader?.y ?? n.y),
});
const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

/** The drafts as notes, or the first field problem in words. */
export function notesFromDrafts(drafts: readonly Draft[]): { notes: WorkedNote[]; issue?: string } {
  const notes: WorkedNote[] = [];
  for (const [i, d] of drafts.entries()) {
    const name = `Worked note ${i + 1}`;
    const text = d.text.replace(/\s+/g, " ").trim();
    if (!text) return { notes, issue: `${name} has no text. Type the guidance or remove the note.` };
    const [x, y, width, lx, ly] = [d.x, d.y, d.width, d.lx, d.ly].map(num);
    if (!(x >= 0) || !(y >= 0)) return { notes, issue: `${name} needs a position of 0 mm or more across and down.` };
    if (!(width >= 10 && width <= 200)) return { notes, issue: `${name}'s width must be between 10 and 200 mm.` };
    if (d.leader && (!(lx >= 0) || !(ly >= 0))) return { notes, issue: `${name}'s leader needs an end point of 0 mm or more across and down.` };
    notes.push({ text, x, y, ...(width !== WORKED_WIDTH_MM ? { widthMm: width } : {}), ...(d.leader ? { leader: { x: lx, y: ly } } : {}) });
  }
  return { notes };
}

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
      <input type="number" inputMode="decimal" step="0.5" min={key === "width" ? 10 : 0} value={drafts[i][key]} onChange={(event) => change(i, { [key]: event.target.value })} />
    </label>
  );
  return (
    <div className="word-help-backdrop">
      <section ref={box} role="dialog" aria-modal="true" aria-labelledby={`${id}-heading`} className="word-help-dialog title-note-dialog worked-notes-dialog">
        <h2 id={`${id}-heading`}>Worked notes</h2>
        <p id={`${id}-help`} className="title-note-help">
          Dark-pink guidance printed beside the maths on the answers copy only. Place each note near the step it explains; add a straight leader only if
          it cannot sit right beside it. Positions are millimetres from the top-left corner of the diagram
          {props.size ? `, which is ${Math.round(props.size.width)} × ${Math.round(props.size.height)} mm` : ""}.
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
