import { useEffect, useState } from "react";
export function Field({
  label,
  value,
  onCommit,
  onPending,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  onPending: (pending: boolean) => void;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState(value),
    [error, setError] = useState("");
  useEffect(() => {
    setDraft(value);
    setError("");
  }, [value]);
  function commit() {
    if (draft === value) {
      onPending(false);
      setError("");
      return;
    }
    try {
      onCommit(draft);
      setError("");
      onPending(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check this value.");
      onPending(true);
    }
  }
  function cancel() {
    setDraft(value);
    setError("");
    onPending(false);
  }
  return (
    <div className="vg-field">
      <label>
        <span>{label}</span>
        <input
          aria-label={label}
          value={draft}
          aria-invalid={!!error}
          autoFocus={autoFocus}
          onChange={(e) => {
            setDraft(e.target.value);
            onPending(true);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              cancel();
            }
          }}
        />
      </label>
      {(draft !== value || error) && (
        <div className="vg-actions">
          <button onMouseDown={(e) => e.preventDefault()} onClick={commit}>
            Apply
          </button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={cancel}>
            Cancel
          </button>
        </div>
      )}
      {error && (
        <span className="vg-field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
