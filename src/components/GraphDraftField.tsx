import { parseNumericInput } from "../domain/equations";
import type { GraphDrafts } from "./useGraphDrafts";
/** Drafts belong to the editor, not to an input that selection could unmount. */
export function GraphDraftField({
  id,
  label,
  displayLabel,
  value,
  drafts,
  onApply,
  disabled = false,
}: {
  id: string;
  label: string;
  displayLabel?: string;
  value: string;
  drafts: GraphDrafts;
  onApply: (value: number) => void;
  disabled?: boolean;
}) {
  const entry = drafts.entries[id];
  const apply = () => {
    if (!entry) return;
    try {
      const parsed = parseNumericInput(entry.text);
      if (parsed === null) throw Error("Enter a valid number or fraction.");
      onApply(parsed);
      drafts.cancel(id);
    } catch (e) {
      drafts.change(id, {
        text: entry.text,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  };
  return (
    <div className="graph-draft-field">
      <label className="coordinate-input">
        <span>{displayLabel ?? label}</span>
        <input
          aria-label={label}
          inputMode="decimal"
          value={entry?.text ?? value}
          aria-invalid={!!entry?.error}
          aria-describedby={entry?.error ? `${id}-error` : undefined}
          disabled={disabled || (drafts.pending && !entry)}
          onChange={(e) => drafts.edit(id, e.target.value, value)}
          onBlur={(event) => {
            if (
              event.relatedTarget instanceof HTMLElement &&
              event.relatedTarget.closest("[data-graph-draft-controls]")
            )
              return;
            apply();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              drafts.cancel(id);
            }
          }}
        />
      </label>
      {entry?.error && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {entry.error}
        </p>
      )}
      {entry && (
        <div className="graph-draft-actions" data-graph-draft-controls>
          <button onMouseDown={(e) => e.preventDefault()} onClick={apply}>
            Apply
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => drafts.cancel(id)}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
