import { Eye, EyeOff, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { equationForObject, formatNumber, parseNumericInput } from "../domain/equations";
import type { Coordinate, GraphObject, StraightObject } from "../domain/types";

interface ObjectInspectorProps {
  object?: GraphObject;
  onUpdate: (object: GraphObject) => void;
  onDelete: () => void;
  onEditEquation: (object: StraightObject) => void;
}

function CoordinateInput({ label, accessibleLabel, value, onChange }: { label: string; accessibleLabel: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="coordinate-input">
      <span>{label}</span>
      <input
        key={`${label}-${value}`}
        aria-label={accessibleLabel}
        defaultValue={formatNumber(value)}
        inputMode="decimal"
        onBlur={(event) => {
          const parsed = parseNumericInput(event.currentTarget.value);
          if (parsed === null) event.currentTarget.value = formatNumber(value);
          else onChange(parsed);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </label>
  );
}

function CoordinateFields({ prefix, value, onChange }: { prefix?: string; value: Coordinate; onChange: (value: Coordinate) => void }) {
  const accessiblePrefix = prefix ?? "Point";
  return (
    <div className="coordinate-fields">
      {prefix && <strong>{prefix}</strong>}
      <CoordinateInput label="x" accessibleLabel={`${accessiblePrefix} x`} value={value.x} onChange={(x) => onChange({ ...value, x })} />
      <CoordinateInput label="y" accessibleLabel={`${accessiblePrefix} y`} value={value.y} onChange={(y) => onChange({ ...value, y })} />
    </div>
  );
}

export function ObjectInspector({ object, onUpdate, onDelete, onEditEquation }: ObjectInspectorProps) {
  if (!object) {
    return (
      <section className="panel-card selection-panel selection-panel--empty">
        <p className="eyebrow">EDIT OBJECT</p>
        <h2>Nothing selected</h2>
        <p>Click a line, segment or cross to change it. Blue handles are editing guides and will not be copied.</p>
      </section>
    );
  }

  if (object.kind === "point") {
    return (
      <section className="panel-card selection-panel">
        <div className="panel-heading"><div><p className="eyebrow">SELECTED OBJECT</p><h2>Point</h2></div><span className="object-kind-icon object-kind-icon--point">×</span></div>
        <CoordinateFields value={object.position} onChange={(position) => onUpdate({ ...object, position })} />
        <button className="danger-button" onClick={onDelete}><Trash2 size={16} />Delete point</button>
      </section>
    );
  }

  const updateEndpoint = (key: "start" | "end", value: Coordinate) => onUpdate({ ...object, [key]: value, equationLabelPosition: undefined });
  return (
    <section className="panel-card selection-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">SELECTED OBJECT</p><h2>{object.display === "segment" ? "Line segment" : "Straight line"}</h2></div>
        <span className="object-kind-icon object-kind-icon--line" />
      </div>
      <p className="selected-equation">{equationForObject(object)}</p>
      <div className="segmented" role="group" aria-label="Object extent">
        <button className={object.display === "segment" ? "active" : ""} aria-pressed={object.display === "segment"} onClick={() => onUpdate({ ...object, display: "segment" })}>Segment</button>
        <button className={object.display === "line" ? "active" : ""} aria-pressed={object.display === "line"} onClick={() => onUpdate({ ...object, display: "line" })}>Line</button>
      </div>
      <div className="endpoint-section">
        <CoordinateFields prefix="Start" value={object.start} onChange={(value) => updateEndpoint("start", value)} />
        <CoordinateFields prefix="End" value={object.end} onChange={(value) => updateEndpoint("end", value)} />
      </div>
      <button className={`visibility-button${object.equationVisible ? " active" : ""}`} onClick={() => onUpdate({ ...object, equationVisible: !object.equationVisible })}>
        {object.equationVisible ? <Eye size={16} /> : <EyeOff size={16} />}
        <span>{object.equationVisible ? "Equation shown" : "Show equation"}</span>
      </button>
      {object.equationVisible && object.equationLabelPosition && (
        <button className="text-action" onClick={() => onUpdate({ ...object, equationLabelPosition: undefined })}><RotateCcw size={14} />Reset label position</button>
      )}
      {object.display === "line" && <button className="secondary-panel-button" onClick={() => onEditEquation(object)}><Pencil size={15} />Edit equation</button>}
      <button className="danger-button" onClick={onDelete}><Trash2 size={16} />Delete {object.display}</button>
    </section>
  );
}
