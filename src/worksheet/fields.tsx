import { useEffect, useState, type ReactNode } from "react";
import type { Item } from "../../packages/resource-core/src/index";
import { FAMILIES } from "../../packages/diagram-core/src/registry";

/** Editing controls shared by the worksheet and booklet editors. */
export type Leaf = Exclude<Item, { type: "part" }>;
type Cell = Extract<Leaf, { type: "table" }>["rows"][number][number];
const familyLabel = (kind: keyof typeof FAMILIES) => {
  const l = FAMILIES[kind].label;
  return l[0].toUpperCase() + l.slice(1);
};

export /** Typing stays local; leaving the field or Enter applies one undoable change, Escape restores. */
function Field({ label, value, onCommit, max, multiline, disabled }: { label: string; value: string; onCommit: (v: string) => void; max: number; multiline?: boolean; disabled?: boolean }) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);
  const commit = () => {
    setEditing(false);
    // Saved text is one line: line breaks become spaces.
    const clean = draft.replace(/[\r\n\t]+/g, " ");
    if (clean !== value) onCommit(clean);
  };
  const common = {
    "aria-label": label,
    value: draft,
    maxLength: max,
    disabled,
    onChange: (e: { target: { value: string } }) => {
      setEditing(true);
      setDraft(e.target.value);
    },
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !(multiline && e.shiftKey)) {
        e.preventDefault();
        commit();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setDraft(value);
        setEditing(false);
      }
    },
  };
  return (
    <label className="ws-field">
      <span>{label}</span>
      {multiline ? <textarea rows={Math.min(5, Math.max(2, Math.ceil(value.length / 48)))} {...common} /> : <input {...common} />}
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

export function LeafEditor({ item, set, label, disabled: blocked }: { item: Leaf; set: (next: Leaf) => void; label: string; disabled: boolean }): ReactNode {
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
            <div className="ws-table-row">
              {item.columns.map((c, i) => (
                <Field key={i} label={`Heading ${i + 1}`} value={c} max={40} disabled={blocked} onCommit={(v) => set({ ...item, columns: item.columns.map((x, j) => (j === i ? v : x)) })} />
              ))}
            </div>
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
      case "answerLine":
        return (
          <div className="ws-line-edit" role="group" aria-label={`${label} answer line`}>
            <Field label="Before the line" value={item.prefix} max={40} disabled={blocked} onCommit={(prefix) => set({ ...item, prefix })} />
            <Field label="After the line" value={item.suffix} max={20} disabled={blocked} onCommit={(suffix) => set({ ...item, suffix })} />
            <Field label="Saved answer (answers PDF only)" value={item.answer} max={60} disabled={blocked} onCommit={(answer) => set({ ...item, answer })} />
          </div>
        );
      case "space":
        return <NumberField label={`${label} ${item.kind === "drawing" ? "drawing" : "working"} space (mm)`} value={item.heightMm} min={8} max={200} disabled={blocked} onCommit={(heightMm) => set({ ...item, heightMm })} />;
      case "diagram":
        return <p className="ws-note">{familyLabel(item.diagram.tool)}: ask the AI to change it, or change it in its own tool.</p>;
      case "paper":
        return <NumberField label={`${label} ${item.style} paper height (mm)`} value={item.heightMm} min={10} max={250} disabled={blocked} onCommit={(heightMm) => set({ ...item, heightMm })} />;
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
