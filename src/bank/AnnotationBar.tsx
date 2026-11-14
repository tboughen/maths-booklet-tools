import { Eraser, Hand, Highlighter, Pencil, Redo2, Slash, Trash2, Undo2, X, Zap } from "lucide-react";
import { HIGHLIGHTER_COLOURS, PEN_COLOURS, SIZES, type AnnotationPreferences, type AnnotationTool } from "./annotations";

const tools: { value: AnnotationTool; label: string; key: string; icon: typeof Pencil }[] = [
  { value: "pen", label: "Pen", key: "P", icon: Pencil },
  { value: "highlighter", label: "Highlighter", key: "H", icon: Highlighter },
  { value: "eraser", label: "Eraser", key: "E", icon: Eraser },
  { value: "laser", label: "Laser pointer", key: "L", icon: Zap },
  { value: "hand", label: "Move", key: "V", icon: Hand },
];

interface Props {
  preferences: AnnotationPreferences;
  onChange: (next: AnnotationPreferences) => void;
  canUndo: boolean;
  canRedo: boolean;
  hasInk: boolean;
  anyInk: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onClearAll: () => void;
  onClose: () => void;
}

/** The screen-only annotation tools. Nothing here reaches exports, links or saved files. */
export function AnnotationBar({ preferences: p, onChange, canUndo, canRedo, hasInk, anyInk, onUndo, onRedo, onClear, onClearAll, onClose }: Props) {
  const set = (patch: Partial<AnnotationPreferences>) => onChange({ ...p, ...patch });
  const highlighter = p.tool === "highlighter";
  const colours = highlighter ? HIGHLIGHTER_COLOURS : PEN_COLOURS;
  const colour = highlighter ? p.highlighterColour : p.penColour;
  const drawing = p.tool === "pen" || p.tool === "highlighter";
  const COLOUR_SLOTS = Math.max(PEN_COLOURS.length, HIGHLIGHTER_COLOURS.length);
  return <div className="qb-annotate-bar" role="toolbar" aria-label="Annotation tools (screen only)" data-drawing={drawing}>
    <div className="qb-annotate-group" role="radiogroup" aria-label="Tool">
      {tools.map(tool => <button key={tool.value} role="radio" aria-checked={p.tool === tool.value} className="qb-annotate-tool" title={`${tool.label} · ${tool.key}`} aria-label={tool.label} onClick={() => set({ tool: tool.value })}><tool.icon size={18}/></button>)}
    </div>
    {/* Every group is always present with the same number of slots, so no button ever moves: switching tool only
        swaps the colours. Choosing a pen colour or size while on the eraser, laser or move tool picks up the pen. */}
    <div className="qb-annotate-group" role="radiogroup" aria-label={highlighter ? "Highlighter colour" : "Pen colour"}>
      {colours.map((option, i) => <button key={`${highlighter}-${option.value}`} role="radio" aria-checked={drawing && colour === option.value} className="qb-annotate-colour" title={`${option.label} · ${i + 1}`} aria-label={option.label} onClick={() => set(highlighter ? { highlighterColour: option.value } : { penColour: option.value, tool: "pen" })}><span style={{ backgroundColor: option.value }}/></button>)}
      {Array.from({ length: COLOUR_SLOTS - colours.length }, (_, i) => <span key={`spare-${i}`} className="qb-annotate-colour qb-annotate-spare" aria-hidden="true"/>)}
    </div>
    <div className="qb-annotate-group" role="radiogroup" aria-label="Size">
      {SIZES.map(size => <button key={size.value} role="radio" aria-checked={drawing && p.size === size.value} className="qb-annotate-size" title={size.label} aria-label={size.label} onClick={() => set(drawing ? { size: size.value } : { size: size.value, tool: "pen" })}><span style={{ width: 4 + SIZES.indexOf(size) * 4, height: 4 + SIZES.indexOf(size) * 4 }}/></button>)}
    </div>
    <button className="qb-annotate-tool" aria-pressed={p.straight} title="Straight lines (or hold Shift)" aria-label="Straight lines" onClick={() => set({ straight: !p.straight })}><Slash size={18}/></button>
    <div className="qb-annotate-group">
      <button className="qb-annotate-tool" disabled={!canUndo} title="Undo · Ctrl+Z" aria-label="Undo annotation" onClick={onUndo}><Undo2 size={18}/></button>
      <button className="qb-annotate-tool" disabled={!canRedo} title="Redo · Ctrl+Shift+Z" aria-label="Redo annotation" onClick={onRedo}><Redo2 size={18}/></button>
      <button className="qb-annotate-tool" disabled={!hasInk} title="Clear this view" aria-label="Clear this view" onClick={onClear}><Trash2 size={18}/></button>
      <button className="qb-annotate-text" disabled={!anyInk} title="Clear annotations on every question" onClick={onClearAll}>Clear all</button>
    </div>
    <button className="qb-annotate-tool" title="Close annotation tools · Esc" aria-label="Close annotation tools" onClick={onClose}><X size={18}/></button>
  </div>;
}
