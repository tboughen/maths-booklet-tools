/**
 * Function machines (number machines): input → [× 3] → [− 8] → output, as Edexcel prints them,
 * with up to three machines stacked ("Here is a different number machine") and machines that run
 * backwards (arrows right to left) for working out an input from an output.
 *
 * Every printed item is {text, show}. Empty text is a pupil blank: a dotted line, or a dotted line
 * inside an empty box for a missing operation. A hidden item keeps its saved answer: the pupil copy
 * shows the blank and the answers copy prints it in the answer colour. A value on an arrow between
 * two boxes is optional (null: nothing printed there). Nothing is worked out unless the teacher asks
 * (complete, inverse); values that do not follow from the machine raise a teacher note, never a
 * correction, so error-spotting works.
 */
import { z } from "zod";
import { sha256Hex, toBase64Url } from "../../envelope-core/src/index";
import { aboutShape } from "../../envelope-core/src/about";
import { boldLines, LINE_WEIGHTS } from "../../envelope-core/src/house-style";
import { FONT, esc, mathsHeight, mathsMarkup, mathsWidth, typeset } from "./maths-text";
import * as Q from "./rational";

export { FONT, typeset } from "./maths-text";

/** The renderer version every new function-machine envelope carries. */
export const RENDERER_VERSION = "function-machine-1" as const;

export const MAX_MACHINES = 3;
export const MAX_STEPS = 5;
export const MAX_TEXT = 16;
export const ANSWER_COLOUR = "#b0125b";

const show = z.enum(["show", "hidden"]);
export const valueSchema = z.object({ text: z.string().max(MAX_TEXT), show }).strict();
const id = z.string().regex(/^[a-z][a-z0-9-]{0,23}$/);
export const stepSchema = z
  .object({
    /** The operation in the box, such as "× 3" or "− 8"; empty is a box for pupils to fill. */
    op: valueSchema,
    /** The value on the arrow after this box, or null for nothing there. Always null on the last box. */
    out: valueSchema.nullable(),
  })
  .strict();
export const machineSchema = z
  .object({
    id,
    /** "right": input on the left, as printed. "left": arrows right to left, for working backwards. */
    direction: z.enum(["right", "left"]),
    /** The word or number before the first box ("input", "6", "n"). */
    start: valueSchema,
    steps: z.array(stepSchema).min(1).max(MAX_STEPS),
    /** The word or number after the last box ("output", "10"). */
    end: valueSchema,
  })
  .strict();
export const documentSchema = z
  .object({
    machines: z.array(machineSchema).min(1).max(MAX_MACHINES),
    /** Arrow-shaped boxes (recent papers) or plain rectangles (older papers). */
    boxShape: z.enum(["pentagon", "rectangle"]),
    /** An error-spotting task: values that do not follow raise no teacher note. */
    intentionalError: z.boolean(),
    /** Bold lines (U111). Normal lines are the default and are never saved. */
    lines: z
      .enum(LINE_WEIGHTS)
      .transform((v) => (v === "bold" ? v : undefined))
      .optional(),
  })
  .strict();
export const envelopeSchema = z
  .object({
    kind: z.literal("function-machine"),
    schemaVersion: z.literal(1),
    rendererVersion: z.literal(RENDERER_VERSION),
    document: documentSchema,
    ...aboutShape,
  })
  .strict();
export type Envelope = z.infer<typeof envelopeSchema>;
export type MachineDocument = Envelope["document"];
export type Machine = MachineDocument["machines"][number];
export type Step = Machine["steps"][number];
export type Value = Step["op"];
/** A printed item on a machine: the start, the end, a box (op:0) or the value after a box (out:0). */
export type Slot = "start" | "end" | `op:${number}` | `out:${number}`;

export const value = (text = "", visibility: Value["show"] = "show"): Value => ({ text, show: visibility });

/* ---------- Validation ---------- */

