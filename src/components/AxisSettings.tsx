import { GraphDraftField } from "./GraphDraftField";
import type { GraphDrafts } from "./useGraphDrafts";
import { AXIS_LIMITS, getBounds, isUnitsPerSquare } from "../domain/diagram";
import { parseNumericInput } from "../domain/equations";
import type { AxisConfig, DiagramDocumentV1, GridSize } from "../domain/types";
import type { UnitsPerSquare } from "../domain/types";
import { formatAxisValue, parseTimeOfDay, xNumbersCrowded } from "../../packages/graph-core/src/axes";
import { MAX_AXIS_ORIGIN, MAX_AXIS_TITLE_LENGTH } from "../../packages/graph-core/src/diagram";

const grids: Array<{ value: GridSize; label: string }> = [
  { value: "1cm", label: "1 cm" },
  { value: "5mm", label: "5 mm" },
  { value: "2mm", label: "2 mm" },
  { value: "none", label: "Sketch" },
];

function editAxis(
  document: DiagramDocumentV1,
  axis: "x" | "y",
  change: (config: AxisConfig) => AxisConfig,
): DiagramDocumentV1 {
  return {
    ...document,
    axes: { ...document.axes, [axis]: change({ ...document.axes[axis] }) },
  };
}

function without<K extends keyof AxisConfig>(config: AxisConfig, key: K): AxisConfig {
  const next = { ...config };
  delete next[key];
  return next;
}

interface AxisSettingsProps {
  document: DiagramDocumentV1;
  drafts: GraphDrafts;
  onDocument: (document: DiagramDocumentV1) => void;
  disabled?: boolean;
  xScale: UnitsPerSquare;
  yScale: UnitsPerSquare;
  onChange: (axis: "x" | "y", value: UnitsPerSquare) => void;
}

const scales: Array<{ value: UnitsPerSquare; top: string; bottom: string }> = [
  { value: 0.5, top: "2 squares", bottom: "= 1 unit" },
  { value: 1, top: "1 square", bottom: "= 1 unit" },
  { value: 2, top: "1 square", bottom: "= 2 units" },
];

