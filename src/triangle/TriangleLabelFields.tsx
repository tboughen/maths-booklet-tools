import { useId } from "react";
import {
  isStale,
  type Envelope,
  type Label,
} from "../../packages/triangle-core/src";
import { canMarkRight, labelState, type LabelDraft } from "./labelDraft";

type Choice = { value: string; label: string; disabled?: boolean };
const states: Choice[] = [
  { value: "value", label: "Given / expression" },
  { value: "symbol", label: "Unknown (x)" },
  { value: "blank", label: "Blank" },
  { value: "answer-line", label: "Answer line" },
  { value: "hidden", label: "Hidden" },
];

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
  const display = (
    <>
      <TriangleChoices
        legend="Label display"
        value={draft.value.state}
        options={states}
        onChange={(state) => update(labelState(draft, state as Label["state"]))}
      />
      <p className="tr-note">
        Blank leaves an editable position. Hidden keeps the saved text without
        printing its label.
      </p>
    </>
  );
  return (
    <>
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
      {!vertex && display}
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
              value: {
                ...draft.value,
                state:
                  draft.value.state === "blank" && ev.target.value
                    ? "value"
                    : draft.value.state,
              },
            })
          }
        />
      </label>
      {vertex && (
        <>
          {draft.value.state !== "value" && (
            <p className="tr-note">
              Name display:{" "}
              {states.find((s) => s.value === draft.value.state)?.label}. Change
              it in More label options.
            </p>
          )}
          <details className="tr-inner-section">
            <summary>More label options</summary>
            {display}
          </details>
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