export function validate(input: unknown): Envelope {
  const parsed = envelopeSchema.safeParse(input);
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path ?? [];
    if (path.includes("text")) throw Error(`Use at most ${MAX_TEXT} characters in each box and label.`);
    if (path.includes("steps")) throw Error(`Use 1 to ${MAX_STEPS} boxes in each machine.`);
    if (path.includes("machines") && path.length <= 3) throw Error(`Use 1 to ${MAX_MACHINES} machines.`);
    throw Error("This is not a supported function machine file (version 1 is supported).");
  }
  const e = parsed.data;
  const ids = new Set<string>();
  for (const m of e.document.machines) {
    if (ids.has(m.id)) throw Error(`The machine ID ${m.id} appears twice.`);
    ids.add(m.id);
    if (m.steps.at(-1)!.out !== null) throw Error("The last box is followed by the end of the machine, not a value on its own.");
    for (const v of values(m)) {
      v.text = v.text.trim().replace(/\s+/g, " ");
      if (!v.text && v.show === "hidden") throw Error("A blank cannot hold a hidden answer. Enter the answer, then hide it.");
    }
  }
  return e;
}
/** Every printed item of a machine, in order. */
export function values(m: Machine): Value[] {
  return [m.start, ...m.steps.flatMap((s) => (s.out ? [s.op, s.out] : [s.op])), m.end];
}
export const canonical = (e: Envelope) => JSON.stringify(validate(e));
export function parseFile(text: string) {
  if (text.length > 40000) throw Error("This editable file is too large.");
  return validate(JSON.parse(text));
}
export async function hash(e: Envelope) {
  return sha256Hex(canonical(e));
}
export const hasHidden = (e: Envelope) => e.document.machines.some((m) => values(m).some((v) => v.show === "hidden" && !!v.text));

/* ---------- Building ---------- */

export function newMachine(machineId: string, ops: string[] = ["", ""], start = "input", end = "output"): Machine {
  return { id: machineId, direction: "right", start: value(start), steps: ops.map((op) => ({ op: value(op), out: null })), end: value(end) };
}
/** One machine with two boxes, input and output; the default has empty boxes. */
export function create(ops: string[] = ["", ""]): Envelope {
  return validate({
    kind: "function-machine",
    schemaVersion: 1,
    rendererVersion: RENDERER_VERSION,
    document: { machines: [newMachine("m1", ops)], boxShape: "pentagon", intentionalError: false },
  });
}
const clone = (e: Envelope) => structuredClone(e);
export function machineOf(d: MachineDocument, machineId: string): Machine {
  const m = d.machines.find((x) => x.id === machineId);
  if (!m) throw Error(`There is no machine ${machineId}.`);
  return m;
}
export function slotValue(m: Machine, slot: Slot): Value | null {
  if (slot === "start") return m.start;
  if (slot === "end") return m.end;
  const [kind, at] = slot.split(":"),
    step = m.steps[Number(at)];
  if (!step) throw Error(`There is no box ${Number(at) + 1} in this machine.`);
  return kind === "op" ? step.op : step.out;
}
/**
 * Sets an item's text and visibility. For a value after a box, null removes it and {} adds a blank.
 * Hiding an empty item is refused: a blank has no answer to keep.
 */
