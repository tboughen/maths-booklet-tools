import { useState } from "react";
import {
  allLabels,
  calculate,
  formatResult,
  measuredLabels,
  methodNames,
  methods,
  nameOf,
  refName,
  saveAnswer,
  warnings,
  type Envelope,
  type Method,
  type Result,
  type Rounding,
} from "../../packages/triangle-core/src";

import {
  calculationContexts,
  printedInputBasis,
  type CalculationContext,
} from "./calculationContext";

const fields: Record<Method, [string, string][]> = {
  "pythagoras-hypotenuse": [
    ["p", "First shorter side p"],
    ["q", "Second shorter side q"],
  ],
  "pythagoras-leg": [
    ["h", "Hypotenuse h"],
    ["p", "Known shorter side p"],
  ],
  "right-side": [
    ["angle", "Reference angle (degrees)"],
    ["known", "Known side length"],
  ],
  "right-angle": [
    ["numerator", "Ratio numerator (side length)"],
    ["denominator", "Ratio denominator (side length)"],
  ],
  "sine-side": [
    ["a", "Known side a"],
    ["A", "Opposite angle A (degrees)"],
    ["B", "Angle B opposite target side b (degrees)"],
  ],
  "sine-angle": [
    ["a", "Known side a"],
    ["A", "Opposite angle A (degrees)"],
    ["b", "Side b opposite target angle B"],
  ],
  "cosine-side": [
    ["b", "Side b"],
    ["c", "Side c"],
    ["A", "Included angle A (degrees)"],
  ],
  "cosine-angle": [
    ["a", "Side a opposite target angle A"],
    ["b", "Side b"],
    ["c", "Side c"],
  ],
  "area-height": [
    ["base", "Base length"],
    ["height", "Perpendicular height"],
  ],
  "height-area": [
    ["area", "Area (square units)"],
    ["base", "Base length"],
  ],
  "area-sine": [
    ["b", "Side b"],
    ["c", "Side c"],
    ["A", "Included angle A (degrees)"],
  ],
  "area-angle": [
    ["b", "Side b"],
    ["c", "Side c"],
    ["area", "Area (square units)"],
  ],
  "angle-sum": [
    ["A", "First angle (degrees)"],
    ["B", "Second angle (degrees)"],
  ],
};
export function MathsPanel({
  e,
  blocked,
  onChange,
  onError,
  selected,
  context,
}: {
  e: Envelope;
  blocked: boolean;
  onChange: (e: Envelope) => void;
  onError: (text: string) => void;
  selected: string | null;
  context?: CalculationContext;
}) {
  const [method, setMethod] = useState<Method>(
      context?.method ?? "pythagoras-hypotenuse",
    ),
    [triangle, setTriangle] = useState(
      context?.triangle ?? e.document.triangles[0].id,
    ),
    [raw, setRaw] = useState<Record<string, string>>({
      knownSide: "H",
      targetSide: "O",
      ratio: "cos",
      ...context?.raw,
    }),
    [results, setResults] = useState<Result[]>([]),
    [resultBasis, setResultBasis] = useState<string | null>(null),
    [error, setError] = useState(""),
    [round, setRound] = useState<Rounding>({ kind: "dp", digits: 1 }),
    [unit, setUnit] = useState<"cm" | "mm" | "m">(context?.unit ?? "cm"),
    [target, setTarget] = useState(context?.target ?? ""),
    [prepared, setPrepared] = useState(context),
    [preparedBasis, setPreparedBasis] = useState(printedInputBasis(e));
  const t =
      e.document.triangles.find((t) => t.id === triangle) ??
      e.document.triangles[0],
    chosen = target || selected || "",
    r = results[0],
    resultStale = results.length > 0 && resultBasis !== printedInputBasis(e);
  const targets = allLabels(e)
    .filter((v) => !context || v.ref === context.target)
    .filter((v) =>
      r?.dimension === "angle"
        ? v.kind === "angle"
        : r?.dimension === "area"
          ? ["caption", "area"].includes(v.kind)
          : ["edge", "height", "caption"].includes(v.kind),
    );
  const targetRef = targets.some((x) => x.ref === chosen)
      ? chosen
      : (targets[0]?.ref ?? ""),
    existing = allLabels(e).find((v) => v.ref === targetRef)?.label;
  const run = () => {
    setError("");
    try {
      if (context && preparedBasis !== printedInputBasis(e))
        throw Error(
          "Diagram givens changed. Reload the selected context before calculating.",
        );
      if (
        (method.startsWith("pythagoras") || method.startsWith("right-")) &&
        !t.rightAt
      )
        throw Error(
          "Select a vertex and designate this triangle's right angle in Shape locks first.",
        );
      const issue = warnings(e).find((x) => x.startsWith("The entered"));
      if (issue)
        throw Error(
          "Correct the inconsistent givens before calculating a value.",
        );
      const units = new Set(
        e.document.edges
          .filter(
            (v) =>
              t.vertices.includes(v.from) &&
              t.vertices.includes(v.to) &&
              v.label.state === "value",
          )
          .map((v) => v.label.unit)
          .filter(Boolean),
      );
      if (units.size > 1 || (units.size === 1 && !units.has(unit)))
        throw Error(
          "Use one consistent length unit. Match the helper unit to the diagram, or explicitly convert the entered givens first.",
        );
      setResults(calculate(method, raw));
      setResultBasis(printedInputBasis(e));
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  const update = (key: string, value: string) => {
    setRaw((v) => ({ ...v, [key]: value }));
    setResults([]);
    setError("");
  };
  function fill() {
    if (context) {
      const next = calculationContexts(e, context.target, t.id).find(
        (c) => c.method === method,
      );
      if (!next) {
        setError("Choose a compatible target and method.");
        return;
      }
      setRaw(next.raw);
      setUnit(next.unit);
      setPrepared(next);
      setPreparedBasis(printedInputBasis(e));
      setResults([]);
      setError("Loaded printed givens. Enter any remaining fields explicitly.");
      return;
    }
    const values = measuredLabels(e, t.id);
    setRaw((v) => ({ ...v, ...values }));
    setResults([]);
    setError(
      "Filled a, b, c, A and B where numerical givens exist. Enter any remaining fields explicitly.",
    );
  }
  return (
    <details className="tr-section" open={context ? true : undefined}>
      <summary>Calculate a value</summary>
      <div className="tr-section-body">
        <p className="tr-note">
          Optional. Values are saved only when you choose a result. Pupil blanks
          stay blank.
        </p>
        <label>
          Triangle
          <select
            value={t.id}
            disabled={blocked || !!context}
            onChange={(ev) => {
              setTriangle(ev.target.value);
              setResults([]);
            }}
          >
            {e.document.triangles.map((t) => (
              <option key={t.id} value={t.id}>
                {t.vertices.map((id) => nameOf(e, id)).join("")}
                {t.role === "outer" ? " (outer)" : ""}
              </option>
            ))}
          </select>
        </label>
        {!context && (
          <p className="tr-note">
            A = {nameOf(e, t.vertices[0])}, B = {nameOf(e, t.vertices[1])}, C ={" "}
            {nameOf(e, t.vertices[2])}. Lower-case a, b, c are opposite those
            vertices.
          </p>
        )}
        {prepared && (
          <div className="tr-context-sources">
            <p className="tr-note">
              Loaded context: {refName(e, prepared.target)} in triangle{" "}
              {t.vertices.map((id) => nameOf(e, id)).join("")}. Values below
              remain editable.
            </p>
            <p className="tr-note">
              Formula letters below use the named input mapping in this list.
            </p>
            <ul>
              {prepared.sources.map((source, i) => (
                <li key={i}>{source}</li>
              ))}
            </ul>
          </div>
        )}
        <label>
          Method
          <select
            value={method}
            disabled={blocked}
            onChange={(ev) => {
              const method = ev.target.value as Method;
              setMethod(method);
              if (context) {
                const next = calculationContexts(e, context.target, t.id).find(
                  (c) => c.method === method,
                );
                if (next) {
                  setRaw(next.raw);
                  setUnit(next.unit);
                  setPrepared(next);
                  setPreparedBasis(printedInputBasis(e));
                }
              }
              setResults([]);
              setError("");
            }}
          >
            {(context
              ? calculationContexts(e, context.target, t.id).map(
                  (c) => c.method,
                )
              : methods
            ).map((k) => (
              <option key={k} value={k}>
                {methodNames[k]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Length unit
          <select
            value={unit}
            disabled={blocked}
            onChange={(ev) => {
              setUnit(ev.target.value as typeof unit);
              setResults([]);
            }}
          >
            <option>cm</option>
            <option>mm</option>
            <option>m</option>
          </select>
        </label>
        <p className="tr-note">
          Enter all lengths in this unit and area in its square unit. Degree
          mode is used throughout.
        </p>
        <button disabled={blocked} onClick={fill}>
          Use numerical diagram givens
        </button>
        {method === "right-side" && (
          <div className="tr-two">
            <label>
              Known side
              <select
                value={raw.knownSide}
                disabled={blocked}
                onChange={(ev) => update("knownSide", ev.target.value)}
              >
                <option value="H">Hypotenuse</option>
                <option value="O">Opposite</option>
                <option value="A">Adjacent</option>
              </select>
            </label>
            <label>
              Target side
              <select
                value={raw.targetSide}
                disabled={blocked}
                onChange={(ev) => update("targetSide", ev.target.value)}
              >
                <option value="O">Opposite</option>
                <option value="A">Adjacent</option>
                <option value="H">Hypotenuse</option>
              </select>
            </label>
          </div>
        )}
        {method === "right-angle" && (
          <label>
            Ratio
            <select
              value={raw.ratio}
              disabled={blocked}
              onChange={(ev) => update("ratio", ev.target.value)}
            >
              <option value="sin">sin: opposite / hypotenuse</option>
              <option value="cos">cos: adjacent / hypotenuse</option>
              <option value="tan">tan: opposite / adjacent</option>
            </select>
          </label>
        )}
        {fields[method].map(([key, title]) => (
          <label key={key}>
            {title}
            <input
              value={raw[key] ?? ""}
              disabled={blocked}
              inputMode="decimal"
              onChange={(ev) => update(key, ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") run();
              }}
            />
          </label>
        ))}
        <button className="tr-primary" disabled={blocked} onClick={run}>
          Calculate possible results
        </button>
        {error && (
          <p role="status" className="tr-error">
            {error}
          </p>
        )}
        {!!results.length && (
          <div className="tr-results">
            {resultStale && (
              <p role="status" className="tr-error">
                Diagram givens changed. Calculate again before saving a result.
              </p>
            )}
            <label>
              Rounding
              <select
                value={round.kind}
                disabled={blocked}
                onChange={(ev) =>
                  setRound((v) => ({
                    ...v,
                    kind: ev.target.value as Rounding["kind"],
                    digits: ev.target.value === "sf" ? 3 : 1,
                  }))
                }
              >
                <option value="dp">Decimal places</option>
                <option value="sf">Significant figures</option>
                <option value="exact">Exact (when available)</option>
              </select>
            </label>
            {round.kind !== "exact" && (
              <label>
                {round.kind === "dp" ? "Decimal places" : "Significant figures"}
                <select
                  value={round.digits}
                  disabled={blocked}
                  onChange={(ev) =>
                    setRound((v) => ({ ...v, digits: Number(ev.target.value) }))
                  }
                >
                  {Array.from(
                    { length: round.kind === "dp" ? 7 : 8 },
                    (_, i) => i + (round.kind === "sf" ? 1 : 0),
                  ).map((i) => (
                    <option key={i}>{i}</option>
                  ))}
                </select>
              </label>
            )}
            {results.length > 1 && (
              <p className="tr-note">
                <strong>Two valid branches.</strong> Choose using an explicit
                condition in the question, not the schematic shape.
              </p>
            )}
            <label>
              Save result to
              <select
                value={targetRef}
                disabled={blocked}
                onChange={(ev) => setTarget(ev.target.value)}
              >
                {targets.map((v) => (
                  <option key={v.ref} value={v.ref}>
                    {refName(e, v.ref)}
                  </option>
                ))}
              </select>
            </label>
            {!targets.length && (
              <p className="tr-note">
                Add a caption in Labels and captions to save an area.
              </p>
            )}
            {results.map((result, i) => {
              let formatted = "";
              try {
                formatted = formatResult(result, round);
              } catch (err) {
                formatted = err instanceof Error ? err.message : String(err);
              }
              const resultUnit =
                result.dimension === "angle"
                  ? "°"
                  : result.dimension === "area"
                    ? `${unit}²`
                    : unit;
              return (
                <div key={i} className="tr-result">
                  <strong>
                    {result.branch}: {formatted} {resultUnit}
                  </strong>
                  <p>{result.formula}</p>
                  <button
                    disabled={
                      blocked ||
                      resultStale ||
                      !targetRef ||
                      (round.kind === "exact" && !result.exact)
                    }
                    onClick={() => {
                      try {
                        if (resultBasis !== printedInputBasis(e))
                          throw Error(
                            "Diagram givens changed. Calculate again before saving a result.",
                          );
                        onChange(
                          saveAnswer(
                            e,
                            targetRef,
                            result,
                            round,
                            resultUnit as "cm",
                            !!(existing?.answer || existing?.state === "value"),
                          ),
                        );
                        setResults([]);
                      } catch (err) {
                        onError(
                          err instanceof Error ? err.message : String(err),
                        );
                      }
                    }}
                  >
                    {existing?.answer
                      ? "Replace saved answer (keep pupil label)"
                      : existing?.state === "value"
                        ? "Save answer for this given (keep pupil label)"
                        : "Save as hidden answer"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </details>
  );
}
