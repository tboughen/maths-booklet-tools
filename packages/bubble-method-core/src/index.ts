/**
 * The bubble method (the school's balancing layout): solving equations and inequalities and
 * changing the subject of a formula, one line per step going down the page. Between two lines
 * the operation is written in a bubble underneath the term it acts on, on both sides:
 *
 *        y = 3x + 2
 *      (−2)    (−2)
 *    y − 2 = 3x
 *
 * Lines are aligned on their sign. Every printed item (each side of a line, each bubble) is
 * {text, show}: empty text is a pupil blank (a dotted line, or an empty bubble), and a hidden item
 * is a saved answer that pupils see as a blank and the answers copy prints in the answer colour.
 * Nothing is worked out for the teacher; bubbles that differ between the two sides raise a teacher
 * note, never a correction, so error-spotting works.
 */
import { z } from "zod";
import { sha256Hex, toBase64Url } from "../../envelope-core/src/index";
import { aboutShape } from "../../envelope-core/src/about";
import { boldLines, LINE_WEIGHTS } from "../../envelope-core/src/house-style";
import { FONT, esc, heightOf, markupAt, markupCentred, termSpans, typesetOp, typesetSide, widthOf } from "./maths";

export { FONT, typesetOp, typesetSide } from "./maths";

/** The renderer version every new bubble-method envelope carries. */
export const RENDERER_VERSION = "bubble-method-1" as const;

export const MAX_STEPS = 8;
export const MAX_SIDE = 40;
export const MAX_OP = 12;
export const MAX_TERMS = 10;
export const ANSWER_COLOUR = "#b0125b";
export const RELATIONS = ["=", "<", ">", "≤", "≥"] as const;
export type Relation = (typeof RELATIONS)[number];

const show = z.enum(["show", "hidden"]);
export const sideSchema = z.object({ text: z.string().max(MAX_SIDE), show }).strict();
export const opSchema = z.object({ text: z.string().max(MAX_OP), show }).strict();
export const lineSchema = z
  .object({
    lhs: sideSchema,
    /** The sign the lines align on. An inequality's sign is the teacher's to turn round. */
    rel: z.enum(RELATIONS),
    rhs: sideSchema,
  })
  .strict();
/**
 * Where a bubble sits under the line above: "auto" puts + and − under the last term and every
 * other operation under the whole side; "whole" centres it under the side; a number is a term,
 * counted from 0 on the left.
 */
export const underSchema = z.union([z.enum(["auto", "whole"]), z.number().int().min(0).max(MAX_TERMS - 1)]);
export const bubbleSchema = z.object({ op: opSchema, under: underSchema }).strict();
export const stepSchema = z
  .object({
    /** The bubble under the left-hand side of the line above. */
    left: bubbleSchema,
    /** The bubble under the right-hand side of the line above. */
    right: bubbleSchema,
    /** The line the bubbles lead to. */
    line: lineSchema,
  })
  .strict();
export const documentSchema = z
  .object({
    /** The equation, inequality or formula at the top. */
    first: lineSchema,
    steps: z.array(stepSchema).max(MAX_STEPS),
    /** An error-spotting task: bubbles that differ raise no teacher note. */
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
    kind: z.literal("bubble-method"),
    schemaVersion: z.literal(1),
    rendererVersion: z.literal(RENDERER_VERSION),
    document: documentSchema,
    ...aboutShape,
  })
  .strict();
export type Envelope = z.infer<typeof envelopeSchema>;
export type BubbleDocument = Envelope["document"];
export type Line = BubbleDocument["first"];
export type Step = BubbleDocument["steps"][number];
export type Bubble = Step["left"];
export type Under = Bubble["under"];
export type Value = Line["lhs"];
/**
 * A printed item: a side of the first line ("first:lhs"), a side of a step's line ("step:0:rhs")
 * or one of a step's bubbles ("step:0:left").
 */
export type Slot = `first:${"lhs" | "rhs"}` | `step:${number}:${"left" | "right" | "lhs" | "rhs"}`;
export const SLOT_PATTERN = /^(first:(lhs|rhs)|step:[0-7]:(left|right|lhs|rhs))$/;

