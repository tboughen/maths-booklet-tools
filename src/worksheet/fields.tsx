import { useEffect, useState, type ReactNode } from "react";
import type { Item } from "../../packages/resource-core/src/index";
import { ANSWER_MAX, besideIssueAt } from "../../packages/resource-core/src/schema";
import { FAMILIES } from "../../packages/diagram-core/src/registry";

/** Editing controls shared by the worksheet and booklet editors. */
export type Leaf = Exclude<Item, { type: "part" }>;
type Cell = Extract<Leaf, { type: "table" }>["rows"][number][number];
const familyLabel = (kind: keyof typeof FAMILIES) => {
  const l = FAMILIES[kind].label;
  return l[0].toUpperCase() + l.slice(1);
};

export /**
 * Typing stays local; leaving the field or Enter applies one undoable change, Escape restores. When the page
 * refuses the change (`onCommit` returns false, W12), the typed text stays in the field, marked invalid,
 * beside the page's specific message, so nothing the teacher typed disappears.
 */
function Field({ label, value, onCommit, max, multiline, lines, disabled }: { label: string; value: string; onCommit: (v: string) => boolean | void; max: number; multiline?: boolean; /** Keeps line breaks: Enter starts a new line, leaving the field applies. */ lines?: boolean; disabled?: boolean }) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const [refused, setRefused] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);
  // A refused draft belongs to the value it was typed over: when that value changes (undo, redo, an
  // item moving into this place), the stale draft gives way to the new saved text.
  const [typedOver, setTypedOver] = useState(value);
  if (typedOver !== value) {
    setTypedOver(value);
    if (refused) {
      setRefused(false);
      setEditing(false);
      setDraft(value);
    }
  }
  const commit = () => {
    // Saved text is one line (line breaks become spaces), except where lines are kept.
    const clean = lines ? draft.replace(/\r\n?/g, "\n").replace(/\t/g, " ") : draft.replace(/[\r\n\t]+/g, " ");
    const kept = clean !== value && onCommit(clean) === false;
    setRefused(kept);
    setEditing(kept);
  };
  const common = {
    "aria-label": label,
    "aria-invalid": refused || undefined,
    value: draft,
    maxLength: max,
    disabled,
    onChange: (e: { target: { value: string } }) => {
      setEditing(true);
      setDraft(e.target.value);
    },
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !lines && !(multiline && e.shiftKey)) {
        e.preventDefault();
        commit();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setDraft(value);
        setEditing(false);
        setRefused(false);
      }
    },
  };
  return (
    <label className="ws-field">
      <span>{label}</span>
      {multiline || lines ? <textarea rows={Math.min(lines ? 8 : 5, Math.max(2, Math.ceil(value.length / 48), lines ? value.split("\n").length : 0))} {...common} /> : <input {...common} />}
      {refused && <small className="ws-field-refused">Not applied: the change was refused (see the message above). Fix it, or press Escape to restore.</small>}
    </label>
  );
}

export function NumberField({ label, value, min, max, onCommit, disabled }: { label: string; value: number; min: number; max: number; onCommit: (v: number) => void; disabled?: boolean }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const v = Math.round(Number(draft));
    if (!Number.isFinite(v)) return setDraft(String(value));
    const clamped = Math.min(max, Math.max(min, v));
    setDraft(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };
  return (
    <label className="ws-field ws-number">
      <span>{label}</span>
      <input type="number" min={min} max={max} step={1} value={draft} disabled={disabled} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} />
    </label>
  );
}

const CELL_STATES: [Cell["state"], string][] = [
  ["supplied", "Given"],
  ["blank", "Blank for pupils"],
  ["hidden", "Hidden answer"],
];

