import type { ReactNode } from "react";
import {
  MAX_GROUPED_READINGS,
  STEP_MM,
  groupedTableChoices,
  groupedTableNames,
  type GroupedKind,
  type GroupedSettings,
  type PaperAxis,
} from "../../packages/chart-core/src";
import { DraftField } from "./DraftField";

const STEP_CHOICES = Array.from({ length: (STEP_MM.maximum - STEP_MM.minimum) / 2 + 1 }, (_, i) => STEP_MM.minimum + 2 * i);
const yName: Record<GroupedKind, string> = {
  histogram: "frequency density",
  polygon: "frequency",
  cumulative: "cumulative frequency",
};

/** Settings cards for histograms, frequency polygons and cumulative frequency graphs. */
export function GroupedCards({
  kind,
  g,
  blocked,
  selected,
  issues,
  onChange,
  linesControl,
}: {
  kind: GroupedKind;
  g: GroupedSettings;
  blocked: boolean;
  selected: string | null;
  issues: string[];
  onChange: (update: (s: GroupedSettings) => void) => void;
  linesControl: ReactNode;
}) {
  const bad = (prefix: string) => issues.some((x) => x.startsWith(prefix));
  const axisBad = (axis: string, field: "min" | "max" | "step") =>
    issues.some((x) => {
      if (!x.includes(`${axis} axis`) || x.startsWith("Class") || x.startsWith("Reading")) return false;
      if (field === "min") return x.includes("axis start") || x.includes("greater than its start");
      if (field === "max") return x.includes("axis end");
      return x.includes("axis step") || x.includes("steps on the");
    });
  const axisFields = (name: "Horizontal" | "Vertical", a: PaperAxis, set: (s: GroupedSettings) => PaperAxis) => (
    <fieldset className="ch-fieldset">
      <legend>{name === "Vertical" ? `Vertical axis (${yName[kind]})` : "Horizontal axis"}</legend>
      <div className="ch-fields">
        {(["min", "max", "step"] as const).map((f) => (
          <label key={f}>
            {{ min: "Start", max: "End", step: "Step" }[f]}
            <DraftField
              label={`${name} axis ${{ min: "start", max: "end", step: "step" }[f]}`}
              value={a[f]}
              maxLength={12}
              inputMode="decimal"
              disabled={blocked}
              invalid={axisBad(name.toLowerCase(), f)}
              onCommit={(v) => onChange((s) => void (set(s)[f] = v))}
            />
          </label>
        ))}
        <label>
          Step length (mm)
          <select aria-label={`${name} axis step length`} value={a.stepMm} disabled={blocked} onChange={(ev) => onChange((s) => void (set(s).stepMm = Number(ev.target.value)))}>
            {STEP_CHOICES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <label className="ch-wide">
          Title
          <DraftField label={`${name} axis title`} value={a.title} maxLength={40} disabled={blocked} onCommit={(v) => onChange((s) => void (set(s).title = v))} />
        </label>
      </div>
    </fieldset>
  );
  const hideWhat = kind === "histogram" ? "bar" : kind === "polygon" ? "point" : "part of the curve";
  return (
    <>
      <section className="panel-card ch-panel">
        <h2>Classes</h2>
        <div className="ch-table-wrap">
          <table className="ch-table ch-points ch-classes">
            <thead>
              <tr>
                <th scope="col" aria-label="Class">#</th>
                <th scope="col">From</th>
                <th scope="col">To</th>
                <th scope="col">Frequency</th>
                <th scope="col">Hide</th>
              </tr>
            </thead>
            <tbody>
              {g.classes.map((c, i) => (
                <tr key={i}>
                  <th scope="row">{i + 1}</th>
                  {(["lower", "upper", "frequency"] as const).map((f) => (
                    <td key={f}>
                      <DraftField
                        id={`ch-class-${f}-${i}`}
                        className={selected === `ch-class-${f}-${i}` ? "ch-field-selected" : ""}
                        label={`Class ${i + 1} ${{ lower: "lower boundary", upper: "upper boundary", frequency: "frequency" }[f]}`}
                        value={c[f]}
                        maxLength={12}
                        inputMode="decimal"
                        disabled={blocked}
                        invalid={bad(`Class ${i + 1}:`)}
                        onCommit={(v) => onChange((s) => void (s.classes[i][f] = v))}
                      />
                    </td>
                  ))}
                  <td className="ch-class-hide">
                    <label className="ch-hide">
                      <input
                        type="checkbox"
                        aria-label={`Hide class ${i + 1} in the table for pupils`}
                        checked={c.table === "hidden"}
                        disabled={blocked}
                        onChange={(ev) => onChange((s) => void (s.classes[i].table = ev.target.checked ? "hidden" : "show"))}
                      />
                      Table
                    </label>
                    <label className="ch-hide">
                      <input
                        type="checkbox"
                        aria-label={`Hide the ${hideWhat} for class ${i + 1} for pupils`}
                        checked={c.graph === "hidden"}
                        disabled={blocked}
                        onChange={(ev) => onChange((s) => void (s.classes[i].graph = ev.target.checked ? "hidden" : "show"))}
                      />
                      Graph
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ch-note">
          Values stay as typed. Leave a frequency blank for no data; 0 is a value. Hide Table leaves
          the cell for pupils to complete; hide Graph leaves the {hideWhat} for pupils to draw. Use +
          and − beside the graph to add or remove the last class.
          {kind === "histogram" && " Bars are drawn at frequency ÷ class width."}
          {kind === "polygon" && " Points are plotted at the middle of each class."}
          {kind === "cumulative" && " Points are plotted at the upper end of each class."}
        </p>
        <div className="ch-fields">
          <label>
            Letter
            <DraftField label="Variable letter" value={g.variable} maxLength={1} disabled={blocked} onCommit={(v) => onChange((s) => void (s.variable = /^[A-Za-z]?$/.test(v) ? v : s.variable))} />
          </label>
          <label>
            Classes
            <select aria-label="Class inequalities" value={g.inequality} disabled={blocked || !g.variable} onChange={(ev) => onChange((s) => void (s.inequality = ev.target.value as GroupedSettings["inequality"]))}>
              <option value="lower-open">{`0 < ${g.variable || "x"} ⩽ 10`}</option>
              <option value="lower-closed">{`0 ⩽ ${g.variable || "x"} < 10`}</option>
            </select>
          </label>
          <label>
            Table
            <select aria-label="Table above the graph" value={g.table} disabled={blocked} onChange={(ev) => onChange((s) => void (s.table = ev.target.value as GroupedSettings["table"]))}>
              {groupedTableChoices.map((x) => (
                <option key={x} value={x}>
                  {groupedTableNames[x]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="ch-row">
          <button type="button" disabled={blocked} onClick={() => onChange((s) => s.classes.forEach((c) => (c.graph = "hidden")))}>
            Hide the whole graph (pupils draw)
          </button>
          <button
            type="button"
            disabled={blocked || !(g.classes.some((c) => c.graph === "hidden" || c.table === "hidden") || g.cumulative.readings.some((r) => r.show === "hidden"))}
            onClick={() =>
              onChange((s) => {
                s.classes.forEach((c) => (c.graph = c.table = "show"));
                s.cumulative.readings.forEach((r) => (r.show = "show"));
              })
            }
          >
            Show all
          </button>
        </div>
      </section>
      <section className="panel-card ch-panel">
        <h2>Axes and graph paper</h2>
        {axisFields("Horizontal", g.xAxis, (s) => s.xAxis)}
        {axisFields("Vertical", g[kind].yAxis, (s) => s[kind].yAxis)}
        <p className="ch-note">
          Graph paper is true size: 2 mm squares with heavier lines every 1 cm and 2 cm. Numbers go
          at every step; the grid runs on to the end of each axis. The horizontal title also heads
          the table.
        </p>
        <div className="ch-fields">
          {kind === "histogram" && (
            <label>
              Bars
              <select aria-label="Bar fill" value={g.histogram.fill} disabled={blocked} onChange={(ev) => onChange((s) => void (s.histogram.fill = ev.target.value as GroupedSettings["histogram"]["fill"]))}>
                <option value="grey">Grey</option>
                <option value="white">White</option>
              </select>
            </label>
          )}
          {kind === "cumulative" && (
            <label>
              Curve
              <select aria-label="Curve" value={g.cumulative.curve} disabled={blocked} onChange={(ev) => onChange((s) => void (s.cumulative.curve = ev.target.value as "smooth" | "straight"))}>
                <option value="smooth">Smooth curve</option>
                <option value="straight">Straight lines</option>
              </select>
            </label>
          )}
          {linesControl}
        </div>
        {kind === "cumulative" && (
          <div className="ch-fields">
            <label className="ch-check">
              <input type="checkbox" checked={g.cumulative.fromZero} disabled={blocked} onChange={(ev) => onChange((s) => void (s.cumulative.fromZero = ev.target.checked))} />
              Start at 0 at the lowest class boundary
            </label>
            <label className="ch-check">
              <input type="checkbox" checked={g.cumulative.crosses} disabled={blocked} onChange={(ev) => onChange((s) => void (s.cumulative.crosses = ev.target.checked))} />
              Crosses at the plotted points
            </label>
          </div>
        )}
      </section>
      {kind === "cumulative" && (
        <section className="panel-card ch-panel">
          <h2>Readings</h2>
          {g.cumulative.readings.map((r, i) => (
            <div className="ch-fields" key={i}>
              <label>
                Reading {i + 1} from
                <select aria-label={`Reading ${i + 1} axis`} value={r.axis} disabled={blocked} onChange={(ev) => onChange((s) => void (s.cumulative.readings[i].axis = ev.target.value as "x" | "y"))}>
                  <option value="y">Cumulative frequency</option>
                  <option value="x">Horizontal axis</option>
                </select>
              </label>
              <label>
                Value
                <DraftField
                  label={`Reading ${i + 1} value`}
                  value={r.value}
                  maxLength={12}
                  inputMode="decimal"
                  disabled={blocked}
                  invalid={bad(`Reading ${i + 1}:`)}
                  onCommit={(v) => onChange((s) => void (s.cumulative.readings[i].value = v))}
                />
              </label>
              <label className="ch-check">
                <input
                  type="checkbox"
                  checked={r.show === "hidden"}
                  disabled={blocked}
                  onChange={(ev) => onChange((s) => void (s.cumulative.readings[i].show = ev.target.checked ? "hidden" : "show"))}
                />
                Hide (pupils read it)
              </label>
              <button type="button" disabled={blocked} onClick={() => onChange((s) => void s.cumulative.readings.splice(i, 1))}>
                Remove reading {i + 1}
              </button>
            </div>
          ))}
          <div className="ch-row">
            <button
              type="button"
              disabled={blocked || g.cumulative.readings.length >= MAX_GROUPED_READINGS}
              onClick={() => onChange((s) => void s.cumulative.readings.push({ axis: "y", value: "", show: "show" }))}
            >
              Add a reading
            </button>
          </div>
          <p className="ch-note">
            A reading draws dashed guides from a value on one axis to the curve and on to the other
            axis, for medians, quartiles and estimates. The value read off is never printed.
          </p>
        </section>
      )}
    </>
  );
}