export const value = (text = "", visibility: Value["show"] = "show"): Value => ({ text, show: visibility });
export const line = (lhs = "", rhs = "", rel: Relation = "="): Line => ({ lhs: value(lhs), rel, rhs: value(rhs) });
export const bubble = (op = "", under: Under = "auto"): Bubble => ({ op: value(op), under });

/* ---------- Validation ---------- */

const HIDDEN_BLANK = "A blank cannot hold a hidden answer. Enter the answer, then hide it.";
export function validate(input: unknown): Envelope {
  const parsed = envelopeSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0],
      path = issue?.path ?? [];
    if (path.includes("text") && path.includes("op")) throw Error(`Use at most ${MAX_OP} characters in each bubble.`);
    if (path.includes("text")) throw Error(`Use at most ${MAX_SIDE} characters on each side of a line.`);
    if (path.length === 2 && path[1] === "steps") throw Error(`Use at most ${MAX_STEPS} steps.`);
    throw Error("This is not a supported bubble method file (version 1 is supported).");
  }
  const e = parsed.data;
  for (const v of values(e.document)) {
    v.text = v.text.trim().replace(/\s+/g, " ");
    if (!v.text && v.show === "hidden") throw Error(HIDDEN_BLANK);
  }
  return e;
}
/** Every printed item, top to bottom. */
export function values(d: BubbleDocument): Value[] {
  return [d.first.lhs, d.first.rhs, ...d.steps.flatMap((s) => [s.left.op, s.right.op, s.line.lhs, s.line.rhs])];
}
export const canonical = (e: Envelope) => JSON.stringify(validate(e));
export function parseFile(text: string) {
  if (text.length > 40000) throw Error("This editable file is too large.");
  return validate(JSON.parse(text));
}
export async function hash(e: Envelope) {
  return sha256Hex(canonical(e));
}
export const hasHidden = (e: Envelope) => values(e.document).some((v) => v.show === "hidden" && !!v.text);

/* ---------- Building ---------- */

/** An equation with one empty step under it; the default starts from 2x + 3 = 11. */
export function create(first: Line = line("2x + 3", "11"), steps: Step[] = [{ left: bubble(), right: bubble(), line: line() }]): Envelope {
  return validate({
    kind: "bubble-method",
    schemaVersion: 1,
    rendererVersion: RENDERER_VERSION,
    document: { first, steps, intentionalError: false },
  });
}
const clone = (e: Envelope) => structuredClone(e);
function stepOf(d: BubbleDocument, index: number): Step {
  const s = d.steps[index];
  if (!s) throw Error(`There is no step ${index + 1}.`);
  return s;
}
/** The line a slot belongs to: "first" or a step's index. */
export const lineIndexOf = (slot: Slot): "first" | number => (slot.startsWith("first:") ? "first" : Number(slot.split(":")[1]));
export function slotValue(d: BubbleDocument, slot: Slot): Value {
  if (!SLOT_PATTERN.test(slot)) throw Error(`There is no item ${slot}.`);
  if (slot === "first:lhs") return d.first.lhs;
  if (slot === "first:rhs") return d.first.rhs;
  const [, at, part] = slot.split(":"),
    s = stepOf(d, Number(at));
  return part === "left" ? s.left.op : part === "right" ? s.right.op : part === "lhs" ? s.line.lhs : s.line.rhs;
}
export const isBubble = (slot: Slot) => slot.endsWith(":left") || slot.endsWith(":right");
/** Sets an item's text and visibility. Hiding an empty item is refused: a blank has no answer to keep. */
export function setSlot(e: Envelope, slot: Slot, change: { text?: string; show?: Value["show"] }): Envelope {
  const n = clone(e),
    v = slotValue(n.document, slot);
  if (change.text !== undefined) v.text = change.text.trim();
  if (!v.text && change.show === "hidden") throw Error(HIDDEN_BLANK);
  v.show = v.text ? (change.show ?? v.show) : "show";
  return validate(n);
}
export function setUnder(e: Envelope, step: number, side: "left" | "right", under: Under): Envelope {
  const n = clone(e);
  stepOf(n.document, step)[side].under = under;
  return validate(n);
}
export function setRelation(e: Envelope, at: "first" | number, rel: Relation): Envelope {
  const n = clone(e);
  (at === "first" ? n.document.first : stepOf(n.document, at).line).rel = rel;
  return validate(n);
}
/**
 * Adds a step after step `after` (-1 puts it straight under the first line; the default is the
 * end): both bubbles hold `op` (empty bubbles by default), and its line is blank with the sign of
 * the line above.
 */
