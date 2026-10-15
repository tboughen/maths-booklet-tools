import { GraphDraftField } from "./GraphDraftField";
import type { GraphDrafts } from "./useGraphDrafts";
import { AXIS_LIMITS, getBounds } from "../domain/diagram";
import type { DiagramDocumentV1 } from "../domain/types";
import type { UnitsPerSquare } from "../domain/types";

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
                  value={String(value)}
                  drafts={drafts}
                  disabled={disabled}
                  onApply={(next) => {
                    const squares =
                      (minimum ? -next : next) /
                      document.axes[axis].unitsPerSquare;
                    const other =
                      document.axes[axis][
                        minimum ? "positiveSquares" : "negativeSquares"
                      ];
                    if (!Number.isInteger(squares) || squares < 0)
                      throw Error(
                        "Use a supported grid step and keep the range on its side of zero.",
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
      <p className="panel-note">
        Use the + and − buttons at each axis end to change the number of
        squares.
      </p>
    </section>
  );
}
