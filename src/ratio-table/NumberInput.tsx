import { useEffect, useId, useState } from "react";
import { canonicalNumber } from "../../packages/ratio-table-core/src/numbers";

export function NumberInput({
  value,
  label,
  onCommit,
  onPending,
  inputKey,
  allowEmpty = false,
  onFocus,
  onEnter,
  disabled = false,
}: {
  value: string;
  label: string;
  inputKey: string;
  onCommit: (value: string) => void;
  onPending: (key: string, pending: boolean) => void;
  allowEmpty?: boolean;
  onFocus?: () => void;
  /** Runs after Enter has applied a valid value (for example, to move to the next row). */
  onEnter?: () => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value),
    [error, setError] = useState("");
  const id = useId();
  useEffect(() => {
    setDraft(value);
    setError("");
    onPending(inputKey, false);
  }, [value, inputKey, onPending]);
  useEffect(() => () => onPending(inputKey, false), [inputKey, onPending]);
  function accept() {
    try {
      const canonical =
        allowEmpty && !draft.trim() ? "" : canonicalNumber(draft);
      onCommit(canonical);
      setDraft(canonical);
      setError("");
      onPending(inputKey, false);
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Invalid number.");
      onPending(inputKey, true);
      return false;
    }
  }
  return (
    <label className="ratio-number-field">
      <span className="sr-only">{label}</span>
      <input
        disabled={disabled}
        value={draft}
        inputMode="text"
        aria-label={label}
        aria-invalid={!!error}
        aria-describedby={error ? id : undefined}
        maxLength={32}
        onFocus={onFocus}
        onChange={(e) => {
          setDraft(e.target.value);
          onPending(inputKey, e.target.value !== value);
          try {
            if (!allowEmpty || e.target.value.trim())
              canonicalNumber(e.target.value);
            setError("");
          } catch (failure) {
            setError(
              failure instanceof Error ? failure.message : "Invalid number.",
            );
            onPending(inputKey, true);
          }
        }}
        onBlur={accept}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (accept()) onEnter?.();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setDraft(value);
            setError("");
            onPending(inputKey, false);
          }
        }}
      />
      {error && (
        <small id={id} className="field-error">
          {error}
        </small>
      )}
    </label>
  );
}
