import { useEffect, useRef, useState, type KeyboardEvent } from "react";

/**
 * A text field in an options box that commits when it loses focus or on Enter (Shift+Enter starts a new line in
 * a member list). Each commit is one undo step. A refused value stays in the field, marked, until it is fixed.
 * Escape puts the saved value back without committing (and the box then closes).
 */
export function LiveText({
  label,
  value,
  multiline,
  invalid,
  onCommit,
  onRevert,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  invalid?: boolean;
  /** False when the value was refused: the typed text then stays in the field. */
  onCommit: (text: string) => boolean;
  /** Escape put the saved value back: clear any error shown for the refused value. */
  onRevert?: () => void;
}) {
  const [text, setText] = useState(value);
  const [editing, setEditing] = useState(false);
  const reverted = useRef(false);
  useEffect(() => {
    if (!editing) setText(value);
  }, [value, editing]);
  const done = () => {
    if (reverted.current) {
      reverted.current = false;
      return;
    }
    if (!editing) return;
    if (text === value || onCommit(text)) setEditing(false);
  };
  const revert = (ev: KeyboardEvent) => {
    if (ev.key !== "Escape") return false;
    reverted.current = true;
    setText(value);
    setEditing(false);
    onRevert?.();
    return true;
  };
  const shared = {
    "aria-label": label,
    "aria-invalid": invalid || undefined,
    value: text,
    onBlur: done,
  };
  return multiline ? (
    <textarea
      {...shared}
      rows={3}
      onChange={(ev) => {
        reverted.current = false;
        setEditing(true);
        setText(ev.target.value);
      }}
      onKeyDown={(ev) => {
        if (revert(ev)) return;
        if (ev.key === "Enter" && !ev.shiftKey) {
          ev.preventDefault();
          done();
        }
      }}
    />
  ) : (
    <input
      {...shared}
      onChange={(ev) => {
        reverted.current = false;
        setEditing(true);
        setText(ev.target.value);
      }}
      onKeyDown={(ev) => {
        if (revert(ev)) return;
        if (ev.key === "Enter") {
          ev.preventDefault();
          done();
        }
      }}
    />
  );
}
