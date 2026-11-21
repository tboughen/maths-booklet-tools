import "./options-box.css";
import { VISIBILITIES, VISIBILITY_HELP, VISIBILITY_NAMES, type Visibility } from "../editor-kit/visibility";

/**
 * What pupils see: Show / Pupil space / Leave out, the same three buttons in the options box beside a label and in a
 * tool's "What pupils see" card. A group whose labels differ shows "Mixed" with no button pressed; pressing one sets
 * them all (one undo step, by the caller).
 */
export function VisibilitySwitch({
  name,
  value,
  disabled,
  onChange,
  caption,
}: {
  /** The group's accessible name, e.g. "What pupils see" or "Probabilities". */
  name: string;
  value: Visibility | "mixed";
  disabled?: boolean;
  onChange: (v: Visibility) => void;
  /** Visible words before the buttons; defaults to none. */
  caption?: string;
}) {
  return (
    <div className="md-visibility" role="group" aria-label={name}>
      {caption && (
        <span className="md-visibility-caption" aria-hidden="true">
          {caption}
          {value === "mixed" && <em> · Mixed</em>}
        </span>
      )}
      <span className="md-visibility-buttons">
        {VISIBILITIES.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            data-visibility={v}
            title={VISIBILITY_HELP[v]}
            disabled={disabled}
            onClick={() => onChange(v)}
          >
            {VISIBILITY_NAMES[v]}
          </button>
        ))}
      </span>
      {!caption && value === "mixed" && <span className="md-visibility-mixed">Mixed</span>}
    </div>
  );
}