export function addStep(e: Envelope, after = Number.POSITIVE_INFINITY, op = ""): Envelope {
  const n = clone(e),
    d = n.document;
  if (d.steps.length >= MAX_STEPS) throw Error(`Use at most ${MAX_STEPS} steps.`);
  const at = Math.max(0, Math.min(d.steps.length, after + 1));
  const above = at === 0 ? d.first : d.steps[at - 1].line;
  d.steps.splice(at, 0, { left: bubble(op), right: bubble(op), line: line("", "", above.rel) });
  return validate(n);
}
export function removeStep(e: Envelope, index: number): Envelope {
  const n = clone(e);
  stepOf(n.document, index);
  n.document.steps.splice(index, 1);
  return validate(n);
}
/** Writes the same operation in both bubbles of a step, keeping each bubble's visibility. */
export function setBubbles(e: Envelope, step: number, op: string): Envelope {
  let n = setSlot(e, `step:${step}:left`, { text: op });
  n = setSlot(n, `step:${step}:right`, { text: op });
  return n;
}

/* ---------- Operations ---------- */

/** Reads a bubble: a sign and what it acts with (−2, ÷3, ×(−1), +3x), or a square or root. */
export function readOp(text: string): { sign: "+" | "−" | "×" | "÷" | "²" | "√"; by: string } | null {
  const t = typesetOp(text);
  if (/^(square|squared|²|\(\s*\)²)$/i.test(t)) return { sign: "²", by: "" };
  if (/^(√|square root)$/i.test(t)) return { sign: "√", by: "" };
  const m = t.match(/^([+−×÷])(.+)$/);
  return m ? { sign: m[1] as "+" | "−" | "×" | "÷", by: m[2].trim() } : null;
}

/* ---------- Teacher warnings ---------- */

