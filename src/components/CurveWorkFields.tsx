import { useState } from "react";
import { Spline } from "lucide-react";
import type { CurveObject, FunctionObject, GraphObject } from "../domain/types";
import { parseNumericInput } from "../../packages/graph-core/src/equations";
import { stripObjects, tangentObject } from "../../packages/graph-core/src/working";

/**
 * Working on a graph through points or an equation curve (tangents, area under a graph): a tangent at
 * an x value, or equal trapezium strips. Each is added as ordinary objects in one undo step and is
 * a hidden answer unless the teacher unticks it, so nothing is drawn for pupils unless asked.
 */
export function CurveWorkFields({
  object,
  span,
  unitsPerSquare,
  base,
  onAdd,
  makeId,
  disabled,
}: {
  object: CurveObject | FunctionObject;
  /** The grid's x range, for an equation curve with no from or to. */
  span?: { from: number; to: number };
  unitsPerSquare: number;
  /** The y value of the x-axis, where strips stand. */
  base: number;
  onAdd: (objects: GraphObject[]) => void;
  makeId: (prefix: "polygon" | "straight") => string;
  disabled?: boolean;
}) {
  const first = object.kind === "curve" ? object.points[0].x : object.from ?? span?.from ?? 0;
  const last = object.kind === "curve" ? object.points[object.points.length - 1].x : object.to ?? span?.to ?? first + 4 * unitsPerSquare;
  const [x, setX] = useState(String(Number(((first + last) / 2).toFixed(3))));
  const [from, setFrom] = useState(String(Math.min(first, last)));
  const [to, setTo] = useState(String(Math.max(first, last)));
  const [count, setCount] = useState("4");
  const [answerOnly, setAnswerOnly] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const number = (text: string, what: string) => {
    const v = parseNumericInput(text);
    if (v === null) throw Error(`Type a number for ${what}.`);
    return v;
  };
  const run = (make: () => GraphObject[]) => {
    try {
      const made = make();
      setError(null);
      onAdd(made);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message[0].toUpperCase() + message.slice(1));
    }
  };
  const input = (label: string, value: string, set: (v: string) => void) => (
    <label className="transform-field">
      <span>{label}</span>
      <input type="text" disabled={disabled} value={value} style={{ width: "4.5em" }} onChange={(e) => { set(e.target.value); setError(null); }} />
    </label>
  );
  return (
    <fieldset className="transform-fields" disabled={disabled}>
      <legend>Working on this graph</legend>
      <div className="transform-row">
        {input("Tangent at x", x, setX)}
        <button
          className="secondary-panel-button"
          onClick={() => run(() => [tangentObject(object, number(x, "x"), 2 * unitsPerSquare, { id: makeId("straight"), answerOnly })])}
        >
          <Spline size={15} />
          Draw tangent
        </button>
      </div>
      <div className="transform-row">
        {input("Strips from", from, setFrom)}
        {input("to", to, setTo)}
        {input("Strips", count, setCount)}
      </div>
      <button
        className="secondary-panel-button"
        onClick={() =>
          run(() => {
            const n = Number(count);
            if (!Number.isInteger(n) || n < 1 || n > 10) throw Error("Use 1 to 10 strips.");
            return stripObjects(object, number(from, "the start"), number(to, "the end"), n, base, { id: () => makeId("polygon"), shaded: true, answerOnly });
          })
        }
      >
        Draw strips
      </button>
      <label className="checkbox-row">
        <input type="checkbox" checked={answerOnly} onChange={(e) => setAnswerOnly(e.target.checked)} /> Answer only: hidden on the pupil copy
      </label>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <p className="panel-note">A tangent is a segment: select it to add a gradient triangle.</p>
    </fieldset>
  );
}
