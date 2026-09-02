import type { UnitsPerSquare } from "../domain/types";

interface AxisSettingsProps {
  xScale: UnitsPerSquare;
  yScale: UnitsPerSquare;
  onChange: (axis: "x" | "y", value: UnitsPerSquare) => void;
}

const scales: Array<{ value: UnitsPerSquare; top: string; bottom: string }> = [
  { value: 0.5, top: "2 squares", bottom: "= 1 unit" },
  { value: 1, top: "1 square", bottom: "= 1 unit" },
  { value: 2, top: "1 square", bottom: "= 2 units" },
];

export function AxisSettings({ xScale, yScale, onChange }: AxisSettingsProps) {
  return (
    <section className="panel-card axis-panel">
      <div className="panel-heading"><div><p className="eyebrow">GRID</p><h2>Axis scale</h2></div></div>
      {(["x", "y"] as const).map((axis) => {
        const active = axis === "x" ? xScale : yScale;
        return (
          <div className="axis-scale-row" key={axis}>
            <strong>{axis}-axis</strong>
            <div className="scale-options" role="group" aria-label={`${axis}-axis scale`}>
              {scales.map((scale) => (
                <button key={scale.value} className={active === scale.value ? "active" : ""} aria-pressed={active === scale.value} onClick={() => onChange(axis, scale.value)}>
                  <span>{scale.top}</span><small>{scale.bottom}</small>
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <p className="panel-note">Use the + and − buttons at each axis end to change the number of squares.</p>
    </section>
  );
}
