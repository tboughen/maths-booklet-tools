/**
 * Algebra tiles: the school's Common Approaches method for collecting like terms (A1, A2, A4.02).
 *
 * Every term is a row of identical tiles whose size shows what the term is: a small 1 by 1 square
 * for a number, a strip for a letter (a by 1), a square for a squared letter (a by a), a rectangle
 * for a product of two letters (a by b), and a block for three letters (a²b is an a by a by b
 * block, ab² an a by b by b block), so terms that are not alike never look alike. Negative tiles
 * follow the counters convention (yellow positive, red negative) and are also hatched and signed,
 * so they read the same in black and white. Zero pairs can be ringed in the grouped arrangement.
 *
 * Pupil blanks and saved answers follow the other tools: a hidden term leaves its space empty for
 * pupils and prints in the answer colour on the answers copy; the expression and the simplified
 * answer under the tiles are {text, show} items, where empty text is a pupil answer line. Nothing
 * is written or collected unless the teacher asks (writeExpression, collect); an expression or
 * answer that does not match the tiles raises a teacher note, never a correction.
 */
import { z } from "zod";
import { sha256Hex, toBase64Url } from "../../envelope-core/src/index";
import { aboutShape } from "../../envelope-core/src/about";
import { boldLines, LINE_WEIGHTS } from "../../envelope-core/src/house-style";
import { FONT, esc, mathsMarkup, mathsWidth } from "../../function-machine-core/src/maths-text";

/** The renderer version every new algebra tiles envelope carries. */
export const RENDERER_VERSION = "algebra-tiles-1" as const;

export const MAX_TERMS = 16;
export const MAX_COUNT = 12;
export const MAX_TILES = 60;
export const MAX_DEGREE = 3;
export const MAX_TEXT = 80;
export const ANSWER_COLOUR = "#b0125b";
/** Letters a pupil could confuse with a number (o, l) or an operation (x is fine; it is italic) are refused. */
const LETTER = /^[a-km-np-z]$/;

/** "omit" (Leave out, 22 Nov 2026) keeps the value but prints nothing in either copy, not even a blank line. */
const show = z.enum(["show", "hidden", "omit"]);
export const valueSchema = z.object({ text: z.string().max(MAX_TEXT), show }).strict();
const id = z.string().regex(/^[a-z][a-z0-9-]{0,23}$/);
const power = z.number().int().min(0).max(MAX_DEGREE);
export const termSchema = z
  .object({
    id,
    /** How many tiles, and their sign: −3 is three negative tiles. Never 0. */
    count: z.number().int().min(-MAX_COUNT).max(MAX_COUNT),
    /** The power of the long letter (letters.long) in this term. */
    long: power,
    /** The power of the short letter (letters.short) in this term. */
    short: power,
    /** "hidden": pupils see the space empty (they draw the tiles); the answers copy prints them. */
    show,
  })
  .strict();
export const documentSchema = z
  .object({
    /** The long letter (a: tiles of length a) and the short letter (b). Single lower-case letters. */
    letters: z.object({ long: z.string().regex(LETTER), short: z.string().regex(LETTER) }).strict(),
    terms: z.array(termSchema).min(1).max(MAX_TERMS),
    /** "as-written": the terms in order; "grouped": like tiles together, positives above negatives. */
    arrangement: z.enum(["as-written", "grouped"]),
    /** Grouped only: ring each positive and negative tile that make a zero pair; "hidden" rings them on the answers copy only. */
    zeroPairs: z.enum(["none", "show", "hidden"]),
    /** Print each tile's term on it (a, ab, a²b, 1). */
    labels: z.boolean(),
    /** "colour": yellow positive and red negative tiles; "plain": white tiles. Negative tiles are always hatched, and signed when labels print. */
    fill: z.enum(["colour", "plain"]),
    /** A dashed frame round the tiles: room for pupils to draw them. */
    frame: z.boolean(),
    /** The expression the tiles show, printed under them; null for none. Empty text is a pupil answer line. */
    expression: valueSchema.nullable(),
    /** The simplified expression after " = "; null for none. Empty text is a pupil answer line. */
    answer: valueSchema.nullable(),
    /** An error-spotting task: an expression or answer that does not match raises no teacher note. */
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
    kind: z.literal("algebra-tiles"),
    schemaVersion: z.literal(1),
    rendererVersion: z.literal(RENDERER_VERSION),
    document: documentSchema,
    ...aboutShape,
  })
  .strict();
export type Envelope = z.infer<typeof envelopeSchema>;
export type TilesDocument = Envelope["document"];
export type Term = TilesDocument["terms"][number];
export type Value = z.infer<typeof valueSchema>;
export type Letters = TilesDocument["letters"];
/** A term without its id and visibility: a count of one kind of tile. */
export type Part = { count: number; long: number; short: number };
export type Item = "expression" | "answer";