export function setSlot(e: Envelope, machineId: string, slot: Slot, change: { text?: string; show?: Value["show"] } | null): Envelope {
  const n = clone(e),
    m = machineOf(n.document, machineId);
  if (slot.startsWith("out:")) {
    const at = Number(slot.slice(4)),
      step = m.steps[at];
    if (!step || at >= m.steps.length - 1) throw Error("Values go on the arrows between two boxes.");
    if (change === null) {
      step.out = null;
      return validate(n);
    }
    step.out ??= value();
  } else if (change === null) throw Error("Only a value between two boxes can be removed.");
  const v = slotValue(m, slot)!;
  if (change.text !== undefined) v.text = change.text.trim();
  if (!v.text && change.show === "hidden") throw Error("A blank cannot hold a hidden answer. Enter the answer, then hide it.");
  v.show = v.text ? (change.show ?? v.show) : "show";
  return validate(n);
}
/** Adds an empty box after box `after` (-1 for the front); the end stays at the end. */
export function addStep(e: Envelope, machineId: string, after = Number.POSITIVE_INFINITY, op = ""): Envelope {
  const n = clone(e),
    m = machineOf(n.document, machineId);
  if (m.steps.length >= MAX_STEPS) throw Error(`A machine can have at most ${MAX_STEPS} boxes.`);
  const at = Math.max(0, Math.min(m.steps.length, after + 1));
  m.steps.splice(at, 0, { op: value(op), out: null });
  // A value never sits after the last box.
  m.steps.at(-1)!.out = null;
  return validate(n);
}
export function removeStep(e: Envelope, machineId: string, index: number): Envelope {
  const n = clone(e),
    m = machineOf(n.document, machineId);
  if (m.steps.length <= 1) throw Error("A machine needs at least one box.");
  if (!m.steps[index]) throw Error(`There is no box ${index + 1} in this machine.`);
  m.steps.splice(index, 1);
  m.steps.at(-1)!.out = null;
  return validate(n);
}
function freshMachineId(d: MachineDocument) {
  let i = 1;
  while (d.machines.some((m) => m.id === `m${i}`)) i++;
  return `m${i}`;
}
/** Adds a machine beneath: "Here is a different number machine". Its boxes are empty. */
export function addMachine(e: Envelope, ops?: string[]): Envelope {
  const n = clone(e),
    d = n.document;
  if (d.machines.length >= MAX_MACHINES) throw Error(`Use at most ${MAX_MACHINES} machines.`);
  const first = d.machines[0];
  d.machines.push(newMachine(freshMachineId(d), ops ?? first.steps.map(() => ""), "input", "output"));
  return validate(n);
}
export function removeMachine(e: Envelope, machineId: string): Envelope {
  const n = clone(e),
    d = n.document;
  if (d.machines.length <= 1) throw Error("A diagram needs at least one machine.");
  machineOf(d, machineId);
  d.machines = d.machines.filter((m) => m.id !== machineId);
  return validate(n);
}
export function setDirection(e: Envelope, machineId: string, direction: Machine["direction"]): Envelope {
  const n = clone(e);
  machineOf(n.document, machineId).direction = direction;
  return validate(n);
}

/* ---------- Operations ---------- */

type Op = { sign: "+" | "−" | "×" | "÷"; by: Q.Q } | { sign: "²" | "³" | "√" };
/** Reads "× 3", "+5", "÷ 1/2", "− 0.4", "square", "x²", "cube" and "√"; null for anything else. */
export function readOp(text: string): Op | null {
  const t = typeset(text);
  if (/^(square|squared|x²|²|\(\s*\)²)$/i.test(t)) return { sign: "²" };
  if (/^(cube|cubed|x³|³)$/i.test(t)) return { sign: "³" };
  if (/^(√|square root|√x)$/i.test(t)) return { sign: "√" };
  const m = t.match(/^([+−×÷])\s*(.+)$/);
  if (!m) return null;
  const by = Q.parse(m[2]);
  return by ? { sign: m[1] as "+" | "−" | "×" | "÷", by } : null;
}
function sqrt(x: Q.Q): Q.Q | null {
  if (x.n < 0n) return null;
  const root = (v: bigint) => {
    if (v < 2n) return v;
    let r = BigInt(Math.floor(Math.sqrt(Number(v))));
    while (r * r > v) r--;
    while ((r + 1n) * (r + 1n) <= v) r++;
    return r * r === v ? r : null;
  };
  const a = root(x.n),
    b = root(x.d);
  return a === null || b === null ? null : Q.q(a, b);
}
export function apply(op: Op, x: Q.Q): Q.Q | null {
  switch (op.sign) {
    case "+":
      return Q.add(x, op.by);
    case "−":
      return Q.sub(x, op.by);
    case "×":
      return Q.mul(x, op.by);
    case "÷":
      return op.by.n === 0n ? null : Q.div(x, op.by);
    case "²":
      return Q.mul(x, x);
    case "³":
      return Q.mul(Q.mul(x, x), x);
    case "√":
      return sqrt(x);
  }
}
/** The inverse operation as printed: × 3 → ÷ 3, − 8 → + 8, square → √. Null if it has none. */
export function inverseText(text: string): string | null {
  const op = readOp(text);
  if (!op) return null;
  if (op.sign === "²") return "√";
  if (op.sign === "√") return "square";
  if (op.sign === "³") return "cube root";
  const back = { "+": "−", "−": "+", "×": "÷", "÷": "×" }[op.sign];
  return `${back} ${typeset(text).replace(/^[+−×÷]\s*/, "")}`;
}
const invert = (text: string) => {
  const t = inverseText(text);
  return t === null || t === "cube root" ? null : readOp(t);
};

