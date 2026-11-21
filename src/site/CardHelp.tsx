import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { ChevronDown, Minus, Plus, type LucideIcon } from "lucide-react";
import "./options-box.css";

/**
 * The (?) beside a card's heading: the card's help in a small pop-up, in place of paragraphs that are always there
 * (the 21 Nov 2026 usability plan). Escape or a press elsewhere closes it. A screen note; it never prints.
 */
function HelpPop({ title, help }: { title: string; help: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      wrap.current?.querySelector("button")?.focus();
    };
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <span className="md-card-help-wrap" ref={wrap}>
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
      {open && (
        <span className="md-card-help-pop" id={id} role="note">
          <strong>{title}</strong>
          {help}
        </span>
      )}
    </span>
  );
}

/** A card heading with its (?) help. */
export function CardHeading({ title, help }: { title: string; help?: ReactNode }) {
  return (
    <div className="md-card-head">
      <h2>{title}</h2>
      {help && <HelpPop title={title} help={help} />}
    </div>
  );
}

/** Opened folds, per viewer and tool: a convenience only, so storage that fails is ignored. */
const foldKey = (tool: string, title: string) => `mathsdock:fold:${tool}:${title}`;
function readFold(tool: string, title: string) {
  try {
    return localStorage.getItem(foldKey(tool, title)) === "open";
  } catch {
    return false;
  }
}
function writeFold(tool: string, title: string, open: boolean) {
  try {
    if (open) localStorage.setItem(foldKey(tool, title), "open");
    else localStorage.removeItem(foldKey(tool, title));
  } catch {
    /* Nothing to keep. */
  }
}

/**
 * A rarer settings group folded into one row: its icon, its name and a one-line summary of what is set
 * ("32 mm branches · 14 mm spacing"), so every setting can be read without opening anything. Pressing the row opens
 * the group; the browser remembers which groups a teacher keeps open.
 */
export function FoldCard({
  tool,
  title,
  icon: Icon,
  summary,
  help,
  children,
}: {
  tool: string;
  title: string;
  icon: LucideIcon;
  summary: string;
  help?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => readFold(tool, title));
  const body = useId();
  return (
    <section className={`panel-card md-fold${open ? " md-fold--open" : ""}`}>
      <div className="md-fold-head">
        <span className="md-fold-icon" aria-hidden="true">
          <Icon size={16} />
        </span>
        <span className="md-fold-words">
          <h2>
            <button
              type="button"
              className="md-fold-toggle"
              aria-expanded={open}
              aria-controls={body}
              onClick={() =>
                setOpen((o) => {
                  writeFold(tool, title, !o);
                  return !o;
                })
              }
            >
              {title}
            </button>
          </h2>
          <span className="md-fold-summary">{summary}</span>
        </span>
        {open && help && <HelpPop title={title} help={help} />}
        <ChevronDown className="md-fold-chevron" size={18} aria-hidden="true" />
      </div>
      {open && (
        <div className="md-fold-body" id={body}>
          {children}
        </div>
      )}
    </section>
  );
}

/**
 * A size with − and + either side of a box you can type in ("− [32 mm] +"). A press moves to the next value in
 * `steps`; a typed whole number between `min` and `max` is taken as it is. Each change is one undo step.
 */
export function NumberStepper({
  name,
  value,
  unit,
  steps,
  min,
  max,
  disabled,
  onChange,
}: {
  name: string;
  value: number;
  unit: string;
  steps: readonly number[];
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const down = [...steps].reverse().find((s) => s < value);
  const up = steps.find((s) => s > value);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft.replace(unit, "").trim());
    if (Number.isInteger(n) && n >= min && n <= max) {
      setDraft(null);
      setError(false);
      if (n !== value) onChange(n);
    } else setError(true);
  };
  return (
    <div className="md-number-stepper" role="group" aria-label={name}>
      <span className="md-number-stepper-name" aria-hidden="true">
        {name}
      </span>
      <span className="md-number-stepper-row">
        <button type="button" aria-label={`Less ${name.toLowerCase()}`} title={down === undefined ? "Already the smallest" : `${down} ${unit}`} disabled={disabled || down === undefined} onClick={() => down !== undefined && onChange(down)}>
          <Minus size={16} aria-hidden="true" />
        </button>
        <span className="md-number-stepper-box">
          <input
            aria-label={`${name} (${unit})`}
            inputMode="numeric"
            value={draft ?? `${value} ${unit}`}
            disabled={disabled}
            aria-invalid={error || undefined}
            title={error ? `Type a whole number from ${min} to ${max}.` : `${min} to ${max} ${unit}`}
            onFocus={(ev) => ev.currentTarget.select()}
            onChange={(ev) => {
              setDraft(ev.target.value);
              setError(false);
            }}
            onBlur={commit}
            onKeyDown={(ev: ReactKeyboardEvent<HTMLInputElement>) => {
              if (ev.key === "Enter") {
                ev.preventDefault();
                commit();
              }
              if (ev.key === "Escape") {
                ev.preventDefault();
                ev.stopPropagation();
                setDraft(null);
                setError(false);
              }
            }}
          />
        </span>
        <button type="button" aria-label={`More ${name.toLowerCase()}`} title={up === undefined ? "Already the largest" : `${up} ${unit}`} disabled={disabled || up === undefined} onClick={() => up !== undefined && onChange(up)}>
          <Plus size={16} aria-hidden="true" />
        </button>
      </span>
      {error && <span className="md-number-stepper-error" role="alert">Type a whole number from {min} to {max}.</span>}
    </div>
  );
}