export const value = (text = "", visibility: Value["show"] = "show"): Value => ({ text, show: visibility });
const kindKey = (t: { long: number; short: number }) => `${t.long},${t.short}`;
export const degree = (t: { long: number; short: number }) => t.long + t.short;

/* ---------- Validation ---------- */

export function validate(input: unknown): Envelope {
  const parsed = envelopeSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0],
      path = issue?.path ?? [];
    if (path.includes("letters")) throw Error("Letters are single lower-case letters other than l and o.");
    if (path.includes("text")) throw Error(`Use at most ${MAX_TEXT} characters in the expression and the answer.`);
    if (path.includes("count")) throw Error(`A term has 1 to ${MAX_COUNT} tiles, positive or negative.`);
    if (path.includes("terms") && path.length <= 3) throw Error(`Use 1 to ${MAX_TERMS} terms.`);
    throw Error("This is not a supported algebra tiles file (version 1 is supported).");
  }
  const e = parsed.data,
    d = e.document;
  if (d.letters.long === d.letters.short) throw Error("The two letters must be different.");
  const ids = new Set<string>();
  let tiles = 0;
  for (const t of d.terms) {
    if (ids.has(t.id)) throw Error(`The term ID ${t.id} appears twice.`);
    ids.add(t.id);
    if (t.count === 0) throw Error("A term needs at least one tile. Remove it instead.");
    if (degree(t) > MAX_DEGREE) throw Error(`Tiles go up to three letters multiplied together, such as a²b (degree ${MAX_DEGREE}).`);
    tiles += Math.abs(t.count);
  }
  if (tiles > MAX_TILES) throw Error(`Use at most ${MAX_TILES} tiles in one diagram.`);
  for (const v of [d.expression, d.answer]) {
    if (!v) continue;
    v.text = v.text.trim().replace(/\s+/g, " ");
    if (!v.text && v.show === "hidden") throw Error("A blank cannot hold a hidden answer. Enter the answer, then hide it.");
  }
  return e;
}
export const canonical = (e: Envelope) => JSON.stringify(validate(e));
export function parseFile(text: string) {
  if (text.length > 40000) throw Error("This editable file is too large.");
  return validate(JSON.parse(text));
}
export async function hash(e: Envelope) {
  return sha256Hex(canonical(e));
}
export const hasHidden = (e: Envelope) => {
  const d = e.document;
  return d.terms.some((t) => t.show === "hidden") || (d.zeroPairs === "hidden" && d.arrangement === "grouped") || [d.expression, d.answer].some((v) => v?.show === "hidden" && !!v.text);
};

/* ---------- Terms as text ---------- */

const SUP = ["", "", "²", "³"];
/** The term's letters as printed: a²b, ab², a, 1 (for a number tile). */
export function termLetters(t: { long: number; short: number }, letters: Letters): string {
  const s = (letters.long + SUP[t.long]).repeat(t.long ? 1 : 0) + (letters.short + SUP[t.short]).repeat(t.short ? 1 : 0);
  return s || "1";
}
/** One term as printed: 3a²b, −ab², 4, −1. */
export function termText(p: Part, letters: Letters): string {
  const n = Math.abs(p.count),
    body = termLetters(p, letters);
  const core = body === "1" ? String(n) : n === 1 ? body : `${n}${body}`;
  return (p.count < 0 ? "−" : "") + core;
}
/** Terms as an expression: 3a + 2b − a + 4; no terms is 0. */
export function formatParts(parts: Part[], letters: Letters): string {
  const kept = parts.filter((p) => p.count !== 0);
  if (!kept.length) return "0";
  return kept
    .map((p, i) => {
      const t = termText(p, letters);
      if (i === 0) return t;
      return p.count < 0 ? `− ${t.slice(1)}` : `+ ${t}`;
    })
    .join(" ");
}
/** Like terms collected, in the order each kind first appears; zero totals drop out. */
export function collectParts(parts: Part[]): Part[] {
  const order: string[] = [],
    sums = new Map<string, Part>();
  for (const p of parts) {
    const k = kindKey(p);
    if (!sums.has(k)) {
      order.push(k);
      sums.set(k, { count: 0, long: p.long, short: p.short });
    }
    sums.get(k)!.count += p.count;
  }
  return order.map((k) => sums.get(k)!).filter((p) => p.count !== 0);
}
const normalise = (text: string) =>
  text
    .toLowerCase()
    .replace(/\s*\^\s*/g, "^")
    .replace(/[-–—]/g, "−")
    .replace(/\^\(?2\)?/g, "²")
    .replace(/\^\(?3\)?/g, "³")
    .replace(/\^\(?1\)?/g, "")
    .replace(/[\s*×·]/g, "");
/** The letters an expression uses, in the order they appear. */
export function lettersIn(text: string): string[] {
  return [...new Set(normalise(text).match(/[a-z]/g) ?? [])];
}
/**
 * Reads an expression such as "3a²b − 2ab^2 + ba + 4" into terms, as written (nothing is
 * collected). Letters must be the diagram's two letters; ba is ab. Null if it cannot be read.
 */