/** The value at each position of a machine (start, after each box), worked out from the start. */
function forward(m: Machine): (Q.Q | null)[] {
  const out: (Q.Q | null)[] = [Q.parse(m.start.text)];
  m.steps.forEach((s, i) => {
    const prev = out[i],
      op = readOp(s.op.text);
    out.push(prev && op ? apply(op, prev) : null);
  });
  return out;
}
/** The value at each position, worked out back from the end. */
function backward(m: Machine): (Q.Q | null)[] {
  const out: (Q.Q | null)[] = new Array(m.steps.length + 1).fill(null);
  out[m.steps.length] = Q.parse(m.end.text);
  for (let i = m.steps.length - 1; i >= 0; i--) {
    const next = out[i + 1],
      op = invert(m.steps[i].op.text);
    out[i] = next && op ? apply(op, next) : null;
  }
  return out;
}
const positionValue = (m: Machine, i: number) => (i === 0 ? m.start : i === m.steps.length ? m.end : m.steps[i - 1].out);

/* ---------- Explicit completion ---------- */

/**
 * Works a machine out when the teacher asks: from a numeric start forwards, or (with a blank start)
 * back from a numeric end through the inverse operations. It fills blank items, and with `between`
 * writes the value on every arrow between two boxes. Items already entered never change. Filled
 * items are hidden when `hidden` is true.
 */
export function complete(e: Envelope, machineId?: string, hidden = true, between = true): { envelope: Envelope; filled: number } {
  const n = clone(e);
  if (machineId !== undefined) machineOf(n.document, machineId);
  let filled = 0;
  const visibility = hidden ? "hidden" : "show";
  for (const m of n.document.machines) {
    if (machineId !== undefined && m.id !== machineId) continue;
    const known = Q.parse(m.start.text) ? forward(m) : backward(m);
    known.forEach((x, i) => {
      if (!x) return;
      const text = Q.format(x);
      if (text.length > MAX_TEXT) return;
      if (i === 0 || i === m.steps.length) {
        const v = i === 0 ? m.start : m.end;
        if (!v.text) {
          Object.assign(v, value(text, visibility));
          filled++;
        }
      } else {
        const step = m.steps[i - 1];
        if (step.out === null && !between) return;
        if (!step.out?.text) {
          step.out = value(text, visibility);
          filled++;
        }
      }
    });
  }
  return { envelope: validate(n), filled };
}
/**
 * Adds the inverse of a machine beneath it: the boxes in reverse order with inverse operations,
 * arrows right to left, its end as the new start and its start as the new end.
 */
export function addInverse(e: Envelope, machineId: string): Envelope {
  const n = clone(e),
    d = n.document,
    m = machineOf(d, machineId);
  if (d.machines.length >= MAX_MACHINES) throw Error(`Use at most ${MAX_MACHINES} machines.`);
  const ops = [...m.steps].reverse().map((s) => {
    const t = inverseText(s.op.text);
    if (t === null) throw Error(`"${s.op.text || "an empty box"}" has no inverse to write. Fill each box with an operation such as × 3 or − 8 first.`);
    return t;
  });
  const inverse: Machine = {
    id: freshMachineId(d),
    direction: m.direction === "right" ? "left" : "right",
    start: { ...m.end },
    steps: ops.map((op) => ({ op: value(op), out: null })),
    end: { ...m.start },
  };
  d.machines.splice(d.machines.indexOf(m) + 1, 0, inverse);
  return validate(n);
}

/* ---------- Teacher warnings ---------- */

