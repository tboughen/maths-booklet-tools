import { Eye } from "lucide-react";
import "./answer-switch.css";

/** The one wording for a screen-only preview of saved hidden answers (improvement list U5). */
export const ANSWER_PREVIEW_LABEL = "Teacher preview: show hidden answers";
/** Wording for a switch that also changes downloads (Venn, charts, probability trees; Tim, 8 Nov). */
export const ANSWER_COPY_LABEL = "Teacher copy: show hidden answers";

interface AnswerSwitchProps {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * The answers switch of the house style (docs/tools/APP-HOUSE-STYLE.md): it reads "Show hidden
 * answers" everywhere and turns pink while it is on, with a small pink label over the corner of
 * the diagram. Pink means teacher only. Its full name says whether downloads change too.
 */
function AnswerSwitch({
  name,
  kind,
  title,
  note,
  checked,
  disabled,
  onChange,
}: AnswerSwitchProps & { name: string; kind: string; title: string; note: string }) {
  return (
    <>
      <label className={`answer-switch ${kind}`} title={title}>
        <input
          type="checkbox"
          aria-label={name}
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="answer-switch-track" aria-hidden="true" />
        Show hidden answers
      </label>
      {checked && (
        <span className="answer-chip">
          <Eye size={14} aria-hidden="true" />
          Teacher view: answers showing
          {/* A teacher copy changes what a download holds, so that one is announced. */}
          <span className="answer-chip-note" role={kind === "answer-copy-toggle" ? "status" : undefined}>
            {note}
          </span>
        </span>
      )}
    </>
  );
}

/**
 * Shows saved hidden answers on screen only. Downloads, links and editable files keep the saved
 * pupil visibility, so this is never a document setting. Sits in the action bar (U1).
 */
export function AnswerPreviewToggle(props: AnswerSwitchProps) {
  return (
    <AnswerSwitch
      {...props}
      name={ANSWER_PREVIEW_LABEL}
      kind="answer-preview-toggle"
      title="Screen only. Downloads keep the pupil version."
      note="Screen only: downloads keep the pupil version."
    />
  );
}

/**
 * Shows saved hidden answers on screen and in SVG and PNG downloads. Editable files and links keep
 * the saved pupil visibility. Sits in the action bar; while it is on, its pink label says that
 * downloads show the answers.
 */
export function AnswerCopyToggle(props: AnswerSwitchProps) {
  return (
    <AnswerSwitch
      {...props}
      name={ANSWER_COPY_LABEL}
      kind="answer-copy-toggle"
      title="Downloads show the answers too. Editable files keep the pupil version."
      note="Downloads show the answers too."
    />
  );
}