export function parseExpression(text: string, letters: Letters): Part[] | null {
  // Two numbers side by side ("2 3", "2 × 3") are not a term.
  if (/\d[\s*×·]+\d/.test(text)) return null;
  const t = normalise(text);
  if (!t) return null;
  const pieces = t.match(/[+−]?[^+−]+/g);
  if (!pieces || pieces.join("") !== t) return null;
  const out: Part[] = [];
  for (const piece of pieces) {
    const m = piece.match(/^([+−]?)(\d*)((?:[a-z][²³]?)*)$/);
    if (!m || (!m[2] && !m[3])) return null;
    let long = 0,
      short = 0;
    for (const f of m[3].match(/[a-z][²³]?/g) ?? []) {
      const p = f[1] === "²" ? 2 : f[1] === "³" ? 3 : 1;
      if (f[0] === letters.long) long += p;
      else if (f[0] === letters.short) short += p;
      else return null;
    }
    const n = m[2] ? Number(m[2]) : 1;
    if (!Number.isSafeInteger(n)) return null;
    out.push({ count: m[1] === "−" ? -n : n, long, short });
  }
  return out;
}
/** The letters for an expression: the two it uses, the first alphabetically long; else the diagram's. */
export function lettersFor(text: string, current: Letters): Letters {
  const used = lettersIn(text).map((c) => c.toLowerCase());
  if (used.length > 2) throw Error("Algebra tiles use at most two letters.");
  for (const c of used) if (!LETTER.test(c)) throw Error(`"${c}" cannot be a tile letter: use lower-case letters other than l and o.`);
  if (used.every((c) => c === current.long || c === current.short)) return current;
  if (used.length === 2) {
    const [a, b] = [...used].sort();
    return { long: a, short: b };
  }
  // One new letter takes the long tiles; the short letter is kept if it differs.
  const long = used[0];
  return { long, short: [current.short, current.long, "b", "y"].find((c) => c !== long)! };
}
export const partsOf = (d: TilesDocument): Part[] => d.terms.map((t) => ({ count: t.count, long: t.long, short: t.short }));
export const tilesExpression = (d: TilesDocument) => formatParts(partsOf(d), d.letters);
export const simplified = (d: TilesDocument) => formatParts(collectParts(partsOf(d)), d.letters);
const equivalent = (a: Part[], b: Part[]) => {
  const ca = collectParts(a),
    cb = collectParts(b);
  if (ca.length !== cb.length) return false;
  const m = new Map(ca.map((p) => [kindKey(p), p.count]));
  return cb.every((p) => m.get(kindKey(p)) === p.count);
};

/* ---------- Building ---------- */

