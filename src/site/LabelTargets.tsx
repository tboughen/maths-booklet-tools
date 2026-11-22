/**
 * The parts every diagram editor shares for editing labels on the drawing (the usability pilot on probability trees,
 * 21–22 Nov 2026, rolled out tool by tool):
 *
 * - `LabelHit`: a click target over a printed label. A click opens the options box with the text selected, ready to
 *   type; a double-click toggles a pupil space. A left-out label shows its value faintly on screen only.
 * - `useQuickTip` / `QuickTip`: the hint beside a label, shown at once on hover or focus (a browser tooltip waits).
 * - `useTargetReach`: every target reaches 24 px with a mouse and 44 px on a touch board without overlapping.
 * - `TypingField`: a field that keeps its draft; Enter or leaving applies; Escape undoes typing and otherwise closes.
 * - `StateTag` and `PupilSpaceHint` for the settings column.
 */
import { useEffect, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { togglePupilSpace, visibilityWords, type Visibility } from "../editor-kit/visibility";
import type { QuickTipState, useQuickTip } from "./labelTargetHooks";


/** Keeps its draft while typing; Enter or leaving applies; Escape undoes typing, and with nothing typed passes on. */
export function TypingField({
  id,
  label,
  value,
  onCommit,
  disabled,
  maxLength,
  className,
  inputMode,
  onHistory,
}: {
  id?: string;
  label: string;
  value: string;
  onCommit: (value: string) => void;
  disabled?: boolean;
  maxLength: number;
  className?: string;
  inputMode?: "decimal" | "numeric" | "text";
  /** With nothing typed, Ctrl+Z / Ctrl+Y go to the diagram's undo; return true when handled. */
  onHistory?: (event: ReactKeyboardEvent<HTMLInputElement>) => boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);
  const commit = () => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  };
  return (
    <input
      id={id}
      className={className}
      aria-label={label}
      value={draft}
      disabled={disabled}
      maxLength={maxLength}
      inputMode={inputMode}
      onChange={(ev) => {
        setEditing(true);
        setDraft(ev.target.value);
      }}
      onBlur={commit}
      onKeyDown={(ev) => {
        if (draft === value && onHistory?.(ev)) return;
        if (ev.key === "Enter") {
          ev.preventDefault();
          commit();
        }
        // Escape undoes typing; with nothing typed it passes on, so it closes the options box.
        if (ev.key === "Escape" && draft !== value) {
          ev.preventDefault();
          ev.stopPropagation();
          setDraft(value);
          setEditing(false);
        }
      }}
    />
  );
}


export function QuickTip({ id, tip }: { id: string; tip: QuickTipState | null }) {
  if (!tip) return null;
  return (
    <div id={id} className="pt-quick-tip" role="tooltip" data-edge={tip.edge ?? undefined} data-below={tip.below || undefined} style={{ left: tip.x, top: tip.y }}>
      {tip.text}
    </div>
  );
}


/** A click target over one printed label on the drawing. */
export function LabelHit({
  what,
  state,
  text,
  selected,
  boxOpen,
  pupilView,
  tipId,
  tipShown,
  tipHandlers,
  disabled,
  style,
  reach,
  ghostFontPx,
  coarse,
  onOpen,
  onVisibility,
}: {
  /** "probability for Red, Blue": the button's name is "Edit <what>". */
  what: string;
  state: Visibility;
  text: string;
  selected: boolean;
  boxOpen: boolean;
  pupilView: boolean;
  tipId: string;
  tipShown: boolean;
  tipHandlers: ReturnType<ReturnType<typeof useQuickTip>["bind"]>;
  disabled: boolean;
  style: CSSProperties;
  reach?: { x: number; y: number };
  ghostFontPx: number;
  coarse: boolean;
  onOpen: (anchor: HTMLElement) => void;
  onVisibility: (v: Visibility) => void;
}) {
  const words = visibilityWords(state);
  return (
    <button
      type="button"
      data-options-anchor=""
      className={`pt-hit ${selected ? "pt-selected" : ""} ${pupilView && state === "hidden" ? "pt-hidden-answer" : ""} ${state === "omit" ? "pt-omitted" : ""}`}
      aria-label={`Edit ${what}${words ? `, ${words}` : ""}`}
      aria-haspopup="dialog"
      aria-expanded={selected && boxOpen}
      aria-describedby={tipShown ? tipId : undefined}
      {...tipHandlers}
      disabled={disabled}
      style={{ ...style, "--pt-reach-x": `${reach?.x ?? 0}px`, "--pt-reach-y": `${reach?.y ?? 0}px` } as CSSProperties}
      onClick={(ev) => {
        // A box already open for this label takes the cursor back into its text, ready to type.
        if (!coarse && selected && boxOpen) {
          const field = document.querySelector<HTMLInputElement>(".md-options-box input:not([type=checkbox]):not([disabled])");
          field?.focus();
          field?.select();
        }
        onOpen(ev.currentTarget);
      }}
      // The first click opened the box; the box stays open and shows the new state.
      onDoubleClick={() => onVisibility(togglePupilSpace(state))}
    >
      {/* A left-out label shows its value faintly here on screen; it prints nothing. */}
      {state === "omit" && text.trim() && (
        <span className="pt-ghost" aria-hidden="true" style={{ fontSize: `${ghostFontPx}px` }}>
          {text}
        </span>
      )}
    </button>
  );
}

/** Under a field in the settings: what pupils see of it, when that is not the value. */
export function StateTag({ value }: { value: { show: Visibility } }) {
  if (value.show === "show") return null;
  return <span className={`pt-state pt-state-${value.show}`}>{value.show === "hidden" ? "pupil space" : "left out"}</span>;
}

/** The how-to, the count and Clear, under the What pupils see switches. */
export function PupilSpaceHint({ count, disabled, onClear, children }: { count: number; disabled: boolean; onClear: () => void; children?: ReactNode }) {
  return (
    <div className="pt-hint" aria-live="polite">
      <span>
        <span className="pt-hint-how">{children ?? "Double-click a label on the drawing for a pupil space."}</span> {count === 0 ? "None yet." : `${count} so far.`}
      </span>
      <button
        type="button"
        className="pt-link"
        aria-disabled={disabled || count === 0 || undefined}
        title={count === 0 ? "There are no pupil spaces to clear." : "Show every value again (one undo step)"}
        onClick={() => !disabled && count > 0 && onClear()}
      >
        Clear pupil spaces
      </button>
    </div>
  );
}