export function AxisSettings({
  xScale,
  yScale,
  onChange,
  document,
  drafts,
  onDocument,
  disabled = false,
}: AxisSettingsProps) {
  return (
    <section className="panel-card axis-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">GRID</p>
          <h2>Axis scale</h2>
        </div>
      </div>
      {(["x", "y"] as const).map((axis) => {
        const active = axis === "x" ? xScale : yScale;
        return (
          <div className="axis-scale-row" key={axis}>
            <strong>{axis}-axis</strong>
            <div
              className="scale-options"
              role="group"
              aria-label={`${axis}-axis scale`}
            >
              {scales.map((scale) => (
                <button
                  key={scale.value}
                  disabled={disabled || drafts.pending}
                  className={active === scale.value ? "active" : ""}
                  aria-pressed={active === scale.value}
                  onClick={() => onChange(axis, scale.value)}
                >
                  <span>{scale.top}</span>
                  <small>{scale.bottom}</small>
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <details>
        <summary>Precise axis ranges</summary>
        {(["x", "y"] as const).map((axis) => (
          <div className="graph-axis-ranges" key={axis}>
            {(["negative", "positive"] as const).map((end) => {
              const bounds = getBounds(document),
                minimum = end === "negative";
              const value =
                axis === "x"
                  ? minimum
                    ? bounds.xMin
                    : bounds.xMax
                  : minimum
                    ? bounds.yMin
                    : bounds.yMax;
              return (
                <GraphDraftField
                  key={end}
                  id={axis + "-" + end + "-bound"}
                  label={axis + (minimum ? " minimum" : " maximum")}
                  value={
                    document.axes[axis].format === "time"
                      ? formatAxisValue(value, document.axes[axis]).replace("\u2009", ":")
                      : String(value)
                  }
                  drafts={drafts}
                  disabled={disabled}
                  parse={
                    document.axes[axis].format === "time"
                      ? (text) => parseTimeOfDay(text) ?? parseNumericInput(text)
                      : undefined
                  }
                  onApply={(next) => {
                    const fromOrigin = next - (document.axes[axis].origin ?? 0);
                    const squares = Number(
                      (
                        (minimum ? -fromOrigin : fromOrigin) /
                        document.axes[axis].unitsPerSquare
                      ).toFixed(9),
                    );
                    const other =
                      document.axes[axis][
                        minimum ? "positiveSquares" : "negativeSquares"
                      ];
                    if (!Number.isInteger(squares) || squares < 0)
                      throw Error(
                        "Use a whole number of grid squares and keep the range on its side of the axis.",
                      );
                    if (
                      squares + other < AXIS_LIMITS[axis].minTotal ||
                      squares + other > AXIS_LIMITS[axis].maxTotal
                    )
                      throw Error(
                        "The axis must have " +
                          AXIS_LIMITS[axis].minTotal +
                          " to " +
                          AXIS_LIMITS[axis].maxTotal +
                          " squares.",
                      );
                    onDocument({
                      ...document,
                      axes: {
                        ...document.axes,
                        [axis]: {
                          ...document.axes[axis],
                          [minimum ? "negativeSquares" : "positiveSquares"]:
                            squares,
                        },
                      },
                    });
                  }}
                />
              );
            })}
          </div>
        ))}
      </details>
      <details className="exam-axes">
        <summary>Exam-style axes and grid</summary>
        <div className="exam-axes-row">
          <span>Grid squares</span>
          <div className="segmented segmented--four" role="group" aria-label="Grid squares" title="Sketch: axes only, with no grid or numbers">
            {grids.map((grid) => {
              const active = (document.grid ?? "1cm") === grid.value;
              return (
                <button
                  key={grid.value}
                  disabled={disabled || drafts.pending}
                  className={active ? "active" : ""}
                  aria-pressed={active}
                  onClick={() => {
                    const next = { ...document };
                    if (grid.value === "1cm") delete next.grid;
                    else next.grid = grid.value;
                    onDocument(next);
                  }}
                >
                  {grid.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="exam-axes-row">
          <span>Origin label</span>
          <div className="segmented" role="group" aria-label="Origin label">
            {(["0", "O"] as const).map((label) => {
              const active = (document.originLabel ?? "0") === label;
              return (
                <button
                  key={label}
                  disabled={disabled || drafts.pending}
                  className={active ? "active" : ""}
                  aria-pressed={active}
                  onClick={() => {
                    const next = { ...document };
                    if (label === "0") delete next.originLabel;
                    else next.originLabel = "O";
                    onDocument(next);
                  }}
                >
                  {label === "O" ? <em>O</em> : "0"}
                </button>
              );
            })}
          </div>
        </div>
        {(["x", "y"] as const).map((axis) => {
          const config = document.axes[axis];
          const time = config.format === "time";
          return (
            <fieldset className="exam-axis" key={axis}>
              <legend>{axis}-axis</legend>
              <GraphDraftField
                id={axis + "-title"}
                label={axis + "-axis title"}
                displayLabel="Title"
                inputMode="text"
                hint={axis === "x" ? "For example: Time of day" : "For example: Distance from home (km)"}
                value={config.title ?? ""}
                drafts={drafts}
                disabled={disabled}
                onApplyText={(text) => {
                  const title = text.trim().replace(/\s+/g, " ");
                  if (title.length > MAX_AXIS_TITLE_LENGTH)
                    throw Error(`Keep the title to ${MAX_AXIS_TITLE_LENGTH} characters.`);
                  onDocument(
                    editAxis(document, axis, (c) =>
                      title ? { ...c, title } : without(c, "title"),
                    ),
                  );
                }}
              />
              <GraphDraftField
                id={axis + "-units-per-square"}
                label={axis + "-axis units per square"}
                displayLabel={time ? "Minutes per square" : "Units per square"}
                value={String(config.unitsPerSquare)}
                drafts={drafts}
                disabled={disabled}
                onApply={(next) => {
                  if (!isUnitsPerSquare(next))
                    throw Error("Use a positive number of units per square, such as 5, 10 or 25.");
                  onDocument(editAxis(document, axis, (c) => ({ ...c, unitsPerSquare: next })));
                }}
              />
              <GraphDraftField
                id={axis + "-origin"}
                label={axis + "-axis value where the axes cross"}
                displayLabel={time ? "Axes cross at (time)" : "Axes cross at"}
                value={
                  time
                    ? formatAxisValue(config.origin ?? 0, config).replace("\u2009", ":")
                    : String(config.origin ?? 0)
                }
                parse={time ? (text) => parseTimeOfDay(text) : undefined}
                drafts={drafts}
                disabled={disabled}
                onApply={(next) => {
                  if (Math.abs(next) > MAX_AXIS_ORIGIN)
                    throw Error("Use a value between −1000000 and 1000000.");
                  onDocument(
                    editAxis(document, axis, (c) =>
                      next === 0 ? without(c, "origin") : { ...c, origin: next },
                    ),
                  );
                }}
              />
              <label className="exam-axis-select">
                <span>Numbers</span>
                <select
                  aria-label={axis + "-axis numbering"}
                  disabled={disabled || drafts.pending}
                  value={config.labelEvery ?? "auto"}
                  onChange={(event) => {
                    const value = event.target.value;
                    onDocument(
                      editAxis(document, axis, (c) =>
                        value === "auto"
                          ? without(c, "labelEvery")
                          : { ...c, labelEvery: Number(value) },
                      ),
                    );
                  }}
                >
                  <option value="auto">Automatic</option>
                  <option value={1}>Every line</option>
                  {[2, 3, 4, 5, 10].map((n) => (
                    <option key={n} value={n}>
                      Every {n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`} line
                    </option>
                  ))}
                </select>
              </label>
              <div className="segmented" role="group" aria-label={axis + "-axis number format"}>
                {(["number", "time"] as const).map((format) => {
                  const active = (config.format ?? "number") === format;
                  return (
                    <button
                      key={format}
                      disabled={disabled || drafts.pending}
                      className={active ? "active" : ""}
                      aria-pressed={active}
                      onClick={() =>
                        onDocument(
                          editAxis(document, axis, (c) =>
                            format === "number" ? without(c, "format") : { ...c, format },
                          ),
                        )
                      }
                    >
                      {format === "number" ? "Numbers" : "Times of day"}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
        {xNumbersCrowded(document) && (
          <p className="field-error" role="status">
            The x-axis numbers touch at print size. Number every 2nd, 3rd or
            5th line, or use more units per square.
          </p>
        )}
        <p className="panel-note">
          Times of day count minutes after midnight: 12:00 is 720, and 30
          minutes per square numbers every half hour.
        </p>
      </details>
      <p className="panel-note">
        Use the + and − buttons at each axis end to change the number of
        squares.
      </p>
    </section>
  );
}
