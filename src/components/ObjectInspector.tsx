import { GraphDraftField } from "./GraphDraftField";
import { TransformFields } from "./TransformFields";
import { CurveWorkFields } from "./CurveWorkFields";
import { parseFunctionText } from "./functionText";
import { formatFunction } from "../../packages/graph-core/src/function";
import { parseNumericInput } from "../../packages/graph-core/src/equations";
import { curveProblem } from "../../packages/graph-core/src/curve";
import { MAX_CURVE_POINTS } from "../../packages/graph-core/src/interchange";
import { makeId } from "../domain/diagram";
import type { GraphDrafts } from "./useGraphDrafts";
import { Eye, EyeOff, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { equationForObject, formatNumber } from "../domain/equations";
import type { Bounds, Coordinate, DiagramDocumentV1, GraphObject, GradientTriangle, RegionObject, StraightObject } from "../domain/types";
import { gradientTriangleProblem, gradientTriangleValues } from "../../packages/graph-core/src/gradient-triangle";
import { MAX_REGION_INEQUALITIES, parseInequality, regionProblem } from "../../packages/graph-core/src/region";

/** The first whole-number start and short run where a labelled triangle fits on the grid. */
function fittingTriangle(object: StraightObject, bounds: Bounds): GradientTriangle | null {
  for (const run of [2, 3, 4, 1, 5])
    for (let x = Math.ceil(bounds.xMin); x <= Math.floor(bounds.xMax); x++) {
      const gradientTriangle = { x, run, labels: "values" as const };
      if (!gradientTriangleProblem({ ...object, gradientTriangle }, bounds)) return { x, run };
    }
  return null;
}

/** Add, move, resize, label or remove a line's gradient triangle (U76). */
function GradientTriangleFields({
  object,
  bounds,
  onUpdate,
  drafts,
  disabled,
}: {
  object: StraightObject;
  bounds?: Bounds;
  onUpdate: (object: GraphObject) => void;
  drafts: GraphDrafts;
  disabled?: boolean;
}) {
  const t = object.gradientTriangle;
  const flat =
    Math.abs(object.end.x - object.start.x) < 1e-12 ||
    Math.abs(object.end.y - object.start.y) < 1e-12;
  if (!t) {
    if (flat || !bounds) return null;
    const fit = fittingTriangle(object, bounds);
    return (
      <button
        disabled={disabled || drafts.pending || !fit}
        className="secondary-panel-button"
        title={fit ? undefined : "No gradient triangle fits on the grid for this line."}
        onClick={() => fit && onUpdate({ ...object, gradientTriangle: fit })}
      >
        Add gradient triangle
      </button>
    );
  }
  const set = (next: GradientTriangle) => {
    if (next.run === 0) throw Error("The run cannot be zero.");
    onUpdate({ ...object, gradientTriangle: next });
  };
  const problem = bounds ? gradientTriangleProblem(object, bounds) : null;
  const values = gradientTriangleValues(object);
  return (
    <fieldset className="gradient-triangle-fields">
      <legend>Gradient triangle</legend>
      <GraphDraftField
        id={object.id + "-triangle-x"}
        label="Gradient triangle starts at x"
        displayLabel="Starts at x"
        value={formatNumber(t.x)}
        drafts={drafts}
        disabled={disabled}
        onApply={(x) => set({ ...t, x })}
      />
      <GraphDraftField
        id={object.id + "-triangle-run"}
        label="Gradient triangle run"
        displayLabel="Run"
        hint="Negative runs go left"
        value={formatNumber(t.run)}
        drafts={drafts}
        disabled={disabled}
        onApply={(run) => set({ ...t, run })}
      />
      <label>
        Labels{" "}
        <select
          aria-label="Gradient triangle labels"
          disabled={disabled || drafts.pending}
          value={t.labels ?? "none"}
          onChange={(event) => {
            const next: GradientTriangle = { x: t.x, run: t.run };
            if (event.target.value !== "none") next.labels = event.target.value as "values" | "blank";
            onUpdate({ ...object, gradientTriangle: next });
          }}
        >
          <option value="none">No labels</option>
          <option value="values">Print run and rise{values ? ` (${values.run} and ${values.rise})` : ""}</option>
          <option value="blank">Blank for pupils, values on the answers copy</option>
        </select>
      </label>
      {problem && <p className="field-warning" role="status">{problem}</p>}
      <button
        disabled={disabled || drafts.pending}
        className="text-action"
        onClick={() => {
          const next = { ...object };
          delete next.gradientTriangle;
          onUpdate(next);
        }}
      >
        <Trash2 size={14} />
        Remove gradient triangle
      </button>
    </fieldset>
  );
}
import {
  OBJECT_NAME_PATTERN,
  coordinatesPrintable,
  normaliseObjectName,
} from "../../packages/graph-core/src/axes";
import {
  POLYGON_MAX_VERTICES,
  POLYGON_MIN_VERTICES,
  formatVertices,
  polygonProblem,
} from "../../packages/graph-core/src/polygon";

/** Reads corners typed as "(1, 1) (4, 1) (1/3, 3)"; minus signs, fractions and spaces are forgiven. */
const VERTEX_NUMBER = String.raw`-?(?:\d+(?:\.\d+)?|\.\d+)(?:\/\d+)?`;
const vertexValue = (text: string) => {
  const [top, bottom] = text.split("/");
  return bottom === undefined ? Number(top) : Number(top) / Number(bottom);
};
/** Reads a curve's points, typed like shape corners: 2 to 40 of them. */
function parseCurvePoints(text: string): Coordinate[] {
  const cleaned = text.replaceAll("−", "-");
  const pair = String.raw`\(\s*(${VERTEX_NUMBER})\s*,\s*(${VERTEX_NUMBER})\s*\)`;
  const pairs = [...cleaned.matchAll(new RegExp(pair, "g"))];
  const leftover = cleaned.replace(new RegExp(pair, "g"), "").replace(/[\s,;]/g, "");
  if (leftover) throw Error("Type each point in brackets, such as (0, 0) (5, 0.6) (10, 0.6).");
  if (pairs.length < 2 || pairs.length > MAX_CURVE_POINTS) throw Error(`A graph needs 2 to ${MAX_CURVE_POINTS} points.`);
  if (pairs.some((m) => [m[1], m[2]].some((v) => v.endsWith("/0")))) throw Error("A fraction can't have 0 below the line.");
  const points = pairs.map((m) => ({ x: vertexValue(m[1]), y: vertexValue(m[2]) }));
  const problem = curveProblem(points);
  if (problem) throw Error(`This graph can't be drawn: ${problem}`);
  return points;
}
function parseVertices(text: string): Coordinate[] {
  const cleaned = text.replaceAll("−", "-");
  const pair = String.raw`\(\s*(${VERTEX_NUMBER})\s*,\s*(${VERTEX_NUMBER})\s*\)`;
  const pairs = [...cleaned.matchAll(new RegExp(pair, "g"))];
  const leftover = cleaned.replace(new RegExp(pair, "g"), "").replace(/[\s,;]/g, "");
  if (leftover)
    throw Error("Type each corner in brackets, such as (1, 1) (4, 1) (1, 3).");
  if (pairs.length < POLYGON_MIN_VERTICES || pairs.length > POLYGON_MAX_VERTICES)
    throw Error(`A shape needs ${POLYGON_MIN_VERTICES} to ${POLYGON_MAX_VERTICES} corners.`);
  if (pairs.some((m) => [m[1], m[2]].some((v) => v.endsWith("/0"))))
    throw Error("A fraction in a corner can't have 0 below the line.");
  const vertices = pairs.map((m) => ({ x: vertexValue(m[1]), y: vertexValue(m[2]) }));
  const problem = polygonProblem(vertices);
  if (problem) throw Error(`This shape can't be drawn: ${problem}`);
  return vertices;
}

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
  const kind = object.kind === "point" ? "point" : object.kind === "polygon" ? "shape" : object.kind === "region" ? "region" : object.kind === "curve" ? "graph" : object.kind === "circle" ? "circle" : object.kind === "function" ? "curve" : "line";
  return (
    <div className="object-name-fields">
      <GraphDraftField
        id={object.id + "-name"}
        label={kind === "shape" || kind === "region" ? `Name printed in the ${kind}` : `Name printed beside the ${kind}`}
        displayLabel="Name"
        inputMode="text"
        hint={kind === "line" ? "For example L, L1 or L2" : kind === "region" ? "For example R" : kind === "graph" ? "For example C" : "For example A, B or P′"}
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
            <option value="show" disabled={!coordinatesPrintable(object.position) && object.coordinates !== "show"}>Show, as A(2, 3)</option>
            <option value="blank" disabled={!coordinatesPrintable(object.position) && object.coordinates !== "blank"}>Blank for pupils, answer on the answers copy</option>
          </select>
          {!coordinatesPrintable(object.position) && (
            <span className="field-error" role="alert">
              Coordinates print only for values with at most 3 decimal places. Move the point to an exact position.
            </span>
          )}
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

/** Inequalities, shading side and boundary lines of a shaded region (U73). */
function RegionFields({
  object,
  onUpdate,
  onDelete,
  drafts,
  disabled,
}: {
  object: RegionObject;
  onUpdate: (object: GraphObject) => void;
  onDelete: () => void;
  drafts: GraphDrafts;
  disabled?: boolean;
}) {
  const busy = disabled || drafts.pending;
  return (
    <section className="panel-card selection-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">SELECTED OBJECT</p>
          <h2>Shaded region</h2>
        </div>
      </div>
      <GraphDraftField
        id={object.id + "-inequalities"}
        label="Inequalities"
        inputMode="text"
        hint="Separate with commas, for example y > 2x − 1, x ≤ 3, y ≥ 0. < and > draw dashed lines."
        value={object.inequalities.join(", ")}
        drafts={drafts}
        disabled={disabled}
        onApplyText={(text) => {
          const inequalities = text
            .split(/[,;\n]/)
            .map((t) => t.trim())
            .filter(Boolean);
          if (!inequalities.length || inequalities.length > MAX_REGION_INEQUALITIES)
            throw Error(`Enter 1 to ${MAX_REGION_INEQUALITIES} inequalities, separated by commas.`);
          inequalities.forEach(parseInequality);
          // A range such as −2 < x ≤ 3 counts as two boundaries; refuse what the renderer cannot draw.
          const problem = regionProblem({ inequalities });
          if (problem) throw Error(problem);
          onUpdate({ ...object, inequalities });
        }}
      />
      <div className="line-style-field">
        <span>Shading</span>
        <div className="segmented" role="group" aria-label="Shading">
          {(
            [
              ["wanted", "Shade the region"],
              ["unwanted", "Shade the rest"],
            ] as const
          ).map(([shade, label]) => (
            <button
              key={shade}
              disabled={busy}
              className={object.shade === shade ? "active" : ""}
              aria-pressed={object.shade === shade}
              onClick={() => onUpdate({ ...object, shade })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <button
        disabled={busy}
        className={`visibility-button${object.boundaries ? " active" : ""}`}
        aria-pressed={object.boundaries}
        onClick={() => onUpdate({ ...object, boundaries: !object.boundaries })}
      >
        {object.boundaries ? <Eye size={16} /> : <EyeOff size={16} />}
        <span>{object.boundaries ? "Boundary lines drawn" : "Draw boundary lines"}</span>
      </button>
      <NameAndAnswer object={object} onUpdate={onUpdate} drafts={drafts} disabled={disabled} />
      <button disabled={busy} className="danger-button" onClick={onDelete}>
        <Trash2 size={16} />
        Delete region
      </button>
    </section>
  );
}

interface ObjectInspectorProps {
  object: GraphObject;
  onUpdate: (object: GraphObject) => void;
  onDelete: () => void;
  drafts: GraphDrafts;
  disabled?: boolean;
  onEditEquation: (object: StraightObject) => void;
  /** The visible grid, so a new gradient triangle starts where it fits. */
  bounds?: Bounds;
  /** Every object in the drawing, so an image gets a free name. */
  objects?: GraphObject[];
  /** Adds new objects (a shape's image) as one undoable step. */
  onAdd?: (objects: GraphObject[]) => void;
  /** The axes, for a tangent's default length and where strips stand. */
  axes?: DiagramDocumentV1["axes"];
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
  bounds,
  objects = [],
  onAdd,
  axes,
}: ObjectInspectorProps) {
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

  if (object.kind === "polygon") {
    return (
      <section className="panel-card selection-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">SELECTED OBJECT</p>
            <h2>Shape</h2>
          </div>
        </div>
        <GraphDraftField
          id={object.id + "-vertices"}
          label="Shape corners"
          displayLabel="Corners"
          inputMode="text"
          hint="In order, such as (1, 1) (4, 1) (1, 3)"
          value={formatVertices(object.vertices)}
          drafts={drafts}
          disabled={disabled}
          onApplyText={(text) =>
            onUpdate({ ...object, vertices: parseVertices(text) })
          }
        />
        <label className="checkbox-row">
          <input
            type="checkbox"
            disabled={disabled || drafts.pending}
            checked={!!object.shaded}
            onChange={(event) => {
              const next = { ...object };
              if (event.target.checked) next.shaded = true;
              else delete next.shaded;
              onUpdate(next);
            }}
          />{" "}
          Shade the shape
        </label>
        <NameAndAnswer
          object={object}
          onUpdate={onUpdate}
          drafts={drafts}
          disabled={disabled}
        />
        <p className="panel-note">Arrow keys move the whole shape.</p>
        {onAdd && (
          <TransformFields
            key={object.id}
            object={object}
            objects={objects}
            onAdd={onAdd}
            makeId={makeId}
            disabled={disabled || drafts.pending}
          />
        )}
        <button
          disabled={disabled || drafts.pending}
          className="danger-button"
          onClick={onDelete}
        >
          <Trash2 size={16} />
          Delete shape
        </button>
      </section>
    );
  }
  if (object.kind === "function") {
    const range = (key: "from" | "to") => (text: string) => {
      const next = { ...object };
      if (!text.trim()) delete next[key];
      else {
        const v = parseNumericInput(text);
        if (v === null) throw Error("Enter a number, or leave blank for the grid's edge.");
        next[key] = v;
      }
      if (next.from !== undefined && next.to !== undefined && !(next.to > next.from)) throw Error("Make the end after the start.");
      onUpdate(next);
    };
    return (
      <section className="panel-card selection-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">SELECTED OBJECT</p>
            <h2>Equation curve</h2>
          </div>
        </div>
        <GraphDraftField
          id={object.id + "-equation"}
          label="Curve equation"
          displayLabel="Equation"
          inputMode="text"
          hint="Such as y = x² − 3x, y = 6/x, y = 2ˣ or y = sin x (degrees)"
          value={formatFunction(object.equation)}
          drafts={drafts}
          disabled={disabled}
          onApplyText={(text) => onUpdate({ ...object, equation: parseFunctionText(text) })}
        />
        <div className="transform-row">
          <GraphDraftField id={object.id + "-from"} label="Curve from x" displayLabel="From x" inputMode="text" value={object.from === undefined ? "" : formatNumber(object.from)} drafts={drafts} disabled={disabled} onApplyText={range("from")} />
          <GraphDraftField id={object.id + "-to"} label="Curve to x" displayLabel="To x" inputMode="text" value={object.to === undefined ? "" : formatNumber(object.to)} drafts={drafts} disabled={disabled} onApplyText={range("to")} />
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            disabled={disabled || drafts.pending}
            checked={object.strokeStyle === "dashed"}
            onChange={(event) => {
              const next = { ...object };
              if (event.target.checked) next.strokeStyle = "dashed";
              else delete next.strokeStyle;
              onUpdate(next);
            }}
          />{" "}
          Dashed
        </label>
        <NameAndAnswer object={object} onUpdate={onUpdate} drafts={drafts} disabled={disabled} />
        <p className="panel-note">Blank from and to draw the curve across the grid. Trig graphs use degrees.</p>
        {onAdd && (
          <CurveWorkFields
            key={object.id}
            object={object}
            span={axes ? { from: (axes.x.origin ?? 0) - axes.x.negativeSquares * axes.x.unitsPerSquare, to: (axes.x.origin ?? 0) + axes.x.positiveSquares * axes.x.unitsPerSquare } : undefined}
            unitsPerSquare={axes?.x.unitsPerSquare ?? 1}
            base={axes?.y.origin ?? 0}
            onAdd={onAdd}
            makeId={makeId}
            disabled={disabled || drafts.pending}
          />
        )}
        <button disabled={disabled || drafts.pending} className="danger-button" onClick={onDelete}>
          <Trash2 size={16} />
          Delete curve
        </button>
      </section>
    );
  }
  if (object.kind === "curve")
    return (
      <section className="panel-card selection-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">SELECTED OBJECT</p>
            <h2>{object.smooth ? "Curve through points" : "Graph through points"}</h2>
          </div>
        </div>
        <GraphDraftField
          id={object.id + "-points"}
          label="Graph points"
          displayLabel="Points"
          inputMode="text"
          hint="In order, such as (0, 0) (5, 0.6) (10, 0.6)"
          value={formatVertices(object.points)}
          drafts={drafts}
          disabled={disabled}
          onApplyText={(text) => onUpdate({ ...object, points: parseCurvePoints(text) })}
        />
        <div className="segmented" role="group" aria-label="Join the points">
          <button disabled={disabled || drafts.pending} className={!object.smooth ? "active" : ""} aria-pressed={!object.smooth} onClick={() => { const next = { ...object }; delete next.smooth; onUpdate(next); }}>
            Straight pieces
          </button>
          <button disabled={disabled || drafts.pending} className={object.smooth ? "active" : ""} aria-pressed={!!object.smooth} onClick={() => onUpdate({ ...object, smooth: true })}>
            Smooth curve
          </button>
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            disabled={disabled || drafts.pending}
            checked={object.strokeStyle === "dashed"}
            onChange={(event) => {
              const next = { ...object };
              if (event.target.checked) next.strokeStyle = "dashed";
              else delete next.strokeStyle;
              onUpdate(next);
            }}
          />{" "}
          Dashed
        </label>
        <NameAndAnswer object={object} onUpdate={onUpdate} drafts={drafts} disabled={disabled} />
        <p className="panel-note">Arrow keys move the whole graph.</p>
        {onAdd && (
          <CurveWorkFields
            key={object.id}
            object={object}
            unitsPerSquare={axes?.x.unitsPerSquare ?? 1}
            base={axes?.y.origin ?? 0}
            onAdd={onAdd}
            makeId={makeId}
            disabled={disabled || drafts.pending}
          />
        )}
        <button disabled={disabled || drafts.pending} className="danger-button" onClick={onDelete}>
          <Trash2 size={16} />
          Delete graph
        </button>
      </section>
    );
  if (object.kind === "circle")
    return (
      <section className="panel-card selection-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">SELECTED OBJECT</p>
            <h2>Circle</h2>
          </div>
        </div>
        <CoordinateFields drafts={drafts} objectId={object.id} disabled={disabled} prefix="Centre" value={object.centre} onChange={(centre) => onUpdate({ ...object, centre })} />
        <GraphDraftField
          id={object.id + "-radius"}
          label="Circle radius"
          displayLabel="Radius"
          value={formatNumber(object.radius)}
          drafts={drafts}
          disabled={disabled}
          onApply={(radius) => {
            if (!(radius > 0)) throw Error("Use a radius above 0.");
            onUpdate({ ...object, radius });
          }}
        />
        <label className="checkbox-row">
          <input
            type="checkbox"
            disabled={disabled || drafts.pending}
            checked={object.strokeStyle === "dashed"}
            onChange={(event) => {
              const next = { ...object };
              if (event.target.checked) next.strokeStyle = "dashed";
              else delete next.strokeStyle;
              onUpdate(next);
            }}
          />{" "}
          Dashed
        </label>
        <NameAndAnswer object={object} onUpdate={onUpdate} drafts={drafts} disabled={disabled} />
        <button disabled={disabled || drafts.pending} className="danger-button" onClick={onDelete}>
          <Trash2 size={16} />
          Delete circle
        </button>
      </section>
    );
  if (object.kind === "reading")
    return (
      <section className="panel-card selection-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">SELECTED OBJECT</p>
            <h2>Reading lines</h2>
          </div>
        </div>
        <CoordinateFields drafts={drafts} objectId={object.id} disabled={disabled} prefix="At" value={object.at} onChange={(at) => onUpdate({ ...object, at })} />
        <div className="line-style-field">
          <span>Read off</span>
          <div className="segmented" role="group" aria-label="Read off">
            {([["y", "y value"], ["x", "x value"], ["both", "Both"]] as const).map(([value, label]) => (
              <button key={value} disabled={disabled || drafts.pending} className={object.read === value ? "active" : ""} aria-pressed={object.read === value} onClick={() => onUpdate({ ...object, read: value })}>
                {label}
              </button>
            ))}
          </div>
        </div>
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
          <span>{object.answerOnly ? "Answer only: hidden on the pupil copy" : "On the pupil copy"}</span>
        </button>
        <button disabled={disabled || drafts.pending} className="danger-button" onClick={onDelete}>
          <Trash2 size={16} />
          Delete reading lines
        </button>
      </section>
    );
  if (object.kind === "region")
    return (
      <RegionFields
        object={object}
        onUpdate={onUpdate}
        onDelete={onDelete}
        drafts={drafts}
        disabled={disabled}
      />
    );

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
          onClick={() => {
            const next: StraightObject = { ...object, display: "line" };
            delete next.arrow;
            onUpdate(next);
          }}
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
      {object.display === "segment" && (
        <div className="line-style-field">
          <span>Vector arrow</span>
          <div className="segmented" role="group" aria-label="Vector arrow">
            {([["none", "None"], ["middle", "Middle"], ["end", "End"]] as const).map(([value, label]) => (
              <button
                key={value}
                disabled={disabled || drafts.pending}
                className={(object.arrow ?? "none") === value ? "active" : ""}
                aria-pressed={(object.arrow ?? "none") === value}
                onClick={() => {
                  const next: StraightObject = { ...object };
                  if (value === "none") delete next.arrow;
                  else next.arrow = value;
                  onUpdate(next);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
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
      <GradientTriangleFields
        object={object}
        bounds={bounds}
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
