import { useState } from "react";
import {
  canonical,
  renderSvg,
  validate,
  type Envelope,
} from "../../packages/number-line-core/src";
import { parseNotation, notationSummary } from "./notation";
import { RatioDialog } from "../ratio-table/RatioDialog";

export function NotationPanel({
  envelope,
  active,
  disabled,
  onPending,
  onApply,
}: {
  envelope: Envelope;
  active: boolean;
  disabled: boolean;
  onPending: (value: boolean) => void;
  onApply: (next: Envelope) => void;
}) {
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState(""),
    [edited, setEdited] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false),
    [range, setRange] = useState(envelope.document.axis);
  const [error, setError] = useState(""),
    [proposed, setProposed] = useState<Envelope | null>(null);
  function cancel() {
    setOpen(false);
    setEdited(false);
    onPending(false);
    setError("");
    setProposed(null);
  }
  function applied(next: Envelope) {
    onApply(next);
    cancel();
  }
  function submit() {
    if (disabled) return;
    try {
      const solution = parseNotation(draft, envelope.document.axis.variable);
      if (solution.kind === envelope.document.solution?.kind)
        solution.id = envelope.document.solution.id;
      const next = validate({
        ...envelope,
        document: {
          ...envelope.document,
          axis: rangeOpen ? range : envelope.document.axis,
          solution,
        },
      });
      setError("");
      if (canonical(next) === canonical(envelope)) {
        cancel();
        return;
      }
      if (envelope.document.solution) setProposed(next);
      else applied(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }
  return (
    <>
      <p className="quick-drawing-summary">
        Drawing:{" "}
        {notationSummary(
          envelope.document.solution,
          envelope.document.axis.variable,
        )}
        {!envelope.document.teaching.solutionVisible &&
          " (hidden in pupil view)"}
      </p>
      {!open ? (
        <button
          disabled={disabled}
          onClick={() => {
            setDraft("");
            setRange(envelope.document.axis);
            setRangeOpen(false);
            setError("");
            setOpen(true);
          }}
        >
          Enter inequality or value
        </button>
      ) : (
        <section
          className="quick-input-panel"
          aria-label="Enter inequality or value"
        >
          <label>
            Inequality or value
            <input
              autoFocus
              aria-label="Inequality or value"
              aria-invalid={!!error}
              aria-describedby="number-notation-help number-notation-error"
              value={draft}
              maxLength={161}
              disabled={disabled}
              onChange={(event) => {
                setDraft(event.target.value);
                setEdited(true);
                onPending(true);
                setError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  cancel();
                }
              }}
            />
          </label>
          <p id="number-notation-help">
            For example: -3 &lt; {envelope.document.axis.variable || "x"} &lt;=
            1. Fractions such as 1/2 are accepted. Use a single interval, ray or
            value; expressions are not solved.
          </p>
          <button
            aria-expanded={rangeOpen}
            disabled={disabled}
            onClick={() => {
              setRangeOpen(!rangeOpen);
              if (!rangeOpen) {
                setEdited(true);
                onPending(true);
              }
            }}
          >
            Edit axis range
          </button>
          {rangeOpen && (
            <div className="quick-input-range">
              {(["minimum", "maximum", "step"] as const).map((key, i) => (
                <label key={key}>
                  {["First tick", "Last tick", "Tick step"][i]}
                  <input
                    aria-label={`Notation ${key}`}
                    value={range[key]}
                    disabled={disabled}
                    onChange={(event) => {
                      setRange({ ...range, [key]: event.target.value });
                      setEdited(true);
                      onPending(true);
                    }}
                  />
                </label>
              ))}
            </div>
          )}
          <p
            id="number-notation-error"
            className="quick-error"
            role={error ? "alert" : undefined}
          >
            {error}
          </p>
          <div className="quick-actions">
            <button
              disabled={disabled || !edited || !draft.trim()}
              onClick={submit}
            >
              Apply drawing
            </button>
            <button onClick={cancel}>Cancel input</button>
          </div>
        </section>
      )}
      {active && proposed && (
        <RatioDialog
          title="Replace current drawing?"
          confirmLabel="Replace current drawing"
          onCancel={() => setProposed(null)}
          onConfirm={() => applied(proposed)}
        >
          <p>
            The solution drawing
            {rangeOpen ? " and the explicitly entered axis range" : ""} will
            change. Your prompt, pupil visibility and answer spaces stay saved.
            You can undo this.
          </p>
          <div
            className="notation-confirm-preview"
            dangerouslySetInnerHTML={{ __html: renderSvg(proposed) }}
          />
        </RatioDialog>
      )}
    </>
  );
}
