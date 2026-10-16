import { useState } from "react";
import {
  construct,
  measuredLabels,
  nameOf,
  type Construction,
  type Envelope,
} from "../../packages/triangle-core/src";
export function ConstructionPanel({
  e,
  blocked,
  onPreview,
  onError,
}: {
  e: Envelope;
  blocked: boolean;
  onPreview: (e: Envelope) => void;
  onError: (text: string) => void;
}) {
  const [method, setMethod] = useState<Construction>("SSS"),
    [triangle, setTriangle] = useState(e.document.triangles[0].id),
    [values, setValues] = useState<Record<string, string>>({});
  const t =
      e.document.triangles.find((t) => t.id === triangle) ??
      e.document.triangles[0],
    fields =
      method === "SSS"
        ? ["a", "b", "c"]
        : method === "SAS"
          ? ["b", "c", "A"]
          : method === "ASA"
            ? ["c", "A", "B"]
            : method === "AAS"
              ? ["c", "A", "C"]
              : ["b", "c"];
  return (
    <details className="tr-section">
      <summary>Construct from measurements</summary>
      <div className="tr-section-body">
        <p className="tr-note">
          Explicitly replace the selected triangle's shape and geometry locks.
          Existing labels and pupil blanks stay as entered. This is proportional
          construction, not a physical scale drawing.
        </p>
        <label>
          Construction triangle
          <select
            value={t.id}
            disabled={blocked}
            onChange={(ev) => setTriangle(ev.target.value)}
          >
            {e.document.triangles.map((t) => (
              <option key={t.id} value={t.id}>
                {t.vertices.map((id) => nameOf(e, id)).join("")}
              </option>
            ))}
          </select>
        </label>
        <p className="tr-note">
          A = {nameOf(e, t.vertices[0])}, B = {nameOf(e, t.vertices[1])}, C ={" "}
          {nameOf(e, t.vertices[2])}. Side a is BC, b is AC, c is AB.
        </p>
        <label>
          Construction
          <select
            disabled={blocked}
            value={method}
            onChange={(ev) => setMethod(ev.target.value as Construction)}
          >
            <option value="SSS">Three sides (SSS)</option>
            <option value="SAS">Two sides and included angle (SAS)</option>
            <option value="ASA">Two angles and included side AB (ASA)</option>
            <option value="AAS">
              Two angles and non-included side AB (AAS)
            </option>
            <option value="right">Perpendicular sides AB and AC</option>
          </select>
        </label>
        <button
          disabled={blocked}
          onClick={() => setValues(measuredLabels(e, t.id))}
        >
          Use numerical diagram givens
        </button>
        {fields.map((key) => (
          <label key={key}>
            {key === "A" || key === "B" || key === "C"
              ? `Angle ${key} (degrees)`
              : `Side ${key}${method === "right" ? (key === "b" ? " (AC)" : " (AB)") : ""}`}
            <input
              inputMode="decimal"
              value={values[key] ?? ""}
              disabled={blocked}
              onChange={(ev) =>
                setValues((v) => ({ ...v, [key]: ev.target.value }))
              }
            />
          </label>
        ))}
        <button
          className="tr-primary"
          disabled={blocked}
          onClick={() => {
            try {
              onPreview(construct(e, t.id, method, values));
            } catch (err) {
              onError(err instanceof Error ? err.message : String(err));
            }
          }}
        >
          Preview constructed shape
        </button>
      </div>
    </details>
  );
}