export function warnings(e: Envelope): string[] {
  const d = e.document;
  if (d.intentionalError) return [];
  const out: string[] = [];
  d.machines.forEach((m, k) => {
    const where = d.machines.length > 1 ? `In machine ${k + 1}, ` : "";
    const say = (s: string) => out.push(where ? where + s[0].toLowerCase() + s.slice(1) : s);
    m.steps.forEach((s) => {
      if (s.op.text && !readOp(s.op.text) && !/[a-z]/i.test(s.op.text)) say(`"${s.op.text}" is not an operation the machine can follow, such as × 3 or − 8.`);
    });
    // Values are carried on from the last written number; each written number is checked against it.
    let current = Q.parse(m.start.text),
      said = current ? Q.format(current) : "";
    for (let i = 1; i <= m.steps.length; i++) {
      const op = readOp(m.steps[i - 1].op.text),
        given = positionValue(m, i);
      current = current && op ? apply(op, current) : null;
      said = `${said} ${opLabel(m.steps[i - 1].op.text)}`;
      const written = given?.text ? Q.parse(given.text) : null;
      if (current && written && !Q.eq(current, written)) say(`${said} is ${Q.format(current)}, not ${given!.text}.`);
      if (written || (given?.text && !current)) {
        current = written;
        said = written ? Q.format(written) : "";
      }
    }
  });
  return [...new Set(out)];
}

/* ---------- Views ---------- */

const REVEALED = new WeakSet<Value>();
/** Every answer the answers copy prints, so both copies keep the same size. */
const ANSWERED = new WeakSet<Value>();
/** The answers copy prints hidden answers; with `mark` they print in the answer colour. */
export function forView(e: Envelope, view: "pupil" | "answer", mark = false): Envelope {
  if (view === "pupil") return e;
  const n = clone(e);
  for (const m of n.document.machines)
    for (const v of values(m)) {
      if (v.show === "hidden" && v.text) ANSWERED.add(v);
      if (mark && v.show === "hidden" && v.text) REVEALED.add(v);
      v.show = "show";
    }
  return n;
}

/* ---------- Layout ---------- */

const MARGIN = 1;
const BOX_H = 11;
const BOX_MIN = 17;
const BOX_PAD = 7;
const POINT = 5;
const ARROW_MIN = 13;
const END_GAP = 2;
const BLANK_END = 15;
const BLANK_OP = 10;
const BLANK_OUT = 12;
const ROW_GAP = 7;
const HEAD = 2.2;
const MAX_WIDTH_MM = 180;

const printed = (v: Value) => (v.show === "show" ? v.text : "");
/** An answer (hidden, or revealed on the answers copy) takes the room of its blank or of its text, whichever is wider, on both copies. */
const isAnswer = (v: Value) => !!v.text && (v.show === "hidden" || ANSWERED.has(v));
const room = (v: Value, blank: number, as = (t: string) => t) => (isAnswer(v) ? Math.max(blank, mathsWidth(as(v.text))) : printed(v) ? mathsWidth(as(printed(v))) : blank);
/** An operation prints with a space after its sign, as on the paper: × 3, − 8 (a negative number at an end stays −8). */
export const opLabel = (t: string) => typeset(t).replace(/^([+−×÷])\s*/, "$1 ");
const tall = (v: Value) => (v.text ? mathsHeight(v.text) : FONT * 1.2);
export type Hit = { machineId: string; slot: Slot; x: number; y: number; width: number; height: number };
type Box = { x: number; width: number; op: Value; slot: Slot };
type Label = { cx: number; cy: number; v: Value; blank: number; slot: Slot };
type Arrow = { x1: number; x2: number; y: number };
type Row = { machine: Machine; y: number; boxes: Box[]; labels: Label[]; arrows: Arrow[]; width: number; left: number };