function freshId(d: TilesDocument) {
  let i = 1;
  while (d.terms.some((t) => t.id === `t${i}`)) i++;
  return `t${i}`;
}
const clone = (e: Envelope) => structuredClone(e);
function termsFrom(parts: Part[]): Term[] {
  if (!parts.length) throw Error("Give at least one term.");
  return parts.map((p, i) => {
    if (p.count === 0) throw Error(`"${p.count}" is not a term: a term needs at least one tile.`);
    if (Math.abs(p.count) > MAX_COUNT) throw Error(`A term has at most ${MAX_COUNT} tiles; split it into smaller terms.`);
    if (degree(p) > MAX_DEGREE) throw Error("Tiles go up to three letters multiplied together, such as a²b.");
    return { id: `t${i + 1}`, count: p.count, long: p.long, short: p.short, show: "show" as const };
  });
}
/** Tiles for an expression, as written: "3a + 2b − a". The default is 3x + 2 − x. */
export function create(tiles = "3x + 2 − x", letters: Letters = { long: "x", short: "y" }): Envelope {
  const l = lettersFor(tiles, letters),
    parts = parseExpression(tiles, l);
  if (!parts) throw Error(`"${tiles}" cannot be read as tiles. Type terms such as 3a + 2b − a²b + 4.`);
  return validate({
    kind: "algebra-tiles",
    schemaVersion: 1,
    rendererVersion: RENDERER_VERSION,
    document: {
      letters: l,
      terms: termsFrom(parts),
      arrangement: "as-written",
      zeroPairs: "none",
      labels: true,
      fill: "colour",
      frame: false,
      expression: null,
      answer: null,
      intentionalError: false,
    },
  });
}
export function termOf(d: TilesDocument, termId: string): Term {
  const t = d.terms.find((x) => x.id === termId);
  if (!t) throw Error(`There is no term ${termId}.`);
  return t;
}
/** Replaces every tile with the tiles for an expression, as written. Settings and the lines under the tiles are kept. */
export function setTiles(e: Envelope, tiles: string): Envelope {
  const n = clone(e),
    d = n.document,
    l = lettersFor(tiles, d.letters),
    parts = parseExpression(tiles, l);
  if (!parts) throw Error(`"${tiles}" cannot be read as tiles. Type terms such as 3a + 2b − a²b + 4.`);
  d.letters = l;
  d.terms = termsFrom(parts);
  return validate(n);
}
/** Changes one term: its count (sign included), its kind (as text such as "a²b" or "1") or its visibility. */
export function setTerm(e: Envelope, termId: string, change: { count?: number; term?: string; show?: Term["show"] }): Envelope {
  const n = clone(e),
    d = n.document,
    t = termOf(d, termId);
  if (change.term !== undefined) {
    const kind = readKind(change.term, d.letters);
    t.long = kind.long;
    t.short = kind.short;
  }
  if (change.count !== undefined) t.count = change.count;
  if (change.show !== undefined) t.show = change.show;
  return validate(n);
}
/** "a²b", "ab", "b", "1": one kind of tile in the diagram's letters. */
export function readKind(text: string, letters: Letters): { long: number; short: number } {
  const parts = text.trim() === "1" ? [{ count: 1, long: 0, short: 0 }] : parseExpression(text, letters);
  if (!parts || parts.length !== 1 || parts[0].count !== 1)
    throw Error(`"${text}" is not a tile. Use the letters ${letters.long} and ${letters.short}, such as ${letters.long}²${letters.short}, ${letters.long}${letters.short} or 1.`);
  return { long: parts[0].long, short: parts[0].short };
}
/** Adds a term after `after` (a term ID; the end by default). */
export function addTerm(e: Envelope, part: Part, after?: string): Envelope {
  const n = clone(e),
    d = n.document;
  if (d.terms.length >= MAX_TERMS) throw Error(`Use at most ${MAX_TERMS} terms.`);
  const [t] = termsFrom([part]);
  t.id = freshId(d);
  const at = after === undefined ? d.terms.length : d.terms.indexOf(termOf(d, after)) + 1;
  d.terms.splice(at, 0, t);
  return validate(n);
}
export function removeTerm(e: Envelope, termId: string): Envelope {
  const n = clone(e),
    d = n.document;
  if (d.terms.length <= 1) throw Error("The diagram needs at least one term.");
  termOf(d, termId);
  d.terms = d.terms.filter((t) => t.id !== termId);
  return validate(n);
}
/** Moves a term one place earlier (-1) or later (+1) in the expression. */
export function moveTerm(e: Envelope, termId: string, by: -1 | 1): Envelope {
  const n = clone(e),
    d = n.document,
    i = d.terms.indexOf(termOf(d, termId)),
    j = i + by;
  if (j < 0 || j >= d.terms.length) return e;
  [d.terms[i], d.terms[j]] = [d.terms[j], d.terms[i]];
  return validate(n);
}
/**
 * Sets the expression or the answer line. null removes it; {} adds a pupil answer line. Hiding an
 * empty item is refused: a blank has no answer to keep.
 */
export function setItem(e: Envelope, item: Item, change: { text?: string; show?: Value["show"] } | null): Envelope {
  const n = clone(e),
    d = n.document;
  if (change === null) {
    d[item] = null;
    return validate(n);
  }
  const v = (d[item] ??= value());
  if (change.text !== undefined) v.text = change.text.trim();
  if (!v.text && change.show === "hidden") throw Error("A blank cannot hold a hidden answer. Enter the answer, then hide it.");
  // A blank keeps a chosen state (show or left out); an emptied hidden line becomes a plain blank.
  v.show = change.show ?? (!v.text && v.show === "hidden" ? "show" : v.show);
  return validate(n);
}
/** Renames the letters: every tile keeps its shape. */
export function setLetters(e: Envelope, letters: Letters): Envelope {
  const n = clone(e);
  n.document.letters = { long: letters.long.trim(), short: letters.short.trim() };
  return validate(n);
}

/* ---------- Explicit actions ---------- */

/** Writes the expression the tiles show, as written, when the teacher asks. A written expression is never changed. */
export function writeExpression(e: Envelope, hidden = true): { envelope: Envelope; filled: boolean } {
  return fill(e, "expression", tilesExpression(e.document), hidden);
}
/** Collects like terms into the answer line when the teacher asks. A written answer is never changed. */
export function collect(e: Envelope, hidden = true): { envelope: Envelope; filled: boolean } {
  return fill(e, "answer", simplified(e.document), hidden);
}
function fill(e: Envelope, item: Item, text: string, hidden: boolean) {
  const v = e.document[item];
  if (v?.text) return { envelope: e, filled: false };
  if (text.length > MAX_TEXT) throw Error(`The ${item} would be longer than ${MAX_TEXT} characters.`);
  // A left-out line stays left out once written.
  return { envelope: setItem(e, item, { text, show: v?.show === "omit" ? "omit" : hidden ? "hidden" : "show" }), filled: true };
}

/* ---------- Teacher warnings ---------- */