export function warnings(e: Envelope): string[] {
  const d = e.document;
  if (d.intentionalError) return [];
  const out: string[] = [];
  d.steps.forEach((s, i) => {
    const where = d.steps.length > 1 ? `Step ${i + 1}: ` : "";
    const say = (t: string) => out.push(where ? where + t : t[0].toUpperCase() + t.slice(1));
    for (const b of [s.left, s.right])
      if (b.op.text && !readOp(b.op.text)) say(`"${b.op.text}" is not an operation for a bubble, such as −2, ÷3 or ×4.`);
    const l = typesetOp(s.left.op.text),
      r = typesetOp(s.right.op.text);
    // An empty bubble is a pupil blank, so only two written bubbles are compared.
    if (l && r && l !== r) say(`the bubbles differ (${l} and ${r}). Balancing does the same to both sides.`);
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
  for (const v of values(n.document)) {
    if (v.show === "hidden" && v.text) {
      ANSWERED.add(v);
      if (mark) REVEALED.add(v);
    }
    v.show = "show";
  }
  return n;
}

/* ---------- Layout ---------- */

const MARGIN = 1;
/** Half the gap from the sign to each side. */
const SIDE_GAP = 2.8;
/** A blank side: room for a pupil to write a short expression by hand. */
const BLANK_SIDE = 26;
/** Handwriting room for a line with a blank: tall enough for a stacked fraction by hand. */
const BLANK_LINE = 12;
const LINE_MIN = 8.5;
/** An empty bubble's half-width and half-height: room to write −12 or ÷3 by hand. */
const BLANK_RX = 6.5;
const BUBBLE_RY = 3.6;
const BUBBLE_PAD = 2.2;
const BUBBLE_MIN_RX = 4.6;
const BUBBLE_GAP = 1.2;
const ROW_GAP = 1.2;
const MAX_WIDTH_MM = 180;

const printed = (v: Value) => (v.show === "show" ? v.text : "");
/** An answer (hidden, or revealed on the answers copy) takes the room of its blank or of its text, whichever is wider, on both copies. */
const isAnswer = (v: Value) => !!v.text && (v.show === "hidden" || ANSWERED.has(v));
const sideRoom = (v: Value) => {
  const t = typesetSide(v.text);
  return isAnswer(v) ? Math.max(BLANK_SIDE, widthOf(t)) : printed(v) ? widthOf(t) : BLANK_SIDE;
};
const sideTall = (v: Value) => (v.text && (isAnswer(v) || printed(v)) ? heightOf(typesetSide(v.text)) : FONT * 1.2);
const isBlankish = (v: Value) => !printed(v) || isAnswer(v);
const bubbleRx = (v: Value) => {
  const own = v.text ? Math.max(BUBBLE_MIN_RX, widthOf(typesetOp(v.text)) / 2 + BUBBLE_PAD) : BLANK_RX;
  return isAnswer(v) ? Math.max(BLANK_RX, own) : printed(v) ? own : BLANK_RX;
};
const bubbleRy = (v: Value) => (v.text && (isAnswer(v) || printed(v)) ? Math.max(BUBBLE_RY, heightOf(typesetOp(v.text)) / 2 + 1) : BUBBLE_RY);

export type Hit = { slot: Slot; x: number; y: number; width: number; height: number };
type SideBox = { v: Value; slot: Slot; x: number; width: number; cy: number; height: number; align: "end" | "start" };
type RowLine = { kind: "line"; cy: number; rel: Relation; lhs: SideBox; rhs: SideBox };
type RowBubbles = { kind: "bubbles"; cy: number; ry: number; items: { v: Value; slot: Slot; cx: number; rx: number; ry: number }[] };

/** Where a bubble sits on the side above it (x from the side's left edge). */
function bubbleCentre(side: SideBox, b: Bubble): number {
  const t = printed(side.v) || (isAnswer(side.v) ? side.v.text : "");
  if (!t) return side.width / 2;
  const text = typesetSide(t),
    spans = termSpans(text),
    own = widthOf(text);
  // Text inside a wider answer room sits at its end (left side) or start (right side).
  const offset = side.align === "end" ? side.width - own : 0;
  const op = readOp(b.op.text);
  const under = b.under === "auto" ? (op && (op.sign === "+" || op.sign === "−") ? spans.length - 1 : "whole") : b.under;
  if (under === "whole" || spans.length === 0) return offset + own / 2;
  return offset + spans[Math.min(under, spans.length - 1)].cx;
}

export function layout(e: Envelope) {
  const d = e.document,
    issues: string[] = [];
  // Positions are first measured from the sign (x = 0), then moved right so nothing is clipped.
  const rows: (RowLine | RowBubbles)[] = [];
  let y = MARGIN;
  const lineRow = (l: Line, prefix: "first" | `step:${number}`): RowLine => {
    const tall = Math.max(sideTall(l.lhs), sideTall(l.rhs));
    const h = Math.max(isBlankish(l.lhs) || isBlankish(l.rhs) ? BLANK_LINE : LINE_MIN, tall + 3.5);
    const cy = y + h / 2;
    y += h;
    const lw = sideRoom(l.lhs),
      rw = sideRoom(l.rhs);
    return {
      kind: "line",
      cy,
      rel: l.rel,
      lhs: { v: l.lhs, slot: `${prefix}:lhs`, x: -SIDE_GAP - lw, width: lw, cy, height: h, align: "end" },
      rhs: { v: l.rhs, slot: `${prefix}:rhs`, x: SIDE_GAP, width: rw, cy, height: h, align: "start" },
    };
  };
  let above = lineRow(d.first, "first");
  rows.push(above);
  d.steps.forEach((s, i) => {
    const lrx = bubbleRx(s.left.op),
      rrx = bubbleRx(s.right.op),
      ry = Math.max(bubbleRy(s.left.op), bubbleRy(s.right.op));
    // Each bubble sits under its term, kept on its own side of the sign.
    const lx = Math.min(above.lhs.x + bubbleCentre(above.lhs, s.left), -BUBBLE_GAP - lrx),
      rx = Math.max(above.rhs.x + bubbleCentre(above.rhs, s.right), BUBBLE_GAP + rrx);
    const cy = y + ROW_GAP + ry;
    y = cy + ry + ROW_GAP;
    rows.push({
      kind: "bubbles",
      cy,
      ry,
      items: [
        { v: s.left.op, slot: `step:${i}:left`, cx: lx, rx: lrx, ry },
        { v: s.right.op, slot: `step:${i}:right`, cx: rx, rx: rrx, ry },
      ],
    });
    above = lineRow(s.line, `step:${i}`);
    rows.push(above);
  });
  let left = 0,
    right = 0;
  for (const r of rows) {
    if (r.kind === "line") {
      left = Math.min(left, r.lhs.x);
      right = Math.max(right, r.rhs.x + r.rhs.width);
    } else
      for (const b of r.items) {
        left = Math.min(left, b.cx - b.rx - 0.3);
        right = Math.max(right, b.cx + b.rx + 0.3);
      }
  }
  const sign = MARGIN - left,
    width = sign + right + MARGIN,
    height = y + MARGIN;
  const hits: Hit[] = [];
  for (const r of rows) {
    if (r.kind === "line") {
      for (const s of [r.lhs, r.rhs]) {
        s.x += sign;
        hits.push({ slot: s.slot, x: s.x - 0.5, y: s.cy - s.height / 2, width: s.width + 1, height: s.height });
      }
    } else
      for (const b of r.items) {
        b.cx += sign;
        hits.push({ slot: b.slot, x: b.cx - b.rx, y: r.cy - b.ry, width: b.rx * 2, height: b.ry * 2 });
      }
  }
  if (width > MAX_WIDTH_MM) issues.push(`The working is ${Math.round(width)} mm wide, over the ${MAX_WIDTH_MM} mm print width. Shorten the longest line.`);
  return { width, height, sign, rows, hits, issues };
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
    if (r.kind === "line") {
      out.push(markupCentred(r.rel, g.sign, r.cy));
      for (const s of [r.lhs, r.rhs]) {
        const p = printed(s.v);
        if (p) {
          const t = typesetSide(p),
            w = widthOf(t);
          out.push(markupAt(t, s.align === "end" ? s.x + s.width - w : s.x, r.cy, ink(s.v)));
        } else out.push(dotted(s.x, s.x + s.width, r.cy + FONT * 0.45));
      }
    } else
      for (const b of r.items) {
        out.push(`<ellipse cx="${num(b.cx)}" cy="${num(r.cy)}" rx="${num(b.rx)}" ry="${num(b.ry)}" fill="none" stroke="black" stroke-width="0.3"/>`);
        const p = printed(b.v);
        if (p) out.push(markupCentred(typesetOp(p), b.cx, r.cy, ink(b.v)));
      }
  }
  const said = (v: Value) => printed(v) || "blank";
  const label = `Bubble method: ${said(d.first.lhs)} ${d.first.rel} ${said(d.first.rhs)}${d.steps
    .map((s) => `; bubbles ${printed(s.left.op) || "empty"} and ${printed(s.right.op) || "empty"}; ${said(s.line.lhs)} ${s.line.rel} ${said(s.line.rhs)}`)
    .join("")}`;
  return boldLines(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(g.width)}mm" height="${num(g.height)}mm" viewBox="0 0 ${num(g.width)} ${num(g.height)}" role="img" aria-label="${esc(label)}">${out.join("")}</svg>`,
    d.lines,
  );
}

/* ---------- Editor links ---------- */

export const MAX_LINK_LENGTH = 16_000;
export const LINK_PREFIX = "#bubble-method=";
export const linkHash = (e: Envelope) => LINK_PREFIX + toBase64Url(canonical(e));
export function editorLink(e: Envelope, base: string): string | null {
  const url = new URL(base);
  url.pathname = url.pathname.replace(/(\/tools(\/[^/]*)?)?\/?$/, "/") + "tools/bubble-method";
  url.search = "";
  url.hash = linkHash(e);
  return url.href.length <= MAX_LINK_LENGTH ? url.href : null;
}
export function decodeLinkHash(hashText: string): Envelope {
  if (!hashText.startsWith(LINK_PREFIX) || !/^[A-Za-z0-9_-]+$/.test(hashText.slice(LINK_PREFIX.length)) || hashText.length > MAX_LINK_LENGTH)
    throw Error("This is not a supported bubble method link. Open an editable file instead.");
  try {
    const binary = atob(hashText.slice(LINK_PREFIX.length).replaceAll("-", "+").replaceAll("_", "/"));
    return parseFile(new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
  } catch {
    throw Error("This bubble method link could not be read. Open an editable file instead.");
  }
}
