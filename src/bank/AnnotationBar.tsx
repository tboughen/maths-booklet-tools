import type { KeyboardEvent, MouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { Eraser, GripHorizontal, Hand, Highlighter, Pencil, Redo2, Slash, Trash2, Undo2, X, Zap } from "lucide-react";
import { HIGHLIGHTER_COLOURS, PEN_COLOURS, SIZES, withTool, type AnnotationPreferences, type AnnotationTool } from "./annotations";

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
  /** Present lets the rail be dragged by a grip (Tim, 28 Nov 2026); the Question Bank keeps it fixed. */
  movable?: { place: RailPlace; onPlace: (place: RailPlace) => void };
}

/** Where a movable rail sits: docked at the right (the default) or left edge, or floating at a spot in its frame. */
export type RailPlace = "right" | "left" | { x: number; y: number };
/** Dropped this close to a side of the frame, the rail docks there. */
const SNAP = 48;

/** Drag the rail by its grip; let go near an edge to dock it there; double-click puts it back on the right. */
function startDrag(event: ReactPointerEvent<HTMLButtonElement>, onPlace: (place: RailPlace) => void) {
  const rail = event.currentTarget.closest<HTMLElement>(".qb-annotate-bar"), frame = rail?.parentElement;
  if (!rail || !frame) return;
  event.preventDefault();
  const grip = event.currentTarget;
  grip.setPointerCapture(event.pointerId);
  const r = rail.getBoundingClientRect(), f = frame.getBoundingClientRect();
  const dx = event.clientX - r.left, dy = event.clientY - r.top;
  const at = (e: PointerEvent) => ({ x: Math.max(0, Math.min(f.width - r.width, e.clientX - f.left - dx)), y: Math.max(0, Math.min(f.height - r.height, e.clientY - f.top - dy)) });
  const move = (e: PointerEvent) => onPlace(at(e));
  const up = (e: PointerEvent) => {
    grip.removeEventListener("pointermove", move); grip.removeEventListener("pointerup", up); grip.removeEventListener("pointercancel", up);
    const p = at(e);
    onPlace(p.x < SNAP ? "left" : p.x > f.width - r.width - SNAP ? "right" : p);
  };
  grip.addEventListener("pointermove", move); grip.addEventListener("pointerup", up); grip.addEventListener("pointercancel", up);
}

/** Arrow keys, Home and End move along the rail; they don't step questions while focus is on it. */
function moveAlongRail(event: KeyboardEvent<HTMLDivElement>) {
  const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1, Home: -Infinity, End: Infinity }[event.key];
  if (step === undefined || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
  const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
  if (!buttons.length) return;
  event.preventDefault();
  event.stopPropagation();
  const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const next = step === -Infinity ? 0 : step === Infinity ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, (at < 0 ? 0 : at) + step));
  buttons[next].focus();
}

/** A button pressed with a pen, finger or mouse doesn't keep focus, so arrow keys and a clicker still step questions. */
const press = (action: () => void) => (event: MouseEvent<HTMLButtonElement>) => { action(); if (event.detail > 0) event.currentTarget.blur(); };

/**
 * The screen-only annotation tools, on a rail down the right edge of the viewer, above the Annotate button and under
 * Display: the top of a whiteboard is often out of reach, portrait question pages leave room at the side, and a teacher
 * at the board finds everything on one side. The tools are toggle buttons with one pressed at a time.
 * Nothing here reaches exports, links or saved files.
 */