export function warnings(e: Envelope): string[] {
  const d = e.document;
  if (d.intentionalError) return [];
  const out: string[] = [],
    tiles = partsOf(d),
    shown = tilesExpression(d);
  const check = (v: Value | null, name: string, full: boolean) => {
    if (!v?.text) return;
    const parts = parseExpression(v.text, d.letters);
    if (!parts) return out.push(`The ${name} "${v.text}" cannot be read as an expression in ${d.letters.long} and ${d.letters.short}.`);
    if (!equivalent(parts, tiles)) return out.push(`The ${name} ${v.text} does not match the tiles, which show ${shown}.`);
    // A lone 0 is fully simplified; a 0 among other terms, or two like terms, is not.
    if (full && parts.length > 1 && (parts.some((p) => p.count === 0) || collectParts(parts).length !== parts.length)) out.push(`The answer ${v.text} still has like terms to collect.`);
  };
  check(d.expression, "expression", false);
  check(d.answer, "answer", true);
  if (d.zeroPairs !== "none" && d.arrangement !== "grouped") out.push("Zero pairs are ringed only when the tiles are grouped.");
  return out;
}

/* ---------- Views ---------- */

const REVEALED = new WeakSet<object>();
/** Every answer the answers copy prints, so both copies keep the same size. */
const ANSWERED = new WeakSet<object>();
/** The answers copy prints hidden answers; with `mark` they print in the answer colour. */
export function forView(e: Envelope, view: "pupil" | "answer", mark = false): Envelope {
  if (view === "pupil") return e;
  const n = clone(e),
    d = n.document;
  for (const t of d.terms) {
    // Left-out tiles and lines stay out of the teacher copy too.
    if (t.show === "omit") continue;
    if (t.show === "hidden") {
      ANSWERED.add(t);
      if (mark) REVEALED.add(t);
    }
    t.show = "show";
  }
  for (const v of [d.expression, d.answer]) {
    if (!v || v.show === "omit") continue;
    if (v.show === "hidden" && v.text) {
      ANSWERED.add(v);
      if (mark) REVEALED.add(v);
    }
    v.show = "show";
  }
  if (d.zeroPairs === "hidden") {
    ANSWERED.add(d.letters);
    if (mark) REVEALED.add(d.letters);
    d.zeroPairs = "show";
  }
  return n;
}

/* ---------- Layout ---------- */

/** Tile lengths in millimetres: the 1 by 1 tile, the long letter and the short letter. */
export const UNIT = 7;
export const LONG = 17;
export const SHORT = 11;
/** Blocks (three letters) are drawn in cabinet projection: depth at 45°, half length. */
const DEPTH = 0.5 * Math.SQRT1_2;
/** Room round the artwork; more than a zero-pair ring reaches beyond its tiles. */
const MARGIN = 1.5;
const TILE_GAP = 1.5;
const TERM_GAP = 6;
const GROUP_GAP = 9;
const SIGN_GAP = 2.5;
const ROW_GAP = 5;
const LINE_GAP = 6;
const LINE_H = 10;
const BLANK_EXPRESSION = 55;
const BLANK_ANSWER = 45;
const FRAME_PAD = 3;
/** The equals sign between the expression and the answer, with room either side. */
const EQUALS = 2.5 + 0.72 * FONT + 2.5;
const RING_PAD = 1.2;
const MAX_WIDTH_MM = 180;

/** Width, height and depth of one tile of a kind (depth 0 for flat tiles). */
export function tileSize(t: { long: number; short: number }): { w: number; h: number; depth: number } {
  const sides = [...Array(t.long).fill(LONG), ...Array(t.short).fill(SHORT)] as number[];
  if (sides.length === 0) return { w: UNIT, h: UNIT, depth: 0 };
  // A strip stands upright, one unit wide; flat tiles and block faces are long side across.
  if (sides.length === 1) return { w: UNIT, h: sides[0], depth: 0 };
  if (sides.length === 2) return { w: sides[0], h: sides[1], depth: 0 };
  return { w: sides[0], h: sides[1], depth: sides[2] * DEPTH };
}
export type Tile = { termId: string; x: number; y: number; w: number; h: number; depth: number; negative: boolean; label: string; term: Term };
export type Hit = { target: { term: string } | { item: Item }; x: number; y: number; width: number; height: number };
type Placed = { tiles: Tile[]; width: number; height: number };

const printed = (v: Value) => (v.show === "show" ? v.text : "");
const isAnswer = (v: Value) => !!v.text && (v.show === "hidden" || ANSWERED.has(v));
/** A blank or an answer takes the room of its blank or its text, whichever is wider, on both copies. */
const room = (v: Value, blank: number) => (isAnswer(v) || !v.text ? Math.max(blank, v.text ? mathsWidth(v.text) : 0) : mathsWidth(v.text));

