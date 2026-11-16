import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

/** Text field that keeps its draft while typing and commits on Enter or leaving
 * the field; Escape restores the saved text. Invalid numbers are committed as
 * typed so they stay visible with an error and block export. */
export function DraftField({
  id,
  label,
  value,
  onCommit,
  disabled,
  invalid,
  inputMode,
  maxLength,
  className,
}: {
  id?: string;
  label: string;
  value: string;
  onCommit: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  inputMode?: "decimal";
  maxLength: number;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);
  const commit = () => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
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
      aria-invalid={invalid || undefined}
      onChange={(ev) => {
        setEditing(true);
        setDraft(ev.target.value);
      }}
      onBlur={commit}
      onKeyDown={(ev: ReactKeyboardEvent<HTMLInputElement>) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          commit();
        }
        if (ev.key === "Escape") {
          ev.preventDefault();
          ev.stopPropagation();
          setDraft(value);
          setEditing(false);
        }
      }}
    />
  );
}