export function LeafEditor({ item, set, label, disabled: blocked }: { item: Leaf; set: (next: Leaf) => boolean | void; label: string; disabled: boolean }): ReactNode {
    switch (item.type) {
      case "text":
      case "info":
      case "claim":
        return <Field label={item.type === "info" ? `${label} key fact` : item.type === "claim" ? `${label} pupil's claim` : `${label} text`} value={item.text} max={item.type === "text" ? 600 : item.type === "info" ? 400 : 300} multiline disabled={blocked} onCommit={(text) => set({ ...item, text })} />;
      case "bullets":
        return item.items.map((b, i) => <Field key={i} label={`${label} bullet ${i + 1}`} value={b} max={200} disabled={blocked} onCommit={(v) => set({ ...item, items: item.items.map((x, j) => (j === i ? v : x)) })} />);
      case "table":
        return (
          <div className="ws-table-edit" role="group" aria-label={`${label} table`}>
            <label className="ws-field">
              <span>Shaded first row</span>
              <select
                aria-label={`${label} shaded first row`}
                value={item.columns ? "headings" : "cells"}
                disabled={blocked || (!item.columns && item.rows.length < 2)}
                onChange={(e) => {
                  // Printed headings, or a first row whose cells can be blank or hidden (an x row
                  // along the page). Switching keeps every cell's text.
                  if (e.target.value === "cells" && item.columns) {
                    const { columns, ...rest } = item;
                    set({ ...rest, rows: [columns.map((text) => ({ text, state: "supplied" as const })), ...item.rows] });
                  } else if (e.target.value === "headings" && !item.columns && item.rows.length > 1)
                    set({ ...item, columns: item.rows[0].map((c) => c.text), rows: item.rows.slice(1) });
                }}
              >
                <option value="headings">Printed headings</option>
                <option value="cells">Cells that can be blank or hidden</option>
              </select>
            </label>
            {item.columns && (
              <div className="ws-table-row">
                {item.columns.map((c, i) => (
                  <Field key={i} label={`Heading ${i + 1}`} value={c} max={40} disabled={blocked} onCommit={(v) => set({ ...item, columns: item.columns!.map((x, j) => (j === i ? v : x)) })} />
                ))}
              </div>
            )}
            {item.rows.map((row, ri) => (
              <div className="ws-table-row" key={ri}>
                {row.map((cell, ci) => {
                  const put = (c: Cell) => set({ ...item, rows: item.rows.map((rr, i) => (i === ri ? rr.map((x, j) => (j === ci ? c : x)) : rr)) });
                  return (
                    <div className={`ws-cell ws-cell--${cell.state}`} key={ci}>
                      <Field label={`Row ${ri + 1} cell ${ci + 1}${cell.state === "hidden" ? " (saved answer)" : ""}`} value={cell.text} max={40} disabled={blocked} onCommit={(text) => put({ ...cell, text })} />
                      <select aria-label={`Row ${ri + 1} cell ${ci + 1} shows`} value={cell.state} disabled={blocked} onChange={(e) => put({ ...cell, state: e.target.value as Cell["state"] })}>
                        {CELL_STATES.map(([v, t]) => (
                          <option key={v} value={v}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        );
      case "choice":
        return (
          <div role="group" aria-label={`${label} choices`}>
            {item.options.map((o, i) => (
              <Field key={i} label={`Option ${i + 1}`} value={o} max={120} disabled={blocked} onCommit={(v) => set({ ...item, options: item.options.map((x, j) => (j === i ? v : x)) })} />
            ))}
            <label className="ws-field">
              <span>Saved answer</span>
              <select value={item.answer ?? ""} disabled={blocked} onChange={(e) => set({ ...item, answer: e.target.value === "" ? null : Number(e.target.value) })}>
                <option value="">None saved</option>
                {item.options.map((o, i) => (
                  <option key={i} value={i}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          </div>
        );
      case "answerLine": {
        const blanks = item.blanks;
        const coordinates = blanks?.length === 2 && item.prefix === "(" && item.suffix === ")" && blanks[1].before === ",";
        const shape = !blanks ? "line" : coordinates ? "coordinates" : String(blanks.length);
        return (
          <div className="ws-line-edit" role="group" aria-label={`${label} answer line`}>
            <Field label={blanks ? "Before the first blank" : "Before the line"} value={item.prefix} max={40} disabled={blocked} onCommit={(prefix) => set({ ...item, prefix })} />
            {blanks ? (
              blanks.map((b, i) => (
                <div key={i} className="ws-line-edit" role="group" aria-label={`${label} blank ${i + 1}`}>
                  {(i > 0 || b.before) && <Field label={`Before blank ${i + 1}`} value={b.before} max={20} disabled={blocked} onCommit={(before) => set({ ...item, blanks: blanks.map((x, j) => (j === i ? { ...x, before } : x)) })} />}
                  <Field label={`Blank ${i + 1} saved answer (answers PDF only)`} value={b.answer} max={40} disabled={blocked} onCommit={(answer) => set({ ...item, blanks: blanks.map((x, j) => (j === i ? { ...x, answer } : x)) })} />
                </div>
              ))
            ) : (
              <Field label="Saved answer (answers PDF only)" value={item.answer} max={ANSWER_MAX} disabled={blocked} onCommit={(answer) => set({ ...item, answer })} />
            )}
            <Field label={blanks ? "After the last blank" : "After the line"} value={item.suffix} max={20} disabled={blocked} onCommit={(suffix) => set({ ...item, suffix })} />
            <label className="ws-field">
              <span>Answer shape</span>
              <select
                value={shape}
                disabled={blocked}
                onChange={(e) => {
                  // An explicit, undoable change of shape. Nothing is calculated: blanks that stay keep their saved answers.
                  const { type, beside, prefix, suffix, inline } = item;
                  const base = { type, prefix, suffix, inline, answer: "", ...(beside ? { beside } : {}) };
                  const v = e.target.value;
                  // A line's saved answer moves into the first blank, and back again.
                  const carried = blanks?.[0]?.answer ?? item.answer;
                  const first = carried.length <= 40 ? carried : "";
                  if (v === "line") return set(coordinates ? { ...base, prefix: "", suffix: "", answer: first } : { ...base, answer: first });
                  if (v === "coordinates") return set({ ...base, prefix: "(", suffix: ")", blanks: [{ before: "", answer: first }, { before: ",", answer: blanks?.[1]?.answer ?? "" }] });
                  const count = Number(v);
                  set({ ...base, blanks: Array.from({ length: count }, (_, i) => blanks?.[i] ?? { before: "", answer: i === 0 ? first : "" }) });
                }}
              >
                <option value="line">One answer line</option>
                <option value="coordinates">Coordinates ( __ , __ )</option>
                <option value="2">Two short blanks</option>
                <option value="3">Three short blanks</option>
                <option value="4">Four short blanks</option>
              </select>
            </label>
          </div>
        );
      }
      case "space":
        return <NumberField label={`${label} ${item.kind === "drawing" ? "drawing" : "working"} space (mm)`} value={item.heightMm} min={8} max={200} disabled={blocked} onCommit={(heightMm) => set({ ...item, heightMm })} />;
      case "diagram":
        return <p className="ws-note">{familyLabel(item.diagram.tool)}: ask the AI to change it, or change it in its own tool.</p>;
      case "paper":
        return <PaperEditor item={item} set={set} label={label} disabled={blocked} />;
    case "steps":
      return item.steps.map((st, i) => (
        <div className="ws-line-edit" role="group" aria-label={`${label} step ${i + 1}`} key={i}>
          <Field label={`Step ${i + 1} label`} value={st.label} max={24} disabled={blocked} onCommit={(v) => set({ ...item, steps: item.steps.map((x, j) => (j === i ? { ...x, label: v } : x)) })} />
          <Field label={`Step ${i + 1}`} value={st.text} max={300} multiline disabled={blocked} onCommit={(v) => set({ ...item, steps: item.steps.map((x, j) => (j === i ? { ...x, text: v } : x)) })} />
        </div>
      ));
    case "checklist":
      return item.items.map((c, i) => <Field key={i} label={`${label} tick box ${i + 1}`} value={c} max={120} disabled={blocked} onCommit={(v) => set({ ...item, items: item.items.map((x, j) => (j === i ? v : x)) })} />);
    }
  }

type Paper = Extract<Leaf, { type: "paper" }>;
const PAPER_STYLES: [Paper["style"], string][] = [
  ["squared", "Squared (5 mm)"],
  ["dotted", "Dotted (5 mm)"],
  ["graph", "Graph paper (2 mm, bold every 10 mm)"],
];

/** Grid paper: style, printed size and optional blank axes. Grids are never shrunk; a grid wider than its card is reported. */
function PaperEditor({ item, set, label, disabled }: { item: Paper; set: (next: Leaf) => boolean | void; label: string; disabled: boolean }) {
  const axes = item.axes;
  const name = (t: string) => (label ? `${label} ${t}` : t[0].toUpperCase() + t.slice(1));
  return (
    <div className="ws-paper-edit" role="group" aria-label={name("grid paper")}>
      <label className="ws-field">
        <span>Grid paper</span>
        <select value={item.style} disabled={disabled} onChange={(e) => set({ ...item, style: e.target.value as Paper["style"] })}>
          {PAPER_STYLES.map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <div className="ws-line-edit">
        <NumberField label={name("paper width (mm)")} value={item.widthMm} min={20} max={400} disabled={disabled} onCommit={(widthMm) => set({ ...item, widthMm })} />
        <NumberField label={name("paper height (mm)")} value={item.heightMm} min={10} max={250} disabled={disabled} onCommit={(heightMm) => set({ ...item, heightMm })} />
      </div>
      <label className="ws-check">
        <input
          type="checkbox"
          checked={!!axes}
          disabled={disabled}
          onChange={(e) => {
            const next = { ...item };
            if (e.target.checked) next.axes = { originMm: { x: Math.min(10, item.widthMm), y: Math.min(10, item.heightMm) }, xLabel: "x", yLabel: "y" };
            else delete next.axes;
            set(next);
          }}
        />
        Blank axes (no numbers, pupils choose the scale)
      </label>
      {axes && (
        <div className="ws-line-edit">
          <NumberField label="Origin from left (mm)" value={axes.originMm.x} min={0} max={Math.min(400, item.widthMm)} disabled={disabled} onCommit={(x) => set({ ...item, axes: { ...axes, originMm: { ...axes.originMm, x } } })} />
          <NumberField label="Origin from bottom (mm)" value={axes.originMm.y} min={0} max={Math.min(250, item.heightMm)} disabled={disabled} onCommit={(y) => set({ ...item, axes: { ...axes, originMm: { ...axes.originMm, y } } })} />
          <Field label="Across axis label" value={axes.xLabel} max={8} disabled={disabled} onCommit={(xLabel) => set({ ...item, axes: { ...axes, xLabel } })} />
          <Field label="Up axis label" value={axes.yLabel} max={8} disabled={disabled} onCommit={(yLabel) => set({ ...item, axes: { ...axes, yLabel } })} />
        </div>
      )}
    </div>
  );
}

/** A hidden worked solution: stored with the question, never printed. Empty removes it. */
export function WorkingField({ label, value, onCommit, disabled }: { label: string; value: string | undefined; onCommit: (v: string | undefined) => void; disabled?: boolean }) {
  return (
    // Closed until used, so the outline stays short; a saved solution opens it.
    <details className="ws-working" open={!!value}>
      <summary>
        {label}
        {value ? "" : " (none)"}
      </summary>
      <Field label={label} value={value ?? ""} max={3000} lines disabled={disabled} onCommit={(v) => onCommit(v.trim() ? v : undefined)} />
      <p className="ws-hint">Never printed, in the pupil or the answers copy.</p>
    </details>
  );
}

/**
 * "Beside the item before": prints an item to the right of the one before it, in one row of the
 * card. Shown only where the item can take it (not the first item, not after a lettered part,
 * not a third item in a row, not with inline answer lines).
 */
export function BesideToggle({ list, index, set, disabled }: { list: readonly Item[]; index: number; set: (on: boolean) => void; disabled: boolean }): ReactNode {
  const item = list[index];
  if (item.type === "part") return null;
  const on = !!item.beside;
  if (!on) {
    // Offered only where turning it on is allowed, and never makes the next item a third in its row.
    const next = list.map((x, i) => (i === index ? { ...x, beside: true as const } : x));
    if (besideIssueAt(next, index) || besideIssueAt(next, index + 1)) return null;
  }
  return (
    <label className="ws-check">
      <input type="checkbox" checked={on} disabled={disabled} onChange={(e) => set(e.target.checked)} />
      Beside the item before
    </label>
  );
}