/** Tiles for each term in order, left to right, wrapping before a term that no longer fits. */
function asWritten(d: TilesDocument, limit: number): Placed {
  const tiles: Tile[] = [];
  const rows: Tile[][] = [[]];
  let x = 0;
  d.terms.forEach((t, k) => {
    const s = tileSize(t),
      n = Math.abs(t.count),
      termWidth = n * (s.w + s.depth) + (n - 1) * TILE_GAP;
    if (k > 0) {
      if (x + TERM_GAP + termWidth > limit && x > 0) {
        rows.push([]);
        x = 0;
      } else x += TERM_GAP;
    }
    for (let i = 0; i < n; i++) {
      if (i > 0) x += TILE_GAP;
      if (x > 0 && x + s.w + s.depth > limit) {
        rows.push([]);
        x = 0;
      }
      const tile = { termId: t.id, x, y: 0, w: s.w, h: s.h, depth: s.depth, negative: t.count < 0, label: tileLabel(t, d.letters), term: t };
      rows.at(-1)!.push(tile);
      tiles.push(tile);
      x += s.w + s.depth;
    }
  });
  return stack(rows);
}
/** Like tiles together, kinds in the order they first appear: positive tiles in a row, negative tiles in a row beneath. */
function grouped(d: TilesDocument, limit: number): Placed & { pairs: [Tile, Tile][] } {
  const order: string[] = [],
    groups = new Map<string, { pos: Tile[]; neg: Tile[] }>();
  for (const t of d.terms) {
    const k = kindKey(t);
    if (!groups.has(k)) {
      order.push(k);
      groups.set(k, { pos: [], neg: [] });
    }
    const s = tileSize(t),
      g = groups.get(k)!;
    for (let i = 0; i < Math.abs(t.count); i++)
      (t.count > 0 ? g.pos : g.neg).push({ termId: t.id, x: 0, y: 0, w: s.w, h: s.h, depth: s.depth, negative: t.count < 0, label: tileLabel(t, d.letters), term: t });
  }
  const rows: { tiles: Tile[]; width: number; height: number }[][] = [[]];
  const pairs: [Tile, Tile][] = [];
  let x = 0;
  for (const k of order) {
    const g = groups.get(k)!,
      first = g.pos[0] ?? g.neg[0],
      step = first.w + first.depth + TILE_GAP;
    // A long group wraps into chunks so it still fits the print width.
    const perRow = Math.max(1, Math.floor((limit + TILE_GAP) / step));
    for (let c = 0; c < Math.max(g.pos.length, g.neg.length); c += perRow) {
      const pos = g.pos.slice(c, c + perRow),
        neg = g.neg.slice(c, c + perRow),
        cols = Math.max(pos.length, neg.length),
        width = cols * step - TILE_GAP,
        tall = first.h + first.depth,
        height = (pos.length ? tall : 0) + (neg.length ? tall : 0) + (pos.length && neg.length ? SIGN_GAP : 0);
      if (x > 0 && x + GROUP_GAP + width > limit) {
        rows.push([]);
        x = 0;
      } else if (x > 0) x += GROUP_GAP;
      pos.forEach((t, i) => Object.assign(t, { x: x + i * step, y: 0 }));
      neg.forEach((t, i) => Object.assign(t, { x: x + i * step, y: pos.length ? tall + SIGN_GAP : 0 }));
      for (let i = 0; i < Math.min(pos.length, neg.length); i++) pairs.push([pos[i], neg[i]]);
      rows.at(-1)!.push({ tiles: [...pos, ...neg], width, height });
      x += width;
    }
  }
  // Groups in a row line up along their tops; rows stack with a gap.
  const tiles: Tile[] = [];
  let top = 0,
    width = 0;
  for (const row of rows) {
    const h = Math.max(0, ...row.map((g) => g.height));
    for (const g of row)
      for (const t of g.tiles) {
        t.y += top;
        tiles.push(t);
        width = Math.max(width, t.x + t.w + t.depth);
      }
    top += h + ROW_GAP;
  }
  return { tiles, width, height: Math.max(0, top - ROW_GAP), pairs };
}
/** Rows of tiles standing on a common base line, stacked with a gap. */
function stack(rows: Tile[][]): Placed {
  const tiles: Tile[] = [];
  let top = 0,
    width = 0;
  for (const row of rows) {
    const h = Math.max(0, ...row.map((t) => t.h + t.depth));
    for (const t of row) {
      t.y = top + h - (t.h + t.depth);
      tiles.push(t);
      width = Math.max(width, t.x + t.w + t.depth);
    }
    top += h + ROW_GAP;
  }
  return { tiles, width, height: Math.max(0, top - ROW_GAP) };
}
const tileLabel = (t: Term, letters: Letters) => (t.count < 0 ? "−" : "") + termLetters(t, letters);

