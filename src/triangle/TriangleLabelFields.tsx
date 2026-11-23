import { useId } from "react";
import {
  getLabel,
  textOf,
  isStale,
  type Envelope,
  type Label,
} from "../../packages/triangle-core/src";
import { canMarkRight, chosenAway, labelState, seesOfLabel, stateFor, type LabelDraft } from "./labelDraft";
import { VisibilitySwitch } from "../site/VisibilitySwitch";

type Choice = { value: string; label: string; disabled?: boolean };

export function TriangleChoices({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string;
  value: string;
  options: Choice[];
  onChange: (value: string) => void;
}) {
  const name = useId();
  return (
    <fieldset className="tr-options">
      <legend>{legend}</legend>
      <div className="tr-options-list">
        {options.map((option) => (
          <label className="tr-option" key={option.value}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function savedText(e: Envelope, ref: string) {
  try {
    return textOf(e, getLabel(e, ref));
  } catch {
    return ""; // an area label not made yet
  }
}

export function TriangleLabelFields({
  e,
  draft,
  showAnswers,
  update,
}: {
  e: Envelope;
  draft: LabelDraft;
  showAnswers: boolean;
  update: (update: Partial<LabelDraft>) => void;
}) {
  const vertex = draft.ref.startsWith("v:"),
    angle = draft.ref.startsWith("a:"),
    side = draft.ref.startsWith("e:"),
    height = draft.ref.startsWith("h:"),
    caption = draft.ref.startsWith("c:"),
    area = draft.ref.startsWith("r:"),
    right = canMarkRight(e, draft.ref),
    patch = (change: Partial<Label>) =>
      update({ value: { ...draft.value, ...change } });
  const sees = seesOfLabel(draft.value),
    // Only a label with nothing in it yet, never made a pupil space on purpose, shows what is typed.
    blankHeld = !!draft.value.answer || savedText(e, draft.ref) !== "" || chosenAway(draft.ref);
  const display = (
    <>
      <VisibilitySwitch
        name="What pupils see"
        caption="What pupils see"
        value={sees}
        help={{
          hidden: "Pupils see a space to fill in. The answers copy shows the saved answer, if there is one.",
          omit: "Nothing prints on the pupil copy. A saved answer still prints in the answers copy.",
        }}
        onChange={(v) => update(labelState(draft, stateFor(draft.ref, draft.value, v)))}
      />
      {sees === "show" && !vertex && (
        <TriangleChoices
          legend="Shows"
          value={draft.value.state}
          options={[
            { value: "value", label: "Given / expression" },
            { value: "symbol", label: "Unknown (x)" },
          ]}
          onChange={(state) => update(labelState(draft, state as Label["state"]))}
        />
      )}
      {sees === "hidden" && (
        <label className="tr-check">
          <input
            type="checkbox"
            checked={draft.value.state === "answer-line"}
            onChange={(ev) => update(labelState(draft, ev.target.checked ? "answer-line" : "blank"))}
          />{" "}
          On an answer line
        </label>
      )}
    </>
  );
  return (
    <>
      <label>
        {vertex
          ? "Vertex name"
          : draft.value.shared
            ? "Linked label text"
            : draft.value.state === "symbol"
              ? "Unknown symbol"
              : draft.value.state === "value"
                ? "Value / expression"
                : "Label text"}
        <input
          data-tr-label-text
          autoComplete="off"
          value={draft.text}
          maxLength={vertex ? 8 : caption ? 120 : 40}
          onChange={(ev) =>
            update({
              text: ev.target.value,
              // A label with nothing in it yet shows what is typed; a pupil space that holds a value stays one.
              value: {
                ...draft.value,
                state: draft.value.state === "blank" && !blankHeld && ev.target.value ? "value" : draft.value.state,
              },
            })
          }
        />
      </label>
      {display}
      {angle && (
        <>
          <TriangleChoices
            legend="Angle marker"
            value={draft.mark}
            options={[
              { value: "none", label: "None" },
              { value: "arc", label: "Arc" },
              { value: "double", label: "Double arc" },
              { value: "triple", label: "Triple arc" },
              { value: "right", label: "Right angle", disabled: !right },
            ]}
            onChange={(mark) => update({ mark: mark as LabelDraft["mark"] })}
          />
          {!right && (
            <p className="tr-note">
              A right-angle square needs perpendicular sides. Use the triangle’s
              Shape locks first.
            </p>
          )}
        </>
      )}
      {!vertex && (
        <>
          {angle ? (
            <label className="tr-check">
              <input
                type="checkbox"
                checked={draft.value.unit === "°"}
                onChange={(ev) => patch({ unit: ev.target.checked ? "°" : "" })}
              />{" "}
              Show degree symbol
            </label>
          ) : (
            <TriangleChoices
              legend="Unit"
              value={draft.value.unit}
              options={[
                ...new Set([
                  ...(area
                    ? ["", "mm²", "cm²", "m²"]
                    : caption
                      ? ["", "mm", "cm", "m", "°", "mm²", "cm²", "m²"]
                      : ["", "mm", "cm", "m"]),
                  draft.value.unit,
                ]),
              ].map((value) => ({ value, label: value || "None" }))}
              onChange={(unit) => patch({ unit: unit as Label["unit"] })}
            />
          )}
          {!!draft.value.answer && (
            <p className="tr-note" role="status">
              {draft.value.answerVisible
                ? "Saved answer is currently printed."
                : showAnswers
                  ? "Preview shows the saved answer; pupil exports keep it hidden."
                  : "A saved answer is kept hidden."}
              {isStale(e, draft.value) && " This answer is out of date."}
            </p>
          )}
          <details
            className="tr-inner-section"
            open={draft.value.answerVisible || undefined}
          >
            <summary>Saved answer</summary>
            <div className="tr-inner-body">
              <label>
                Saved answer (optional)
                <input
                  value={draft.value.answer}
                  maxLength={40}
                  onChange={(ev) =>
                    patch({ answer: ev.target.value, calculation: null })
                  }
                />
              </label>
              <label className="tr-check">
                <input
                  type="checkbox"
                  checked={draft.value.answerVisible}
                  onChange={(ev) => patch({ answerVisible: ev.target.checked })}
                />{" "}
                Show answer in saved pupil resource
              </label>
            </div>
          </details>
          <details className="tr-inner-section">
            <summary>Presentation and marks</summary>
            <div className="tr-inner-body">
              <label>
                Prefix
                <input
                  value={draft.value.prefix}
                  maxLength={16}
                  onChange={(ev) => patch({ prefix: ev.target.value })}
                />
              </label>
              {side && (
                <>
                  <TriangleChoices
                    legend="Equal-side ticks"
                    value={String(draft.ticks)}
                    options={[0, 1, 2, 3].map((v) => ({
                      value: String(v),
                      label: v ? String(v) : "None",
                    }))}
                    onChange={(ticks) => update({ ticks: Number(ticks) })}
                  />
                  <TriangleChoices
                    legend="Parallel arrows"
                    value={String(draft.arrows)}
                    options={[0, 1, 2, 3].map((v) => ({
                      value: String(v),
                      label: v ? String(v) : "None",
                    }))}
                    onChange={(arrows) => update({ arrows: Number(arrows) })}
                  />
                  <label className="tr-check">
                    <input
                      type="checkbox"
                      checked={draft.dashed}
                      onChange={(ev) => update({ dashed: ev.target.checked })}
                    />{" "}
                    Dashed side
                  </label>
                </>
              )}
              {height && (
                <label>
                  Foot name (optional)
                  <input
                    value={draft.footName}
                    maxLength={8}
                    onChange={(ev) => update({ footName: ev.target.value })}
                  />
                </label>
              )}
            </div>
          </details>
        </>
      )}
      {draft.value.shared && (
        <p className="tr-note">
          This symbol is shared. Editing its text updates every linked copy;
          visibility and angle markers stay independent.
        </p>
      )}
      <details>
        <summary>Label position (mm)</summary>
        <div className="tr-two">
          <label>
            Horizontal offset
            <input
              type="number"
              step=".5"
              value={draft.value.dx}
              onChange={(ev) => patch({ dx: Number(ev.target.value) })}
            />
          </label>
          <label>
            Vertical offset
            <input
              type="number"
              step=".5"
              value={draft.value.dy}
              onChange={(ev) => patch({ dy: Number(ev.target.value) })}
            />
          </label>
        </div>
      </details>
    </>
  );
}
