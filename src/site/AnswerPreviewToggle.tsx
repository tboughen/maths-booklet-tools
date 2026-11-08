/** The one wording for a screen-only preview of saved hidden answers (improvement list U5). */
export const ANSWER_PREVIEW_LABEL = "Teacher preview: show hidden answers";

/**
 * Shows saved hidden answers on screen only. Downloads, links and editable files keep the saved
 * pupil visibility, so this is never a document setting. Sits after the export size in the
 * preview bar (U1).
 */
export function AnswerPreviewToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="answer-preview-toggle" title="Screen only. Downloads keep the pupil version.">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />{" "}
      {ANSWER_PREVIEW_LABEL}
    </label>
  );
}
