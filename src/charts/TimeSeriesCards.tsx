import type { ReactNode } from "react";
import { STEP_MM, timeJoinChoices, timeJoinNames, type TimeseriesSettings } from "../../packages/chart-core/src";
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
  part,
}: {
  t: TimeseriesSettings;
  blocked: boolean;
  selected: string | null;
  issues: string[];
  onChange: (update: (s: TimeseriesSettings) => void) => void;
  linesControl: ReactNode;
  /** The data card, or the cards of settings that follow it: each has its own column in a wide window. */
  part: "data" | "rest";
}) {
  const bad = (i: number, second = false) =>
    issues.some((x) => (x.startsWith(`Time ${i + 1}:`) || x.startsWith(`Time ${i + 1} (`)) && x.includes("second value") === second);
  const two = t.second;
  const axisBad = (field: "min" | "max" | "step") =>
    issues.some((x) => {
      if (!x.includes("vertical axis") || x.startsWith("Time")) return false;
      if (field === "min") return x.includes("axis start") || x.includes("greater than its start");
      if (field === "max") return x.includes("axis end");
      return x.includes("axis step") || x.includes("steps on the");
    });
  /** Relabel the times as they stand; groups, values, hidden flags and the number of times are kept. */
  const relabel = (label: (i: number) => string) => onChange((s) => s.points.forEach((p, i) => (p.label = label(i))));
  if (part === "data") return (
      <section className="panel-card ch-panel">
        <h2>Times and values</h2>
        <div className="ch-table-wrap">
          <table className="ch-table ch-points ch-times">
            <thead>
              <tr>
                <th scope="col" aria-label="Time">#</th>
                <th scope="col">Label</th>
                <th scope="col">Group</th>
                <th scope="col">{two ? t.names[0].trim() || "First value" : "Value"}</th>
                {two && <th scope="col">{t.names[1].trim() || "Second value"}</th>}
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
                  {two && (
                    <td>
                      <DraftField
                        id={`ch-time-value2-${i}`}
                        className={selected === `ch-time-value2-${i}` ? "ch-field-selected" : ""}
                        label={`Time ${i + 1} second value`}
                        value={p.value2}
                        maxLength={12}
                        inputMode="decimal"
                        disabled={blocked}
                        invalid={bad(i, true)}
                        onCommit={(v) => onChange((s) => void (s.points[i].value2 = v))}
                      />
                    </td>
                  )}
                  <td className="ch-class-hide">
                    <label className="ch-hide">
                      <input
                        type="checkbox"
                        aria-label={`Hide the label for time ${i + 1} for pupils`}
                        checked={p.labelShow === "hidden"}
                        disabled={blocked}
                        onChange={(ev) => onChange((s) => void (s.points[i].labelShow = ev.target.checked ? "hidden" : "show"))}
                      />
                      Label
                    </label>
                    <label className="ch-hide">
                      <input
                        type="checkbox"
                        aria-label={`Hide the value for time ${i + 1} for pupils`}
                        checked={p.show === "hidden"}
                        disabled={blocked}
                        onChange={(ev) => onChange((s) => void (s.points[i].show = ev.target.checked ? "hidden" : "show"))}
                      />
                      {two ? "First" : "Value"}
                    </label>
                    {two && (
                      <label className="ch-hide">
                        <input
                          type="checkbox"
                          aria-label={`Hide the second value for time ${i + 1} for pupils`}
                          checked={p.show2 === "hidden"}
                          disabled={blocked}
                          onChange={(ev) => onChange((s) => void (s.points[i].show2 = ev.target.checked ? "hidden" : "show"))}
                        />
                        Second
                      </label>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ch-note">
          Values stay as typed. Leave a value blank for no point; 0 is a value. A hidden value is left for
          pupils to plot, and the lines to it are left too; a hidden label is left for pupils to write.
          A blank label is a missing label. A group (such as a year) prints once under its run of
          times. Use + and − beside the graph to add or remove the last time.
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
          <button type="button" disabled={blocked} onClick={() => onChange((s) => s.points.forEach((p) => (p.show = p.show2 = "hidden")))}>
            Hide every value (pupils plot the graph)
          </button>
          <button
            type="button"
            disabled={blocked || !t.points.some((p) => p.show === "hidden" || p.show2 === "hidden" || p.labelShow === "hidden")}
            onClick={() => onChange((s) => s.points.forEach((p) => (p.show = p.show2 = p.labelShow = "show")))}
          >
            Show all
          </button>
        </div>
      </section>
  );
  return (
    <>
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
        <div className="ch-fields">
          <label className="ch-check">
            <input type="checkbox" checked={t.yBreak} disabled={blocked} onChange={(ev) => onChange((s) => void (s.yBreak = ev.target.checked))} />
            Zig-zag on the vertical axis (it starts above 0)
          </label>
          <label>
            Join the points with
            <select aria-label="Join the points with" value={t.join} disabled={blocked} onChange={(ev) => onChange((s) => void (s.join = ev.target.value as TimeseriesSettings["join"]))}>
              {timeJoinChoices.map((x) => (
                <option key={x} value={x}>
                  {timeJoinNames[x]}
                </option>
              ))}
            </select>
          </label>
          <label className="ch-check">
            <input type="checkbox" checked={t.bridge} disabled={blocked} onChange={(ev) => onChange((s) => void (s.bridge = ev.target.checked))} />
            Join across a time with no value (misleading)
          </label>
          {linesControl}
        </div>
        <div className="ch-fields">
          <label className="ch-check">
            <input type="checkbox" checked={t.second} disabled={blocked} onChange={(ev) => onChange((s) => void (s.second = ev.target.checked))} />
            Two time series, with a key
          </label>
          {t.second &&
            ([0, 1] as const).map((k) => (
              <label key={k}>
                {k ? "Second name (dashed)" : "First name"}
                <DraftField
                  label={k ? "Second series name" : "First series name"}
                  value={t.names[k]}
                  maxLength={24}
                  disabled={blocked}
                  invalid={issues.some((x) => x.startsWith("Name both"))}
                  onCommit={(v) => onChange((s) => void (s.names[k] = v))}
                />
              </label>
            ))}
        </div>
        <p className="ch-note">
          Graph paper is true size: 2 mm squares with heavier lines every 1 cm and 2 cm. The first time
          sits on the vertical axis. For &quot;what is misleading&quot; questions, start the vertical axis above 0
          without the zig-zag, leave a label blank, join the points with a curve, or leave a time with no value
          and join across it.
        </p>
      </section>
    </>
  );
}