export type Layout = ReturnType<typeof layout>;
export function layout(e: Envelope) {
  const d = e.document,
    issues: string[] = [],
    hits: Hit[] = [];
  const pad = d.frame ? FRAME_PAD : 0,
    limit = MAX_WIDTH_MM - 2 * MARGIN - 2 * pad;
  const placed = d.arrangement === "grouped" ? grouped(d, limit) : { ...asWritten(d, limit), pairs: [] as [Tile, Tile][] };
  const left = MARGIN + pad,
    top = MARGIN + pad;
  for (const t of placed.tiles) {
    t.x += left;
    t.y += top;
  }
  // "hidden" rings become "show" on the answers copy (forView); the pupil copy never draws them.
  const ringPairs = d.zeroPairs === "show" && d.arrangement === "grouped" ? placed.pairs : [];
  let width = placed.width + 2 * pad,
    height = placed.height + 2 * pad;
  const frame = d.frame ? { x: MARGIN, y: MARGIN, w: width, h: height } : null;
  // The expression and the answer sit on one line under the tiles: "3a + 2b − a = 2a + 2b".
  const line: { item: Item; x: number; w: number; v: Value; blank: number }[] = [];
  let lineY = 0;
  if (d.expression || d.answer) {
    let x = MARGIN;
    if (d.expression) {
      const w = room(d.expression, BLANK_EXPRESSION);
      line.push({ item: "expression", x, w, v: d.expression, blank: BLANK_EXPRESSION });
      x += w;
    }
    if (d.answer) {
      if (d.expression) x += EQUALS;
      const w = room(d.answer, BLANK_ANSWER);
      line.push({ item: "answer", x, w, v: d.answer, blank: BLANK_ANSWER });
      x += w;
    }
    lineY = MARGIN + height + LINE_GAP + LINE_H / 2;
    width = Math.max(width, x - MARGIN);
    height += LINE_GAP + LINE_H;
  }
  for (const t of placed.tiles) hits.push({ target: { term: t.termId }, x: t.x, y: t.y, width: t.w + t.depth, height: t.h + t.depth });
  for (const l of line) hits.push({ target: { item: l.item }, x: l.x - 0.5, y: lineY - LINE_H / 2, width: l.w + 1, height: LINE_H });
  const fullWidth = width + 2 * MARGIN,
    fullHeight = height + 2 * MARGIN;
  if (fullWidth > MAX_WIDTH_MM + 0.01) issues.push(`The tiles are ${Math.round(fullWidth)} mm wide, over the ${MAX_WIDTH_MM} mm print width. Use fewer or shorter terms.`);
  for (const t of placed.tiles)
    if (d.labels && mathsWidth(t.label) > t.w - 1) {
      issues.push(`The label ${t.label} does not fit on its tile.`);
      break;
    }
  return { width: fullWidth, height: fullHeight, tiles: placed.tiles, pairs: ringPairs, frame, line, lineY, hits, issues };
}
export const exportIssue = (e: Envelope) => layout(e).issues[0] ?? null;

/* ---------- SVG ---------- */

const num = (v: number) => String(Math.round(v * 1000) / 1000);
const FILLS = {
  colour: { pos: "#fff0a0", neg: "#f4a3a3", posSide: "#e9d36a", negSide: "#dc7d7d" },
  plain: { pos: "#ffffff", neg: "#ffffff", posSide: "#dddddd", negSide: "#dddddd" },
};
/** 45° hatching clipped to a rectangle, computed (no pattern ids, so many diagrams can share a page). */
function hatch(x: number, y: number, w: number, h: number, ink: string) {
  const out: string[] = [],
    gap = 2;
  for (let c = gap; c < w + h; c += gap) {
    // Lines x + y' = c (y' measured down from the top), clipped to the rectangle.
    const x1 = x + Math.max(0, c - h),
      y1 = y + Math.min(h, c),
      x2 = x + Math.min(w, c),
      y2 = y + Math.max(0, c - w);
    out.push(`M${num(x1)} ${num(y1)}L${num(x2)} ${num(y2)}`);
  }
  return `<path d="${out.join("")}" fill="none" stroke="${ink}" stroke-width="0.2" stroke-opacity="0.55"/>`;
}
function tileSvg(t: Tile, d: TilesDocument): string {
  const answer = REVEALED.has(t.term),
    ink = answer ? ANSWER_COLOUR : "black",
    f = FILLS[d.fill],
    face = t.negative ? f.neg : f.pos,
    side = t.negative ? f.negSide : f.posSide;
  const out: string[] = [];
  // The front face sits at the bottom left; a block's top and side run back at 45°.
  const fx = t.x,
    fy = t.y + t.depth,
    k = t.depth;
  if (k > 0) {
    out.push(
      `<path d="M${num(fx)} ${num(fy)}L${num(fx + k)} ${num(fy - k)}H${num(fx + t.w + k)}L${num(fx + t.w)} ${num(fy)}Z" fill="${face}" stroke="${ink}" stroke-width="0.3" stroke-linejoin="round"/>`,
      `<path d="M${num(fx + t.w)} ${num(fy)}L${num(fx + t.w + k)} ${num(fy - k)}V${num(fy - k + t.h)}L${num(fx + t.w)} ${num(fy + t.h)}Z" fill="${side}" stroke="${ink}" stroke-width="0.3" stroke-linejoin="round"/>`,
    );
  }
  out.push(`<rect x="${num(fx)}" y="${num(fy)}" width="${num(t.w)}" height="${num(t.h)}" fill="${face}" stroke="${ink}" stroke-width="0.3"/>`);
  if (t.negative) out.push(hatch(fx, fy, t.w, t.h, ink));
  if (d.labels) {
    const cx = fx + t.w / 2,
      cy = fy + t.h / 2,
      lw = mathsWidth(t.label) + 1;
    if (t.negative) out.push(`<rect x="${num(cx - lw / 2)}" y="${num(cy - FONT * 0.62)}" width="${num(lw)}" height="${num(FONT * 1.24)}" fill="${face}"/>`);
    out.push(mathsMarkup(t.label, cx, cy, ink));
  }
  return out.join("");
}
const dotted = (x1: number, x2: number, y: number) =>
  `<line x1="${num(x1)}" y1="${num(y)}" x2="${num(x2)}" y2="${num(y)}" stroke="black" stroke-width="0.3" stroke-dasharray="0.3 0.9" stroke-linecap="round"/>`;

