import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { equationFromPoints, parseNumericInput } from "../domain/equations";
import type { LineEquation } from "../domain/equations";
import type { StraightObject } from "../domain/types";

interface EquationPanelProps {
  editing?: StraightObject;
  onSubmit: (equation: LineEquation, showEquation: boolean) => void;
  onClose: () => void;
  onPending: (pending: boolean) => void;
  disabled?: boolean;
}

export function EquationPanel({
  editing,
  onSubmit,
  onClose,
  onPending,
  disabled = false,
}: EquationPanelProps) {
  const existing = editing
    ? equationFromPoints(editing.start, editing.end)
    : null;
  const [mode, setMode] = useState<"slope" | "vertical">(
    existing?.kind ?? "slope",
  );
  const [slope, setSlope] = useState(
    existing?.kind === "slope" ? String(existing.slope) : "1",
  );
  const [intercept, setIntercept] = useState(
    existing?.kind === "slope" ? String(existing.intercept) : "0",
  );
  const [verticalX, setVerticalX] = useState(
    existing?.kind === "vertical" ? String(existing.x) : "0",
  );
  const [showEquation, setShowEquation] = useState(
    editing?.equationVisible ?? true,
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const changed = () => {
    setPending(true);
    onPending(true);
    setError("");
  };

  useEffect(() => {
    const next = editing
      ? equationFromPoints(editing.start, editing.end)
      : null;
    setMode(next?.kind ?? "slope");
    if (next?.kind === "slope") {
      setSlope(String(next.slope));
      setIntercept(String(next.intercept));
    } else if (next?.kind === "vertical") setVerticalX(String(next.x));
    setShowEquation(editing?.equationVisible ?? true);
    setError("");
  }, [editing]);

  function submit() {
    if (disabled) return;
    if (mode === "vertical") {
      const x = parseNumericInput(verticalX);
      if (x === null) {
        setError("Enter a valid number or fraction for x.");
        return;
      }
      onPending(false);
      onSubmit({ kind: "vertical", x }, showEquation);
      return;
    }
    const parsedSlope = parseNumericInput(slope);
    const parsedIntercept = parseNumericInput(intercept);
    if (parsedSlope === null || parsedIntercept === null) {
      setError("Enter valid numbers or fractions for m and c.");
      return;
    }
    onPending(false);
    onSubmit(
      { kind: "slope", slope: parsedSlope, intercept: parsedIntercept },
      showEquation,
    );
  }

  return (
    <section
      className="panel-card equation-panel"
      aria-labelledby="equation-panel-title"
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
          e.preventDefault();
          submit();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{editing ? "EDIT SELECTED" : "ADD OBJECT"}</p>
          <h2 id="equation-panel-title">
            {editing ? "Edit line equation" : "Line by equation"}
          </h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close equation panel"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <div
        className="segmented equation-modes"
        role="group"
        aria-label="Equation form"
      >
        <button
          className={mode === "slope" ? "active" : ""}
          disabled={disabled || pending}
          onClick={() => setMode("slope")}
        >
          y = mx + c
        </button>
        <button
          className={mode === "vertical" ? "active" : ""}
          disabled={disabled || pending}
          onClick={() => setMode("vertical")}
        >
          x = a
        </button>
      </div>
      {mode === "slope" ? (
        <div className="equation-fields">
          <span className="math-prefix">y =</span>
          <label>
            <span className="sr-only">Gradient m</span>
            <input
              value={slope}
              aria-invalid={!!error}
              aria-describedby={error ? "graph-equation-error" : undefined}
              disabled={disabled}
              onChange={(event) => {
                setSlope(event.target.value);
                changed();
              }}
              inputMode="decimal"
              aria-label="Gradient m"
            />
            <small>m</small>
          </label>
          <span className="math-symbol">x +</span>
          <label>
            <span className="sr-only">Intercept c</span>
            <input
              value={intercept}
              aria-invalid={!!error}
              aria-describedby={error ? "graph-equation-error" : undefined}
              disabled={disabled}
              onChange={(event) => {
                setIntercept(event.target.value);
                changed();
              }}
              inputMode="decimal"
              aria-label="Intercept c"
            />
            <small>c</small>
          </label>
        </div>
      ) : (
        <div className="equation-fields equation-fields--vertical">
          <span className="math-prefix">x =</span>
          <label>
            <span className="sr-only">Value a</span>
            <input
              value={verticalX}
              aria-invalid={!!error}
              aria-describedby={error ? "graph-equation-error" : undefined}
              disabled={disabled}
              onChange={(event) => {
                setVerticalX(event.target.value);
                changed();
              }}
              inputMode="decimal"
              aria-label="Value a"
            />
            <small>a</small>
          </label>
        </div>
      )}
      <label className="check-row">
        <input
          type="checkbox"
          checked={showEquation}
          disabled={disabled}
          onChange={(event) => {
            setShowEquation(event.target.checked);
            changed();
          }}
        />
        <span>Show equation on the diagram</span>
      </label>
      {error && (
        <p id="graph-equation-error" className="field-error" role="alert">
          {error}
        </p>
      )}
      <button
        disabled={disabled}
        className="primary-panel-button"
        onClick={submit}
      >
        <Plus size={17} />
        {editing ? "Update selected line" : "Add line"}
      </button>
      <button
        className="secondary-panel-button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClose}
      >
        Cancel equation edit
      </button>
      <p className="panel-note">Fractions such as 1/2 are accepted.</p>
    </section>
  );
}