export function layout(e: Envelope) {
  const d = e.document,
    issues: string[] = [],
    rows: Row[] = [],
    hits: Hit[] = [];
  let top = MARGIN;
  for (const m of d.machines) {
    // Lay the machine out left to right, then mirror it for a machine that runs backwards.
    const labels: Label[] = [],
      boxes: Box[] = [],
      arrows: Arrow[] = [];
    const endWidth = (v: Value) => Math.max(room(v, BLANK_END), 6);
    const outs = m.steps.map((s) => s.out);
    const aboveRoom = Math.max(0, ...outs.map((o) => (o ? tall(o) + 2.4 : 0)));
    const halfBox = BOX_H / 2;
    const cy = top + Math.max(halfBox, aboveRoom + 1),
      bottom = cy + Math.max(halfBox, tall(m.start) / 2, tall(m.end) / 2);
    let x = MARGIN;
    const sw = endWidth(m.start);
    labels.push({ cx: x + sw / 2, cy, v: m.start, blank: BLANK_END, slot: "start" });
    x += sw + END_GAP;
    m.steps.forEach((s, i) => {
      const before = i === 0 ? null : m.steps[i - 1].out;
      const len = Math.max(ARROW_MIN, before ? room(before, BLANK_OUT) + 4 : 0);
      arrows.push({ x1: x, x2: x + len, y: cy });
      if (before) labels.push({ cx: x + len / 2, cy: cy - 2.4 - tall(before) / 2, v: before, blank: BLANK_OUT, slot: `out:${i - 1}` });
      x += len;
      const tip = d.boxShape === "pentagon" ? POINT : 0;
      const width = Math.max(BOX_MIN, room(s.op, BLANK_OP, opLabel) + BOX_PAD) + tip;
      boxes.push({ x, width, op: s.op, slot: `op:${i}` });
      x += width;
    });
    arrows.push({ x1: x, x2: x + ARROW_MIN, y: cy });
    x += ARROW_MIN + END_GAP;
    const ew = endWidth(m.end);
    labels.push({ cx: x + ew / 2, cy, v: m.end, blank: BLANK_END, slot: "end" });
    x += ew;
    const width = x + MARGIN;
    if (m.direction === "left") {
      for (const l of labels) l.cx = width - l.cx;
      for (const b of boxes) b.x = width - b.x - b.width;
      for (const a of arrows) [a.x1, a.x2] = [width - a.x1, width - a.x2];
    }
    rows.push({ machine: m, y: cy, boxes, labels, arrows, width, left: 0 });
    top = bottom + ROW_GAP;
  }
  const width = Math.max(...rows.map((r) => r.width));
  const height = top - ROW_GAP + MARGIN;
  // Machines are centred one above the other, as printed.
  for (const r of rows) {
    const shift = (width - r.width) / 2;
    r.left = shift;
    for (const l of r.labels) {
      l.cx += shift;
      const v = printed(l.v);
      const w = v ? mathsWidth(v) : l.blank,
        h = v ? mathsHeight(v) : FONT * 1.4;
      hits.push({ machineId: r.machine.id, slot: l.slot, x: l.cx - w / 2 - 1, y: l.cy - h / 2 - 0.5, width: w + 2, height: h + 1 });
    }
    for (const b of r.boxes) {
      b.x += shift;
      hits.push({ machineId: r.machine.id, slot: b.slot, x: b.x, y: r.y - BOX_H / 2, width: b.width, height: BOX_H });
    }
    for (const a of r.arrows) {
      a.x1 += shift;
      a.x2 += shift;
    }
  }
  if (width > MAX_WIDTH_MM) issues.push(`The machine is ${Math.round(width)} mm wide, over the ${MAX_WIDTH_MM} mm print width. Use fewer boxes or shorter labels.`);
  return { width, height, rows, hits, issues };
}
export const exportIssue = (e: Envelope) => layout(e).issues[0] ?? null;

/* ---------- SVG ---------- */

const num = (v: number) => String(Math.round(v * 1000) / 1000);
const dotted = (x1: number, x2: number, y: number) =>
  `<line x1="${num(x1)}" y1="${num(y)}" x2="${num(x2)}" y2="${num(y)}" stroke="black" stroke-width="0.3" stroke-dasharray="0.3 0.9" stroke-linecap="round"/>`;
const ink = (v: Value) => (REVEALED.has(v) ? ANSWER_COLOUR : "black");

