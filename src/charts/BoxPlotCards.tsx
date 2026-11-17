import type { ReactNode } from "react";
import { BOX_BAND_MM, STEP_MM, boxAxisLineChoices, boxAxisLineNames, boxValueLabels, boxValuePhrases, boxValueNames, type BoxplotSettings } from "../../packages/chart-core/src";
import { DraftField } from "./DraftField";

const STEP_CHOICES = Array.from({ length: (STEP_MM.maximum - STEP_MM.minimum) / 2 + 1 }, (_, i) => STEP_MM.minimum + 2 * i);
const BAND_CHOICES = Array.from({ length: (BOX_BAND_MM.maximum - BOX_BAND_MM.minimum) / 2 + 1 }, (_, i) => BOX_BAND_MM.minimum + 2 * i);

/** Settings cards for box plots: the plots' five values and the scale. */
export function BoxPlotCards({
  b,
  blocked,
  selected,
  issues,
  onChange,
  linesControl,
  part,
}: {
  b: BoxplotSettings;
  blocked: boolean;
  selected: string | null;
  issues: string[];
  onChange: (update: (s: BoxplotSettings) => void) => void;
  linesControl: ReactNode;
  /** The data card, or the cards of settings that follow it: each has its own column in a wide window. */
  part: "data" | "rest";
}) {
  const bad = (row: number, phrase: string) => issues.some((x) => x.startsWith(`Box plot ${row + 1}:`) && x.includes(phrase));
  const axisBad = (field: "min" | "max" | "step") =>
    issues.some((x) => {
      if (!x.includes("horizontal axis")) return false;
      if (field === "min") return x.includes("axis start") || x.includes("greater than its start");
      if (field === "max") return x.includes("axis end");
      return x.includes("axis step") || x.includes("steps on the");
    });
  return (
    <>
      {part === "data" && (
      <section className="panel-card ch-panel">
        <h2>Box plots</h2>
        {b.rows.map((r, ri) => (
          <fieldset className="ch-fieldset" key={ri}>
            <legend>Box plot {ri + 1}</legend>
            <div className="ch-fields">
              <label className="ch-wide">
                Label
                <DraftField label={`Box plot ${ri + 1} label`} value={r.label} maxLength={24} disabled={blocked} onCommit={(v) => onChange((s) => void (s.rows[ri].label = v))} />
              </label>
              {boxValueNames.map((k) => (
                <div key={k} className="ch-box-value">
                  <label>
                    {boxValueLabels[k]}
                    <DraftField
                      id={`ch-box-${k}-${ri}`}
                      className={selected === `ch-box-${k}-${ri}` ? "ch-field-selected" : ""}
                      label={`Box plot ${ri + 1} ${boxValuePhrases[k]}`}
                      value={r[k].value}
                      maxLength={12}
                      inputMode="decimal"
                      disabled={blocked}
                      invalid={bad(ri, boxValuePhrases[k])}
                      onCommit={(v) => onChange((s) => void (s.rows[ri][k].value = v))}
                    />
                  </label>
                  <label className="ch-hide">
                    <input
                      type="checkbox"
                      aria-label={`Hide the ${boxValuePhrases[k]} of box plot ${ri + 1} for pupils`}
                      checked={r[k].show === "hidden"}
                      disabled={blocked}
                      onChange={(ev) => onChange((s) => void (s.rows[ri][k].show = ev.target.checked ? "hidden" : "show"))}
                    />
                    Hide
                  </label>
                </div>
              ))}
            </div>
            <div className="ch-row">
              <button type="button" disabled={blocked} onClick={() => onChange((s) => boxValueNames.forEach((k) => (s.rows[ri][k].show = "hidden")))}>
                Hide this plot (pupils draw it)
              </button>
            </div>
          </fieldset>
        ))}
        <p className="ch-note">
          Values stay as typed. Leave every value blank for an empty band where pupils draw a plot. A hidden value leaves its line, and the parts that need it, for pupils. Use +
          and − beside the diagram to add or remove the last plot.
        </p>
        <div className="ch-row">
          <button
            type="button"
            disabled={blocked || !b.rows.some((r) => boxValueNames.some((k) => r[k].show === "hidden"))}
            onClick={() => onChange((s) => s.rows.forEach((r) => boxValueNames.forEach((k) => (r[k].show = "show"))))}
          >
            Show all
          </button>
        </div>
      </section>
      )}
      {part === "rest" && (
      <>
      <section className="panel-card ch-panel">
        <h2>Scale and graph paper</h2>
        <fieldset className="ch-fieldset">
          <legend>Scale</legend>
          <div className="ch-fields">
            {(["min", "max", "step"] as const).map((f) => (
              <label key={f}>
                {{ min: "Start", max: "End", step: "Step" }[f]}
                <DraftField
                  label={`Scale ${{ min: "start", max: "end", step: "step" }[f]}`}
                  value={b.axis[f]}
                  maxLength={12}
                  inputMode="decimal"
                  disabled={blocked}
                  invalid={axisBad(f)}
                  onCommit={(v) => onChange((s) => void (s.axis[f] = v))}
                />
              </label>
            ))}
            <label>
              Step length (mm)
              <select aria-label="Scale step length" value={b.axis.stepMm} disabled={blocked} onChange={(ev) => onChange((s) => void (s.axis.stepMm = Number(ev.target.value)))}>
                {STEP_CHOICES.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
            <label className="ch-wide">
              Title
              <DraftField label="Scale title" value={b.axis.title} maxLength={40} disabled={blocked} onCommit={(v) => onChange((s) => void (s.axis.title = v))} />
            </label>
          </div>
        </fieldset>
        <div className="ch-fields">
          <label>
            Height per plot (mm)
            <select aria-label="Height per plot" value={b.bandMm} disabled={blocked} onChange={(ev) => onChange((s) => void (s.bandMm = Number(ev.target.value)))}>
              {BAND_CHOICES.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          <label>
            Axis
            <select aria-label="Axis line" value={b.line} disabled={blocked} onChange={(ev) => onChange((s) => void (s.line = ev.target.value as BoxplotSettings["line"]))}>
              {boxAxisLineChoices.map((x) => (
                <option key={x} value={x}>
                  {boxAxisLineNames[x]}
                </option>
              ))}
            </select>
          </label>
          {linesControl}
        </div>
        <p className="ch-note">Graph paper is true size, 2 mm squares with heavier lines every 1 cm and 2 cm. Boxes and end lines are 1 cm tall.</p>
      </section>
      </>
      )}
    </>
  );
}
