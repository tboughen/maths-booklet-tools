import { GraphDraftField } from "./GraphDraftField";
import type { GraphDrafts } from "./useGraphDrafts";
import { Eye, EyeOff, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { equationForObject, formatNumber } from "../domain/equations";
import type { Coordinate, GraphObject, StraightObject } from "../domain/types";
import {
  OBJECT_NAME_PATTERN,
  normaliseObjectName,
} from "../../packages/graph-core/src/axes";

/** The exam-style name printed beside the object, and whether it is a hidden answer. */
function NameAndAnswer({
  object,
  onUpdate,
  drafts,
  disabled,
}: {
  object: GraphObject;
  onUpdate: (object: GraphObject) => void;
  drafts: GraphDrafts;
  disabled?: boolean;
}) {
  const kind = object.kind === "point" ? "point" : "line";
  return (
    <div className="object-name-fields">
      <GraphDraftField
        id={object.id + "-name"}
        label={`Name printed beside the ${kind}`}
        displayLabel="Name"
        inputMode="text"
        hint={kind === "point" ? "For example A, B or P′" : "For example L, L1 or L2"}
        value={object.name ?? ""}
        drafts={drafts}
        disabled={disabled}
        onApplyText={(text) => {
          const name = normaliseObjectName(text);
          if (!name) {
            const next = { ...object };
            delete next.name;
            delete next.namePosition;
            onUpdate(next);
            return;
          }
          if (!OBJECT_NAME_PATTERN.test(name))
            throw Error("Use a capital letter, with an optional ′ and number: A, B′, L1.");
          onUpdate({ ...object, name });
        }}
      />
      {object.name && object.namePosition && (
        <button
          disabled={disabled || drafts.pending}
          className="text-action"
          onClick={() => {
            const next = { ...object };
            delete next.namePosition;
            onUpdate(next);
          }}
        >
          <RotateCcw size={14} />
          Reset name position
        </button>
      )}
      {object.kind === "point" && (
        <label className="point-coordinates-field">
          Coordinates
          <select
            aria-label="Coordinates printed after the point"
            disabled={disabled || drafts.pending}
            value={object.coordinates ?? "none"}
            onChange={(event) => {
              const next = { ...object };
              const value = event.target.value;
              if (value === "show" || value === "blank") next.coordinates = value;
              else delete next.coordinates;
              onUpdate(next);
            }}
          >
            <option value="none">None</option>
            <option value="show">Show, as A(2, 3)</option>
            <option value="blank">Blank for pupils, answer on the answers copy</option>
          </select>
        </label>
      )}
      <button
        disabled={disabled || drafts.pending}
        className={`visibility-button${object.answerOnly ? " active" : ""}`}
        aria-pressed={!!object.answerOnly}
        onClick={() => {
          const next = { ...object };
          if (object.answerOnly) delete next.answerOnly;
          else next.answerOnly = true;
          onUpdate(next);
        }}
      >
        {object.answerOnly ? <EyeOff size={16} /> : <Eye size={16} />}
        <span>
          {object.answerOnly
            ? "Answer only: hidden on the pupil copy"
            : "On the pupil copy"}
        </span>
      </button>
    </div>
  );
}

interface ObjectInspectorProps {
  object?: GraphObject;
  onUpdate: (object: GraphObject) => void;
  onDelete: () => void;
  drafts: GraphDrafts;
  disabled?: boolean;
  onEditEquation: (object: StraightObject) => void;
}

function CoordinateFields({
  prefix,
  value,
  onChange,
  drafts,
  objectId,
  disabled,
}: {
  prefix?: string;
  value: Coordinate;
  onChange: (value: Coordinate) => void;
  drafts: GraphDrafts;
  objectId: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={`coordinate-fields${prefix ? "" : " coordinate-fields--point"}`}
    >
      {prefix && <strong>{prefix}</strong>}
      {(["x", "y"] as const).map((axis) => (
        <GraphDraftField
          key={axis}
          id={objectId + "-" + (prefix ?? "point") + "-" + axis}
          displayLabel={axis}
          label={(prefix ?? "Point") + " " + axis}
          value={formatNumber(value[axis])}
          drafts={drafts}
          disabled={disabled}
          onApply={(next) => onChange({ ...value, [axis]: next })}
        />
      ))}
    </div>
  );
}

export function ObjectInspector({
  object,
  onUpdate,
  onDelete,
  onEditEquation,
  drafts,
  disabled = false,
}: ObjectInspectorProps) {
  if (!object) {
    return (
      <section className="panel-card selection-panel selection-panel--empty">
        <p className="eyebrow">EDIT OBJECT</p>
        <h2>Nothing selected</h2>
        <p>
          Click a line, segment or cross to change it. Blue handles are editing
          guides and will not be copied.
        </p>
      </section>
    );
  }

  if (object.kind === "point") {
    return (
      <section className="panel-card selection-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">SELECTED OBJECT</p>
            <h2>Point</h2>
          </div>
        </div>
        <CoordinateFields
          drafts={drafts}
          objectId={object.id}
          disabled={disabled}
          value={object.position}
          onChange={(position) => onUpdate({ ...object, position })}
        />
        <NameAndAnswer
          object={object}
          onUpdate={onUpdate}
          drafts={drafts}
          disabled={disabled}
        />
        <button
          disabled={disabled || drafts.pending}
          className="danger-button"
          onClick={onDelete}
        >
          <Trash2 size={16} />
          Delete point
        </button>
      </section>
    );
  }

  const updateEndpoint = (key: "start" | "end", value: Coordinate) =>
    onUpdate({ ...object, [key]: value, equationLabelPosition: undefined });
  return (
    <section className="panel-card selection-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">SELECTED OBJECT</p>
          <h2>
            {object.display === "segment" ? "Line segment" : "Straight line"}
          </h2>
        </div>
      </div>
      <p className="selected-equation">{equationForObject(object)}</p>
      <div className="segmented" role="group" aria-label="Object extent">
        <button
          disabled={disabled || drafts.pending}
          className={object.display === "segment" ? "active" : ""}
          aria-pressed={object.display === "segment"}
          onClick={() => onUpdate({ ...object, display: "segment" })}
        >
          Segment
        </button>
        <button
          disabled={disabled || drafts.pending}
          className={object.display === "line" ? "active" : ""}
          aria-pressed={object.display === "line"}
          onClick={() => onUpdate({ ...object, display: "line" })}
        >
          Line
        </button>
      </div>
      <div className="line-style-field">
        <span>Line style</span>
        <div className="segmented" role="group" aria-label="Line style">
          <button
            disabled={disabled || drafts.pending}
            className={object.strokeStyle !== "dashed" ? "active" : ""}
            aria-pressed={object.strokeStyle !== "dashed"}
            onClick={() => onUpdate({ ...object, strokeStyle: "solid" })}
          >
            Solid
          </button>
          <button
            disabled={disabled || drafts.pending}
            className={object.strokeStyle === "dashed" ? "active" : ""}
            aria-pressed={object.strokeStyle === "dashed"}
            onClick={() => onUpdate({ ...object, strokeStyle: "dashed" })}
          >
            Dashed
          </button>
        </div>
      </div>
      <div className="endpoint-section">
        <CoordinateFields
          drafts={drafts}
          objectId={object.id}
          disabled={disabled}
          prefix="Start"
          value={object.start}
          onChange={(value) => updateEndpoint("start", value)}
        />
        <CoordinateFields
          drafts={drafts}
          objectId={object.id}
          disabled={disabled}
          prefix="End"
          value={object.end}
          onChange={(value) => updateEndpoint("end", value)}
        />
      </div>
      <button
        disabled={disabled || drafts.pending}
        className={`visibility-button${object.equationVisible ? " active" : ""}`}
        onClick={() =>
          onUpdate({ ...object, equationVisible: !object.equationVisible })
        }
      >
        {object.equationVisible ? <Eye size={16} /> : <EyeOff size={16} />}
        <span>
          {object.equationVisible ? "Equation shown" : "Show equation"}
        </span>
      </button>
      {object.equationVisible && object.equationLabelPosition && (
        <button
          disabled={disabled || drafts.pending}
          className="text-action"
          onClick={() =>
            onUpdate({ ...object, equationLabelPosition: undefined })
          }
        >
          <RotateCcw size={14} />
          Reset label position
        </button>
      )}
      <NameAndAnswer
        object={object}
        onUpdate={onUpdate}
        drafts={drafts}
        disabled={disabled}
      />
      {object.display === "line" && (
        <button
          disabled={disabled || drafts.pending}
          className="secondary-panel-button"
          onClick={() => onEditEquation(object)}
        >
          <Pencil size={15} />
          Edit equation
        </button>
      )}
      <button
        disabled={disabled || drafts.pending}
        className="danger-button"
        onClick={onDelete}
      >
        <Trash2 size={16} />
        Delete {object.display}
      </button>
    </section>
  );
}
