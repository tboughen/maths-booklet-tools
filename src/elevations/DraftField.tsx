import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

/** Keeps its draft while typing; Enter or leaving applies, Escape restores. */
export function DraftField({ id, label, value, onCommit, disabled, maxLength = 40, inputMode, className, onHistory }: {
  /** With nothing typed, Ctrl+Z / Ctrl+Y go to the diagram's undo; return true when handled. */
  onHistory?: (event: ReactKeyboardEvent<HTMLInputElement>) => boolean;
  id?: string;
  label: string;
  value: string;
  /** Return false to refuse the value: the typed draft stays in the field to correct. */
  onCommit: (value: string) => boolean | void;
  disabled?: boolean;
  maxLength?: number;
  inputMode?: "decimal" | "text";
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);
  const commit = () => {
    if (draft !== value && onCommit(draft) === false) return;
    setEditing(false);
  };
  return (
    <input
      id={id}
      className={className}
      aria-label={label}
      value={draft}
      disabled={disabled}
      maxLength={maxLength}
      inputMode={inputMode}
      onChange={(ev) => {
        setEditing(true);
        setDraft(ev.target.value);
      }}
      onBlur={commit}
      onKeyDown={(ev: ReactKeyboardEvent<HTMLInputElement>) => {
        if (draft === value && onHistory?.(ev)) return;
        if (ev.key === "Enter") {
          ev.preventDefault();
          commit();
        }
        // Escape undoes typing; with nothing typed it passes on, so it closes the options box.
        if (ev.key === "Escape" && draft !== value) {
          ev.preventDefault();
          ev.stopPropagation();
          setDraft(value);
          setEditing(false);
        }
      }}
    />
  );
}
