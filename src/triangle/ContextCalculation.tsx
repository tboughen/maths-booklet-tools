import { useState } from "react";
import { methodNames, type Envelope } from "../../packages/triangle-core/src";
import {
  calculationContexts,
  type CalculationContext,
} from "./calculationContext";
import { objectName, owningTriangles, triangleName } from "./interaction";
import { MathsPanel } from "./MathsPanel";

export function ContextCalculation({
  e,
  target,
  blocked,
  onClose,
  onChange,
  onError,
}: {
  e: Envelope;
  target: string;
  blocked: boolean;
  onClose: () => void;
  onChange: (e: Envelope) => void;
  onError: (s: string) => void;
}) {
  const owners = owningTriangles(e, target);
  const [triangle, setTriangle] = useState(
    owners.length === 1 ? owners[0].id : "",
  );
  const [method, setMethod] = useState("");
  const [loaded, setLoaded] = useState<{
    context: CalculationContext;
    serial: number;
  } | null>(null);
  const candidates = triangle ? calculationContexts(e, target, triangle) : [];
  const chosen = candidates.find((c) => c.method === method) ?? candidates[0];
  return (
    <section
      className="panel-card tr-panel tr-context-calculation"
      aria-label="Calculate selected value"
    >
      <h2>
        Calculate {objectName(e, target).replace(/^./, (c) => c.toLowerCase())}
      </h2>
      <p className="tr-note">
        Choose a triangle and method, then load its printed numerical givens.
        Drawn proportions and hidden answers are never inputs.
      </p>
      <label>
        Calculation triangle
        <select
          value={owners.some((t) => t.id === triangle) ? triangle : ""}
          disabled={blocked}
          onChange={(ev) => {
            setTriangle(ev.target.value);
            setMethod("");
          }}
        >
          <option value="">Choose the triangle</option>
          {owners.map((t) => (
            <option key={t.id} value={t.id}>
              {triangleName(e, t.id)}
              {t.role === "outer" ? " (outer)" : ""}
            </option>
          ))}
        </select>
      </label>
      {chosen && (
        <>
          <label>
            Suggested method
            <select
              value={chosen.method}
              disabled={blocked}
              onChange={(ev) => setMethod(ev.target.value)}
            >
              {candidates.map((c) => (
                <option key={c.method} value={c.method}>
                  {methodNames[c.method]}
                  {c.missing.length
                    ? ` — ${c.missing.length} inputs needed`
                    : " — givens available"}
                </option>
              ))}
            </select>
          </label>
          <p className="tr-note">
            {chosen.missing.length
              ? `Enter remaining fields: ${chosen.missing.join(", ")}.`
              : "Inputs are available. Calculate explicitly, then choose whether to save a hidden answer."}
          </p>
          <button
            disabled={blocked}
            onClick={() =>
              setLoaded({ context: chosen, serial: (loaded?.serial ?? 0) + 1 })
            }
          >
            {loaded
              ? "Reload selected context (replace helper inputs)"
              : "Load selected context"}
          </button>
        </>
      )}
      {!triangle && (
        <p className="tr-note" role="status">
          This target can belong to more than one triangle. Choose which
          triangle to use.
        </p>
      )}
      {loaded && (
        <MathsPanel
          key={loaded.serial}
          e={e}
          blocked={blocked}
          onChange={onChange}
          onError={onError}
          selected={target}
          context={loaded.context}
        />
      )}
      <button disabled={blocked} onClick={onClose}>
        Close calculation
      </button>
    </section>
  );
}
