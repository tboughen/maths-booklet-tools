import type { ReactNode } from "react";
import { STEP_MM, type TimeseriesSettings } from "../../packages/chart-core/src";
import { DraftField } from "./DraftField";

const STEP_CHOICES = Array.from({ length: (STEP_MM.maximum - STEP_MM.minimum) / 2 + 1 }, (_, i) => STEP_MM.minimum + 2 * i);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Settings cards for time series graphs: the times and their values, and the axes. */
export function TimeSeriesCards({
  t,
  blocked,
  selected,
  issues,
  onChange,
  linesControl,
}: {
  t: TimeseriesSettings;
  blocked: boolean;
  selected: string | null;
  issues: string[];
  onChange: (update: (s: TimeseriesSettings) => void) => void;
  linesControl: ReactNode;
}) {
  const bad = (i: number) => issues.some((x) => x.startsWith(`Time ${i + 1}:`) || x.startsWith(`Time ${i + 1} (`));
  const axisBad = (field: "min" | "max" | "step") =>
    issues.some((x) => {
      if (!x.includes("vertical axis") || x.startsWith("Time")) return false;
      if (field === "min") return x.includes("axis start") || x.includes("greater than its start");
      if (field === "max") return x.includes("axis end");
      return x.includes("axis step") || x.includes("steps on the");
    });
  /** Relabel the times as they stand; groups, values, hidden flags and the number of times are kept. */
  const relabel = (label: (i: number) => string) => onChange((s) => s.points.forEach((p, i) => (p.label = label(i))));
  return (
    <>
      <section className="panel-card ch-panel">
        <h2>Times and values</h2>
        <div className="ch-table-wrap">
          <table className="ch-table ch-points ch-times">
            <thead>
              <tr>
                <th scope="col" aria-label="Time">#</th>
                <th scope="col">Label</th>
                <th scope="col">Group</th>
                <th scope="col">Value</th>
                <th scope="col">Hide</th>
              </tr>
            </thead>
            <tbody>
              {t.points.map((p, i) => (
                <tr key={i}>
                  <th scope="row">{i + 1}</th>
                  <td>
                    <DraftField label={`Time ${i + 1} label`} value={p.label} maxLength={12} disabled={blocked} onCommit={(v) => onChange((s) => void (s.points[i].label = v))} />
                  </td>
                  <td>
                    <DraftField label={`Time ${i + 1} group`} value={p.group} maxLength={12} disabled={blocked} onCommit={(v) => onChange((s) => void (s.points[i].group = v))} />
                  </td>
                  <td>
                    <DraftField
                      id={`ch-time-value-${i}`}
                      className={selected === `ch-time-value-${i}` ? "ch-field-selected" : ""}
                      label={`Time ${i + 1} value`}
                      value={p.value}
                      maxLength={12}
                      inputMode="decimal"
                      disabled={blocked}
                      invalid={bad(i)}
                      onCommit={(v) => onChange((s) => void (s.points[i].value = v))}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Hide the value for time ${i + 1} for pupils`}
                      checked={p.show === "hidden"}
                      disabled={blocked}
                      onChange={(ev) => onChange((s) => void (s.points[i].show = ev.target.checked ? "hidden" : "show"))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ch-note">
          Values stay as typed. Leave a value blank for no point; 0 is a value. A hidden value is left for
          pupils to plot, and the lines to it are left too. A group (such as a year) prints once under
          its run of times. Use + and − beside the graph to add or remove the last time.
        </p>
        <div className="ch-row">
          <button type="button" disabled={blocked} onClick={() => relabel((i) => MONTHS[i % 12])}>
            Label as months
          </button>
          <button type="button" disabled={blocked} onClick={() => relabel((i) => String((i % 4) + 1))}>
            Label as quarters
          </button>
          <button type="button" disabled={blocked} onClick={() => relabel((i) => DAYS[i % 7])}>
            Label as days
          </button>
        </div>
        <div className="ch-row">
          <button type="button" disabled={blocked} onClick={() => onChange((s) => s.points.forEach((p) => (p.show = "hidden")))}>
            Hide every value (pupils plot the graph)
          </button>
          <button type="button" disabled={blocked || !t.points.some((p) => p.show === "hidden")} onClick={() => onChange((s) => s.points.forEach((p) => (p.show = "show")))}>
            Show all
          </button>
        </div>
      </section>
      <section className="panel-card ch-panel">
        <h2>Axes and graph paper</h2>
        <fieldset className="ch-fieldset">
          <legend>Horizontal axis (time)</legend>
          <div className="ch-fields">
            <label>
              Space between times (mm)
              <select aria-label="Space between times" value={t.slotMm} disabled={blocked} onChange={(ev) => onChange((s) => void (s.slotMm = Number(ev.target.value)))}>
                {STEP_CHOICES.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
            <label className="ch-wide">
              Title
              <DraftField label="Horizontal axis title" value={t.xTitle} maxLength={40} disabled={blocked} onCommit={(v) => onChange((s) => void (s.xTitle = v))} />
            </label>
          </div>
        </fieldset>
        <fieldset className="ch-fieldset">
          <legend>Vertical axis</legend>
          <div className="ch-fields">
            {(["min", "max", "step"] as const).map((f) => (
              <label key={f}>
                {{ min: "Start", max: "End", step: "Step" }[f]}
                <DraftField
                  label={`Vertical axis ${{ min: "start", max: "end", step: "step" }[f]}`}
                  value={t.yAxis[f]}
                  maxLength={12}
                  inputMode="decimal"
                  disabled={blocked}
                  invalid={axisBad(f)}
                  onCommit={(v) => onChange((s) => void (s.yAxis[f] = v))}
                />
              </label>
            ))}
            <label>
              Step length (mm)
              <select aria-label="Vertical axis step length" value={t.yAxis.stepMm} disabled={blocked} onChange={(ev) => onChange((s) => void (s.yAxis.stepMm = Number(ev.target.value)))}>
                {STEP_CHOICES.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
            <label className="ch-wide">
              Title
              <DraftField label="Vertical axis title" value={t.yAxis.title} maxLength={40} disabled={blocked} onCommit={(v) => onChange((s) => void (s.yAxis.title = v))} />
            </label>
          </div>
        </fieldset>
        <div className="ch-fields">{linesControl}</div>
        <p className="ch-note">Graph paper is true size: 2 mm squares with heavier lines every 1 cm and 2 cm. The first time sits on the vertical axis.</p>
      </section>
    </>
  );
}
