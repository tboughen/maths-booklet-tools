import { useEffect, useId, useState } from "react";

export function HeadingInput({
  value,
  label,
  inputKey,
  onCommit,
  onPending,
}: {
  value: string;
  label: string;
  inputKey: string;
  onCommit: (value: string) => void;
  onPending: (key: string, value: boolean) => void;
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
  function apply() {
    try {
      const next = draft.trim();
      if (!/^[A-Za-z0-9 _-]{1,12}$/.test(next))
        throw Error(
          "Use a short heading with letters, digits, spaces, underscores or hyphens.",
        );
      onCommit(next);
      setDraft(next);
      setError("");
      onPending(inputKey, false);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The heading cannot be used.",
      );
      onPending(inputKey, true);
    }
  }
  return (
    <label>
      {label}
      <input
        aria-label={label}
        aria-invalid={!!error}
        aria-describedby={error ? id : undefined}
        maxLength={12}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setError("");
          onPending(inputKey, e.target.value !== value);
        }}
        onBlur={apply}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            apply();
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
