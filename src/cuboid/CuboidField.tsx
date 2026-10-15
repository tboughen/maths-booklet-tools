import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
export type FieldHandle = { apply: () => boolean; cancel: () => void };
export function CuboidField({
  label,
  value,
  onApply,
  pending,
  disabled = false,
  controlRef,
  onApplied,
  onCancelled,
}: {
  label: string;
  value: string | number;
  onApply: (v: string) => void;
  pending: (label: string, dirty: boolean) => void;
  disabled?: boolean;
  controlRef?: Ref<FieldHandle>;
  onApplied?: () => void;
  onCancelled?: () => void;
}) {
  const [draft, setDraft] = useState(String(value)),
    [error, setError] = useState("");
  const committed = useRef(String(value)),
    skipBlur = useRef(false);
  useEffect(() => {
    committed.current = String(value);
    setDraft(String(value));
    setError("");
    pending(label, false);
  }, [value, label, pending]);
  function apply() {
    if (draft === committed.current && !error) return true;
    try {
      onApply(draft);
      setError("");
      pending(label, false);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      pending(label, true);
      return false;
    }
  }
  function cancel() {
    skipBlur.current = true;
    setDraft(committed.current);
    setError("");
    pending(label, false);
  }
  useImperativeHandle(controlRef, () => ({ apply, cancel }));
  return (
    <label className="cb-field">
      {label}
      <input
        aria-label={label}
        value={draft}
        disabled={disabled}
        aria-invalid={!!error}
        onChange={(e) => {
          setDraft(e.target.value);
          pending(label, true);
        }}
        onBlur={() => {
          // Floating edits commit only through Apply/Enter, so Cancel also
          // discards a valid draft when focus moves to its button.
          if (controlRef) return;
          if (skipBlur.current) {
            skipBlur.current = false;
            return;
          }
          apply();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (apply()) onApplied?.();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            cancel();
            onCancelled?.();
            e.currentTarget.blur();
          }
        }}
      />
      {error && (
        <span className="cb-error" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
