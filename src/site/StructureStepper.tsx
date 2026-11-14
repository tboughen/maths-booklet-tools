import { Minus, Plus } from "lucide-react";

export interface StepperAction {
  /** Accessible name, e.g. "Add column" or "Remove row 3". */
  label: string;
  /** Tooltip; defaults to the accessible name. */
  title?: string;
  disabled?: boolean;
  onClick: () => void;
}

/**
 * U6: the one structure control every editor uses to add or remove a row,
 * column, section, stage, level, category or cube. A labelled group with a
 * − and a + button of the same size and look in every tool. Horizontal
 * steppers read "− +" like a number stepper; vertical ones (in a gutter
 * beside the resource) put + above −.
 */
export function StructureStepper({
  name,
  caption,
  add,
  remove,
  vertical = false,
  className,
}: {
  /** The group's accessible name, e.g. "Columns". */
  name: string;
  /** Visible text beside the buttons; defaults to `name`. Pass "" for none. */
  caption?: string;
  add: StepperAction;
  remove: StepperAction;
  vertical?: boolean;
  className?: string;
}) {
  const text = caption ?? name;
  const button = (action: StepperAction, kind: "add" | "remove") => (
    <button
      type="button"
      className={`structure-stepper-${kind}`}
      aria-label={action.label}
      title={action.title ?? action.label}
      disabled={action.disabled}
      onClick={action.onClick}
    >
      {kind === "add" ? (
        <Plus size={20} aria-hidden="true" />
      ) : (
        <Minus size={20} aria-hidden="true" />
      )}
    </button>
  );
  return (
    <div
      className={
        "structure-stepper" +
        (vertical ? " structure-stepper--vertical" : "") +
        (className ? " " + className : "")
      }
      role="group"
      aria-label={name}
    >
      {text && (
        <span className="structure-stepper-caption" aria-hidden="true">
          {text}
        </span>
      )}
      {vertical ? button(add, "add") : button(remove, "remove")}
      {vertical ? button(remove, "remove") : button(add, "add")}
    </div>
  );
}
