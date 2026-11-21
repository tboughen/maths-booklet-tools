import { useId, useState, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import "./options-box.css";

/**
 * A card heading with a (?) that opens the card's help underneath, in place of long paragraphs that are always
 * there (the 21 Nov 2026 usability plan). The help is a screen note and never prints.
 */
export function CardHeading({ title, help }: { title: string; help?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <div className="md-card-head">
        <h2>{title}</h2>
        {help && (
          <button
            type="button"
            className="md-card-help"
            aria-expanded={open}
            aria-controls={id}
            aria-label={`Help: ${title}`}
            title={open ? "Hide help" : "Help"}
            onClick={() => setOpen((o) => !o)}
          >
            ?
          </button>
        )}
      </div>
      {help && open && (
        <div className="md-card-help-text" id={id}>
          {help}
        </div>
      )}
    </>
  );
}

/**
 * A number setting with − and + either side of its value ("Branch length − 24 mm +"). Each press is one step and one
 * undo step. `steps` lists the values a press moves between; a saved value off the list moves to its neighbour.
 */
export function NumberStepper({
  name,
  value,
  unit,
  steps,
  disabled,
  onChange,
}: {
  name: string;
  value: number;
  unit: string;
  steps: readonly number[];
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const down = [...steps].reverse().find((s) => s < value);
  const up = steps.find((s) => s > value);
  return (
    <div className="md-number-stepper" role="group" aria-label={name}>
      <span className="md-number-stepper-name" aria-hidden="true">
        {name}
      </span>
      <span className="md-number-stepper-row">
        <button type="button" aria-label={`Less ${name.toLowerCase()}`} title={down === undefined ? "Already the smallest" : `${down} ${unit}`} disabled={disabled || down === undefined} onClick={() => down !== undefined && onChange(down)}>
          <Minus size={16} aria-hidden="true" />
        </button>
        <output aria-live="polite">
          {value} {unit}
        </output>
        <button type="button" aria-label={`More ${name.toLowerCase()}`} title={up === undefined ? "Already the largest" : `${up} ${unit}`} disabled={disabled || up === undefined} onClick={() => up !== undefined && onChange(up)}>
          <Plus size={16} aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}
