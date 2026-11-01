import { useRef, useState } from "react";
import {
  canonical,
  renderSvg,
  validate,
  type Envelope,
} from "../../packages/number-line-core/src";
import { offerWidening, parseNotation, notationSummary } from "./notation";
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
  const [open, setOpen] = useState(true),
    [draft, setDraft] = useState(""),
    [edited, setEdited] = useState(false);
  // When a drawing does not fit, the smallest widening that shows it, offered as an explicit action.
  // Only the first and last tick are kept, with the axis they were worked out from: if the axis
  // changes meanwhile (Scale card, Undo), the offer is withdrawn rather than reapplying old settings.
  const [offer, setFit] = useState<{
    from: string;
    minimum: string;
    maximum: string;
  } | null>(null);
  const axisKey = JSON.stringify(envelope.document.axis);
  const fit = offer?.from === axisKey ? offer : null;
  const [error, setError] = useState(""),
    [proposed, setProposed] = useState<Envelope | null>(null);
  const field = useRef<HTMLInputElement>(null);
  function cancelInput() {
    cancel();
    // Cancel input disables itself, so keep keyboard focus in the field.
    field.current?.focus();
  }
  function cancel() {
    setOpen(true);
    setDraft("");
    setFit(null);
    setEdited(false);
    onPending(false);
    setError("");
    setProposed(null);
  }
  function applied(next: Envelope) {
    onApply(next);
    cancel();
  }
  function submit(widen: typeof fit = null) {
    if (disabled) return;
    const axis = widen
      ? {
          ...envelope.document.axis,
          minimum: widen.minimum,
          maximum: widen.maximum,
        }
      : envelope.document.axis;
    let solution;
    try {
      solution = parseNotation(draft, envelope.document.axis.variable);
      if (solution.kind === envelope.document.solution?.kind)
        solution.id = envelope.document.solution.id;
      const next = validate({
        ...envelope,
        document: { ...envelope.document, axis, solution },
      });
      setError("");
      // Keep a widening on offer while its confirmation is open, so Cancel can be retried.
      setFit(widen);
      if (canonical(next) === canonical(envelope)) {
        cancel();
        return;
      }
      if (envelope.document.solution) setProposed(next);
      else applied(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      // Offer a widening only when it would make this exact drawing valid.
      const wider =
        solution && !widen ? offerWidening(envelope, solution) : null;
      setFit(wider && { from: axisKey, ...wider });
    }
  }
  const axisChanged =
    !!proposed &&
    JSON.stringify(proposed.document.axis) !==
      JSON.stringify(envelope.document.axis);
  return (
    <>
      <p className="quick-drawing-summary">
        Current drawing:{" "}
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
            setFit(null);
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
              ref={field}
              placeholder="-3 < x <= 1"
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
                setFit(null);
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
          <p
            id="number-notation-error"
            className="quick-error"
            role={error ? "alert" : undefined}
          >
            {error}
            {fit && " Or use Widen the line to fit, below."}
          </p>
          {fit && (
            <button
              className="quick-fit"
              disabled={disabled}
              onClick={() => submit(fit)}
            >
              Widen the line to fit (first tick {fit.minimum}, last tick{" "}
              {fit.maximum})
            </button>
          )}
          <div className="quick-actions">
            <button
              disabled={disabled || !edited || !draft.trim()}
              onClick={() => submit()}
            >
              Apply drawing
            </button>
            <button disabled={!edited && !error} onClick={cancelInput}>
              Cancel input
            </button>
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
            {axisChanged ? " and the widened axis range" : ""} will change. Your
            prompt, pupil visibility and answer spaces stay saved. You can undo
            this.
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