export function renderSvg(e: Envelope): string {
  const d = e.document,
    g = layout(e),
    out: string[] = [`<rect width="${num(g.width)}" height="${num(g.height)}" fill="white"/>`];
  for (const r of g.rows) {
    const left = r.machine.direction === "left";
    for (const a of r.arrows) {
      const dir = a.x2 > a.x1 ? 1 : -1;
      out.push(`<line x1="${num(a.x1)}" y1="${num(a.y)}" x2="${num(a.x2 - dir * HEAD)}" y2="${num(a.y)}" stroke="black" stroke-width="0.3"/>`);
      out.push(`<path d="M${num(a.x2)} ${num(a.y)}L${num(a.x2 - dir * HEAD)} ${num(a.y - 0.8)}L${num(a.x2 - dir * HEAD)} ${num(a.y + 0.8)}Z" fill="black"/>`);
    }
    for (const b of r.boxes) {
      const t = r.y - BOX_H / 2,
        bt = r.y + BOX_H / 2;
      const tip = d.boxShape === "pentagon" ? POINT : 0;
      const body = left ? { from: b.x + tip, to: b.x + b.width } : { from: b.x, to: b.x + b.width - tip };
      if (!tip) out.push(`<rect x="${num(b.x)}" y="${num(t)}" width="${num(b.width)}" height="${num(BOX_H)}" fill="none" stroke="black" stroke-width="0.3"/>`);
      else if (!left)
        out.push(`<path d="M${num(b.x)} ${num(t)}H${num(body.to)}L${num(b.x + b.width)} ${num(r.y)}L${num(body.to)} ${num(bt)}H${num(b.x)}Z" fill="none" stroke="black" stroke-width="0.3" stroke-linejoin="miter"/>`);
      else
        out.push(`<path d="M${num(b.x + b.width)} ${num(t)}H${num(body.from)}L${num(b.x)} ${num(r.y)}L${num(body.from)} ${num(bt)}H${num(b.x + b.width)}Z" fill="none" stroke="black" stroke-width="0.3" stroke-linejoin="miter"/>`);
      const cx = (body.from + body.to) / 2;
      const p = printed(b.op);
      if (p) out.push(mathsMarkup(opLabel(p), cx, r.y, ink(b.op)));
      else out.push(dotted(body.from + 1.5, body.to - 1.5, r.y + 3));
    }
    for (const l of r.labels) {
      const p = printed(l.v);
      if (p) out.push(mathsMarkup(p, l.cx, l.cy, ink(l.v)));
      else out.push(dotted(l.cx - l.blank / 2, l.cx + l.blank / 2, l.cy + FONT * 0.4));
    }
  }
  const label = `Function machine${d.machines.length > 1 ? "s" : ""}: ${d.machines
    .map((m) => [printed(m.start) || "blank", ...m.steps.map((s) => printed(s.op) || "empty box"), printed(m.end) || "blank"].join(", "))
    .join("; ")}`;
  return boldLines(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(g.width)}mm" height="${num(g.height)}mm" viewBox="0 0 ${num(g.width)} ${num(g.height)}" role="img" aria-label="${esc(label)}">${out.join("")}</svg>`,
    d.lines,
  );
}

/* ---------- Editor links ---------- */

export const MAX_LINK_LENGTH = 16_000;
export const LINK_PREFIX = "#function-machine=";
export const linkHash = (e: Envelope) => LINK_PREFIX + toBase64Url(canonical(e));
export function editorLink(e: Envelope, base: string): string | null {
  const url = new URL(base);
  url.pathname = url.pathname.replace(/(\/tools(\/[^/]*)?)?\/?$/, "/") + "tools/function-machine";
  url.search = "";
  url.hash = linkHash(e);
  return url.href.length <= MAX_LINK_LENGTH ? url.href : null;
}
export function decodeLinkHash(hashText: string): Envelope {
  if (!hashText.startsWith(LINK_PREFIX) || !/^[A-Za-z0-9_-]+$/.test(hashText.slice(LINK_PREFIX.length)) || hashText.length > MAX_LINK_LENGTH)
    throw Error("This is not a supported function machine link. Open an editable file instead.");
  try {
    const binary = atob(hashText.slice(LINK_PREFIX.length).replaceAll("-", "+").replaceAll("_", "/"));
    return parseFile(new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
  } catch {
    throw Error("This function machine link could not be read. Open an editable file instead.");
  }
}
