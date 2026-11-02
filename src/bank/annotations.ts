/**
 * Screen-only teacher annotations for the question viewer. Ink lives in memory for the session, one layer per
 * view (question, mark scheme and worked solution never share a layer). It is never saved, linked or exported.
 * Points are in view units (the view's size at scale 1), so ink stays on the page through zoom, pan and resize.
 */
export type AnnotationTool = "hand" | "pen" | "highlighter" | "eraser" | "laser";
export type StrokeKind = "pen" | "highlighter";
export interface Stroke { id: string; kind: StrokeKind; colour: string; size: number; points: [number, number][] }

export const PEN_COLOURS = [
  // Cheerful but still at least 3:1 against white, so they read on a projector.
  { value: "#1b1b1b", label: "Black" },
  { value: "#1e6fe8", label: "Blue" },
  { value: "#e8343a", label: "Red" },
  { value: "#17a34a", label: "Green" },
  { value: "#d9339c", label: "Pink" },
] as const;
export const HIGHLIGHTER_COLOURS = [
  // Standard bright highlighter colours, as Tim chose; they sit under the ink in multiply mode.
  { value: "#fffc00", label: "Yellow" },
  { value: "#00f900", label: "Green" },
  { value: "#00fdff", label: "Blue" },
  { value: "#ff40ff", label: "Pink" },
] as const;
export const SIZES = [
  { value: "thin", label: "Thin", pen: 2, highlighter: 12 },
  { value: "medium", label: "Medium", pen: 3.5, highlighter: 18 },
  { value: "thick", label: "Thick", pen: 6, highlighter: 28 },
] as const;
export type SizeName = typeof SIZES[number]["value"];

export interface Layer { strokes: Stroke[]; past: Stroke[][]; future: Stroke[][] }
export type AnnotationState = Record<string, Layer>;
export type AnnotationAction =
  | { type: "set"; key: string; strokes: Stroke[] }
  | { type: "undo"; key: string }
  | { type: "redo"; key: string }
  | { type: "clearAll" };

const empty: Layer = { strokes: [], past: [], future: [] };
export const layerOf = (state: AnnotationState, key: string): Layer => state[key] ?? empty;
const HISTORY = 200;

/** Every change is one undoable step for its view; Clear all is one undoable step in each view it cleared. */
export function annotationReducer(state: AnnotationState, action: AnnotationAction): AnnotationState {
  if (action.type === "clearAll") {
    const next: AnnotationState = {};
    for (const [key, layer] of Object.entries(state)) next[key] = layer.strokes.length ? { strokes: [], past: [...layer.past, layer.strokes].slice(-HISTORY), future: [] } : layer;
    return next;
  }
  const layer = layerOf(state, action.key);
  if (action.type === "set") {
    if (action.strokes === layer.strokes) return state;
    return { ...state, [action.key]: { strokes: action.strokes, past: [...layer.past, layer.strokes].slice(-HISTORY), future: [] } };
  }
  if (action.type === "undo") {
    if (!layer.past.length) return state;
    return { ...state, [action.key]: { strokes: layer.past[layer.past.length - 1], past: layer.past.slice(0, -1), future: [layer.strokes, ...layer.future] } };
  }
  if (!layer.future.length) return state;
  return { ...state, [action.key]: { strokes: layer.future[0], past: [...layer.past, layer.strokes], future: layer.future.slice(1) } };
}

export const hasInk = (state: AnnotationState) => Object.values(state).some(layer => layer.strokes.length > 0);

function segmentDistance(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** Whether an eraser circle at `point` with `radius` (view units) touches the stroke. */
export function touchesStroke(stroke: Stroke, point: [number, number], radius: number): boolean {
  const reach = radius + stroke.size / 2;
  const pts = stroke.points;
  if (pts.length === 1) return Math.hypot(point[0] - pts[0][0], point[1] - pts[0][1]) <= reach;
  for (let i = 1; i < pts.length; i++) if (segmentDistance(point, pts[i - 1], pts[i]) <= reach) return true;
  return false;
}

/** A smooth SVG path through the points (quadratic curves through the midpoints). */
export function strokePath(points: [number, number][]): string {
  if (!points.length) return "";
  const f = (n: number) => Math.round(n * 100) / 100;
  if (points.length === 1) { const [x, y] = points[0]; return `M${f(x)} ${f(y)}L${f(x + 0.01)} ${f(y)}`; }
  if (points.length === 2) return `M${f(points[0][0])} ${f(points[0][1])}L${f(points[1][0])} ${f(points[1][1])}`;
  let d = `M${f(points[0][0])} ${f(points[0][1])}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i], [nx, ny] = points[i + 1];
    d += `Q${f(x)} ${f(y)} ${f((x + nx) / 2)} ${f((y + ny) / 2)}`;
  }
  const last = points[points.length - 1];
  return d + `L${f(last[0])} ${f(last[1])}`;
}

/** Drops points closer than `minimum` to the previous kept point, so long strokes stay light. */
export function addPoint(points: [number, number][], point: [number, number], minimum: number): [number, number][] {
  const last = points[points.length - 1];
  if (last && Math.hypot(point[0] - last[0], point[1] - last[1]) < minimum) return points;
  return [...points, point];
}

/**
 * A touch much bigger than a fingertip (the side of a fist or a palm) erases. Boards that do not report touch
 * size send 0 or 1, so this never triggers there and the Eraser button remains the way to rub out.
 */
export const FIST_SIZE = 44;
export const isFistTouch = (event: { pointerType: string; width: number; height: number }) => event.pointerType === "touch" && Math.max(event.width, event.height) >= FIST_SIZE;
/** A stylus eraser end, or a board that reports its own eraser. */
export const isStylusEraser = (event: { pointerType: string; buttons: number; button: number }) => event.pointerType === "pen" && ((event.buttons & 32) !== 0 || event.button === 5);

export interface AnnotationPreferences {
  tool: AnnotationTool;
  penColour: string;
  highlighterColour: string;
  size: SizeName;
  straight: boolean;
  fistEraser: boolean;
}

/** Tool choices are remembered on this device; the ink itself never is. */
export const defaultAnnotationPreferences: AnnotationPreferences = { tool: "pen", penColour: PEN_COLOURS[0].value, highlighterColour: HIGHLIGHTER_COLOURS[0].value, size: "medium", straight: false, fistEraser: true };

export function readAnnotationPreferences(): AnnotationPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem("qb-annotate") || "{}") as Partial<AnnotationPreferences>;
    const p = { ...defaultAnnotationPreferences };
    if (["hand", "pen", "highlighter", "eraser", "laser"].includes(saved.tool as string)) p.tool = saved.tool!;
    if (PEN_COLOURS.some(c => c.value === saved.penColour)) p.penColour = saved.penColour!;
    if (HIGHLIGHTER_COLOURS.some(c => c.value === saved.highlighterColour)) p.highlighterColour = saved.highlighterColour!;
    if (SIZES.some(size => size.value === saved.size)) p.size = saved.size!;
    if (typeof saved.fistEraser === "boolean") p.fistEraser = saved.fistEraser;
    return p;
  } catch { return { ...defaultAnnotationPreferences }; }
}

