import { useEffect, useRef, useState } from "react";
export function CuboidField({
  label,
  value,
  onApply,
  pending,
  disabled = false,
}: {
  label: string;
  value: string | number;
  onApply: (v: string) => void;
  pending: (label: string, dirty: boolean) => void;
  disabled?: boolean;
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
    if (draft === committed.current && !error) return;
    try {
      onApply(draft);
      setError("");
      pending(label, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      pending(label, true);
    }
  }
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
          if (skipBlur.current) {
            skipBlur.current = false;
            return;
          }
          apply();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            apply();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            skipBlur.current = true;
            setDraft(committed.current);
            setError("");
            pending(label, false);
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