export function renderSvg(e: Envelope): string {
  const d = e.document,
    g = layout(e),
    out: string[] = [`<rect width="${num(g.width)}" height="${num(g.height)}" fill="white"/>`];
  if (g.frame) out.push(`<rect x="${num(g.frame.x)}" y="${num(g.frame.y)}" width="${num(g.frame.w)}" height="${num(g.frame.h)}" rx="1.5" fill="none" stroke="black" stroke-width="0.3" stroke-dasharray="2 1.5"/>`);
  for (const t of g.tiles) if (t.term.show === "show") out.push(tileSvg(t, d));
  const ringInk = REVEALED.has(d.letters) ? ANSWER_COLOUR : "black";
  for (const [p, n] of g.pairs) {
    if (p.term.show !== "show" || n.term.show !== "show") continue;
    const x = Math.min(p.x, n.x) - RING_PAD,
      y = p.y - RING_PAD,
      w = Math.max(p.w + p.depth, n.w + n.depth) + 2 * RING_PAD,
      h = n.y + n.h + n.depth - p.y + 2 * RING_PAD;
    out.push(`<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" rx="${num(Math.min(4, w / 2))}" fill="none" stroke="${ringInk}" stroke-width="0.4" stroke-dasharray="1.6 0.8"/>`);
  }
  for (const [i, l] of g.line.entries()) {
    if (i > 0 && l.v.show !== "omit" && g.line[i - 1].v.show !== "omit") out.push(mathsMarkup("=", l.x - EQUALS / 2, g.lineY));
    const p = printed(l.v);
    if (p) out.push(mathsMarkup(p, l.x + mathsWidth(p) / 2, g.lineY, REVEALED.has(l.v) ? ANSWER_COLOUR : "black"));
    else if (l.v.show !== "omit") out.push(dotted(l.x, l.x + l.blank, g.lineY + FONT * 0.4));
  }
  const shownTerms = d.terms.filter((t) => t.show === "show");
  const label = `Algebra tiles: ${shownTerms.length ? formatParts(partsOf({ ...d, terms: shownTerms }), d.letters) : "space to draw the tiles"}${d.arrangement === "grouped" ? ", like tiles grouped" : ""}`;
  return boldLines(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(g.width)}mm" height="${num(g.height)}mm" viewBox="0 0 ${num(g.width)} ${num(g.height)}" role="img" aria-label="${esc(label)}">${out.join("")}</svg>`,
    d.lines,
  );
}

/* ---------- Editor links ---------- */

export const MAX_LINK_LENGTH = 16_000;
export const LINK_PREFIX = "#algebra-tiles=";
export const linkHash = (e: Envelope) => LINK_PREFIX + toBase64Url(canonical(e));
export function editorLink(e: Envelope, base: string): string | null {
  const url = new URL(base);
  url.pathname = url.pathname.replace(/(\/tools(\/[^/]*)?)?\/?$/, "/") + "tools/algebra-tiles";
  url.search = "";
  url.hash = linkHash(e);
  return url.href.length <= MAX_LINK_LENGTH ? url.href : null;
}
export function decodeLinkHash(hashText: string): Envelope {
  if (!hashText.startsWith(LINK_PREFIX) || !/^[A-Za-z0-9_-]+$/.test(hashText.slice(LINK_PREFIX.length)) || hashText.length > MAX_LINK_LENGTH)
    throw Error("This is not a supported algebra tiles link. Open an editable file instead.");
  try {
    const binary = atob(hashText.slice(LINK_PREFIX.length).replaceAll("-", "+").replaceAll("_", "/"));
    return parseFile(new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
  } catch {
    throw Error("This algebra tiles link could not be read. Open an editable file instead.");
  }
}