export function AnnotationBar({ preferences: p, onChange, canUndo, canRedo, hasInk, anyInk, onUndo, onRedo, onClear, onClearAll, onClose, movable }: Props) {
  const set = (patch: Partial<AnnotationPreferences>) => onChange({ ...(patch.tool ? withTool(p, patch.tool) : p), ...patch });
  const highlighter = p.tool === "highlighter";
  const colours = highlighter ? HIGHLIGHTER_COLOURS : PEN_COLOURS;
  const colour = highlighter ? p.highlighterColour : p.penColour;
  const drawing = p.tool === "pen" || p.tool === "highlighter";
  const current = highlighter ? p.highlighterSize : p.penSize;
  const COLOUR_SLOTS = Math.max(PEN_COLOURS.length, HIGHLIGHTER_COLOURS.length);
  const place = movable?.place;
  const floating = typeof place === "object" ? place : undefined;
  return <div className={`qb-annotate-bar${place === "left" ? " is-left" : ""}${floating ? " is-floating" : ""}`} role="toolbar" aria-orientation="vertical" aria-label="Annotation tools (screen only)" data-drawing={drawing} onKeyDown={moveAlongRail} style={floating ? { left: floating.x, top: floating.y } : undefined}>
    {movable && <button type="button" className="qb-annotate-grip" title="Drag to move the pen tools · double-click to put them back" aria-label="Move the pen tools" onPointerDown={(e) => startDrag(e, movable.onPlace)} onDoubleClick={() => movable.onPlace("right")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); movable.onPlace(place === "left" ? "right" : "left"); } }}><GripHorizontal size={18}/></button>}
    <div className="qb-annotate-group" role="group" aria-label="Tool">
      {tools.map(tool => <button key={tool.value} aria-pressed={p.tool === tool.value} className="qb-annotate-tool" title={`${tool.label} · ${tool.key}`} aria-label={tool.label} onClick={press(() => set({ tool: tool.value }))}><tool.icon size={18}/></button>)}
      <button className="qb-annotate-tool" aria-pressed={p.straight} title="Straight lines (or hold Shift, or draw and hold still)" aria-label="Straight lines" onClick={press(() => set({ straight: !p.straight }))}><Slash size={18}/></button>
    </div>
    {/* Every group is always present with the same number of slots, so no button ever moves: switching tool only
        swaps the colours. Choosing a pen colour or size while on the eraser, laser or move tool picks up the pen. */}
    <div className="qb-annotate-group" role="group" aria-label={highlighter ? "Highlighter colour" : "Pen colour"}>
      {colours.map((option, i) => <button key={`${highlighter}-${option.value}`} aria-pressed={drawing && colour === option.value} className="qb-annotate-colour" title={`${option.label} · ${i + 1}`} aria-label={option.label} onClick={press(() => set(highlighter ? { highlighterColour: option.value } : { penColour: option.value, tool: "pen" }))}><span style={{ backgroundColor: option.value }}/></button>)}
      {Array.from({ length: COLOUR_SLOTS - colours.length }, (_, i) => <span key={`spare-${i}`} className="qb-annotate-colour qb-annotate-spare" aria-hidden="true"/>)}
    </div>
    <div className="qb-annotate-group qb-annotate-sizes" role="group" aria-label="Size">
      {SIZES.map(option => <button key={option.value} aria-pressed={drawing && current === option.value} className="qb-annotate-size" title={option.label} aria-label={option.label} onClick={press(() => set(highlighter ? { highlighterSize: option.value } : { penSize: option.value, tool: "pen" }))}><span style={{ width: 4 + SIZES.indexOf(option) * 4, height: 4 + SIZES.indexOf(option) * 4 }}/></button>)}
    </div>
    <div className="qb-annotate-group" role="group" aria-label="Undo and clear">
      <button className="qb-annotate-tool" disabled={!canUndo} title="Undo · Ctrl+Z" aria-label="Undo annotation" onClick={press(onUndo)}><Undo2 size={18}/></button>
      <button className="qb-annotate-tool" disabled={!canRedo} title="Redo · Ctrl+Shift+Z" aria-label="Redo annotation" onClick={press(onRedo)}><Redo2 size={18}/></button>
      <button className="qb-annotate-tool" disabled={!hasInk} title="Clear this view" aria-label="Clear this view" onClick={press(onClear)}><Trash2 size={18}/></button>
      <button className="qb-annotate-tool" title="Close annotation tools · Esc" aria-label="Close annotation tools" onClick={onClose}><X size={18}/></button>
      <button className="qb-annotate-text" disabled={!anyInk} title="Clear annotations on every question" onClick={press(onClearAll)}>Clear all</button>
    </div>
  </div>;
}
