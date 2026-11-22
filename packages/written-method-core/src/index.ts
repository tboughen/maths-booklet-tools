/**
 * Written methods: the formal column and division layouts of the school's scheme (NP2.01 to NP2.04,
 * NP2.11, NP2.12, NP2.14 to NP2.16): column addition and subtraction (decimals lined up on the point),
 * long multiplication, short division (the bus stop) and long division, as pupils write them.
 *
 * Every digit sits in a place-value column. Every printed row is {text, show}: empty text is a pupil
 * blank (an empty row), and a hidden row keeps its saved answer: the pupil copy leaves the space and the
 * answers copy prints it in the answer colour. Small digits (carries, exchanges and the remainders of
 * short division) are marks on a row at a place, each with its own visibility. Nothing is worked out
 * unless the teacher asks (complete); rows that do not follow raise a teacher note, never a correction.
 */
import { z } from "zod";
import { sha256Hex, toBase64Url } from "../../envelope-core/src/index";
import { aboutShape } from "../../envelope-core/src/about";
import { boldLines, LINE_WEIGHTS } from "../../envelope-core/src/house-style";
import { FAMILY, FONT, esc, textWidth } from "../../function-machine-core/src/maths-text";

/** The renderer version every new written-method envelope carries. */
export const RENDERER_VERSION = "written-method-1" as const;

export const METHODS = ["add", "subtract", "multiply", "short-division", "long-division"] as const;
export type Method = (typeof METHODS)[number];
export const METHOD_NAMES: Record<Method, string> = {
  add: "Column addition",
  subtract: "Column subtraction",
  multiply: "Long multiplication",
  "short-division": "Short division",
  "long-division": "Long division",
};
export const MAX_DIGITS = 12;
export const MAX_ROWS = 16;
export const MAX_MARKS = 60;
export const MAX_PLACES = 6;
export const ANSWER_COLOUR = "#b0125b";

/** "omit" (Leave out, 22 Nov 2026) keeps the value but prints nothing in either copy. */
const show = z.enum(["show", "hidden", "omit"]);
export const valueSchema = z.object({ text: z.string().max(MAX_DIGITS + 2), show }).strict();
const id = z.string().regex(/^[a-z][a-z0-9-]{0,23}$/);
export const numberSchema = z.object({ id, value: valueSchema }).strict();
export const rowSchema = z
  .object({
    id,
    value: valueSchema,
    /** Place value of the row's last digit: 0 units, 1 tens, -1 tenths. */
    place: z.number().int().min(-MAX_PLACES).max(MAX_DIGITS),
    /** A long-division row to subtract (a line beneath it) or what is left (with the next digit brought down); a partial product in long multiplication. */
    kind: z.enum(["product", "subtract", "remainder"]),
  })
  .strict();
export const markSchema = z
  .object({
    /** The row the small digit belongs to: a number's ID, a working row's ID, "answer" or "extend". */
    row: id,
    place: z.number().int().min(-MAX_PLACES * 2).max(MAX_DIGITS + 1),
    text: z.string().regex(/^\d{1,2}$/),
    show,
    /** An exchange: the digit at this place is crossed out and this one written above it. */
    cross: z.literal(true).optional(),
  })
  .strict();
export const documentSchema = z
  .object({
    method: z.enum(METHODS),
    /** add: 2 to 4 numbers; subtract and multiply: 2; division: the dividend then the divisor. */
    numbers: z.array(numberSchema).min(2).max(4),
    /** Partial products (long multiplication) or the subtract and remainder rows of long division. */
    working: z.array(rowSchema).max(MAX_ROWS),
    /** The result under the line, or the quotient above the bus stop. */
    answer: valueSchema,
    /** Division only: the remainder printed as "r 3" after the quotient, or null for none. */
    remainder: valueSchema.nullable(),
    /** Division only: zeros the pupil writes after the dividend to keep dividing ("0", "00"). */
    extend: valueSchema,
    marks: z.array(markSchema).max(MAX_MARKS),
    /** Width and height of each digit's square at print size. */
    cellMm: z.number().min(5).max(10),
    /** An error-spotting task: rows that do not follow raise no teacher note. */
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
    kind: z.literal("written-method"),
    schemaVersion: z.literal(1),
    rendererVersion: z.literal(RENDERER_VERSION),
    document: documentSchema,
    ...aboutShape,
  })
  .strict();
export type Envelope = z.infer<typeof envelopeSchema>;
export type MethodDocument = Envelope["document"];
export type Value = MethodDocument["answer"];
export type Row = MethodDocument["working"][number];
export type Mark = MethodDocument["marks"][number];

export const value = (text = "", visibility: Value["show"] = "show"): Value => ({ text, show: visibility });
export const isDivision = (m: Method) => m === "short-division" || m === "long-division";
export const SIGNS: Partial<Record<Method, string>> = { add: "+", subtract: "−", multiply: "×" };

/* ---------- Numbers as place-value digits ---------- */

const DECIMAL = /^\d{1,12}(\.\d{1,6})?$/;
const WHOLE = /^\d{1,12}$/;
export type Digit = { d: string; place: number };
/** The digits of "54.6" with their places: 5 tens, 4 units, 6 tenths. */
export function digitsOf(text: string, last = 0): Digit[] {
  if (!text) return [];
  const [whole, frac = ""] = text.split(".");
  if (text.includes(".")) return [...whole].map((d, i) => ({ d, place: whole.length - 1 - i })).concat([...frac].map((d, i) => ({ d, place: -1 - i })));
  return [...text].map((d, i) => ({ d, place: last + text.length - 1 - i }));
}
const places = (text: string) => (text.includes(".") ? text.split(".")[1].length : 0);
/** Exact value as a whole number of 10^-scale. */
function scaled(text: string, scale: number): bigint {
  const [w, f = ""] = text.split(".");
  return BigInt(w + f.padEnd(scale, "0"));
}
function unscale(n: bigint, scale: number): string {
  const s = n.toString().padStart(scale + 1, "0");
  if (!scale) return s;
  const frac = s.slice(-scale).replace(/0+$/, "");
  return s.slice(0, -scale) + (frac ? "." + frac : "");
}

/* ---------- Validation ---------- */

export function rowValues(d: MethodDocument): Value[] {
  return [...d.numbers.map((n) => n.value), ...d.working.map((w) => w.value), d.answer, ...(d.remainder ? [d.remainder] : []), d.extend];
}
export function validate(input: unknown): Envelope {
  const parsed = envelopeSchema.safeParse(input);
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path ?? [];
    if (path.includes("marks")) throw Error(`Small digits are one or two digits, at most ${MAX_MARKS} of them.`);
    if (path.includes("working")) throw Error(`Use at most ${MAX_ROWS} working rows.`);
    if (path.includes("numbers")) throw Error("Use 2 to 4 numbers (division: the number to divide, then the number to divide by).");
    if (path.includes("text")) throw Error(`Use numbers of at most ${MAX_DIGITS} digits.`);
    if (path.includes("cellMm")) throw Error("Choose a column width from 5 to 10 mm.");
    throw Error("This is not a supported written method file (version 1 is supported).");
  }
  const e = parsed.data,
    d = e.document;
  const count = d.numbers.length;
  if (d.method !== "add" && count !== 2) throw Error(`${METHOD_NAMES[d.method]} uses two numbers.`);
  const ids = new Set<string>(["answer", "extend", "remainder"]);
  for (const r of [...d.numbers, ...d.working]) {
    if (ids.has(r.id)) throw Error(`The row ID ${r.id} appears twice.`);
    ids.add(r.id);
  }
  for (const v of rowValues(d)) {
    v.text = v.text.trim().replace(/[\s,]/g, "");
    if (!v.text && v.show === "hidden") throw Error("A blank row cannot hold a hidden answer. Enter the answer, then hide it.");
  }
  const decimalsAllowed = d.method === "add" || d.method === "subtract";
  d.numbers.forEach((n, i) => {
    const t = n.value.text;
    if (!t) return;
    const divisor = isDivision(d.method) && i === 1;
    if (divisor || d.method === "multiply" ? !WHOLE.test(t) : !DECIMAL.test(t))
      throw Error(
        divisor
          ? `"${t}": divide by a whole number. To divide by a decimal, multiply both numbers by 10, 100 or 1000 first (8.46 ÷ 0.15 = 846 ÷ 15).`
          : d.method === "multiply"
            ? `"${t}": long multiplication multiplies whole numbers. For decimals, multiply the whole numbers (546 × 43), then place the point.`
            : `"${t}": use a number such as 254 or 37.25.`,
      );
    if (!decimalsAllowed && !isDivision(d.method) && t.includes(".")) throw Error(`"${t}": use whole numbers.`);
  });
  for (const w of d.working) if (w.value.text && !WHOLE.test(w.value.text)) throw Error(`"${w.value.text}": a working row is digits only; its place sets where it sits.`);
  if (d.answer.text && !(d.method === "multiply" ? WHOLE : DECIMAL).test(d.answer.text)) throw Error(`"${d.answer.text}": write the answer as digits${d.method === "multiply" ? "" : " with at most one decimal point"}.`);
  if (d.remainder && !isDivision(d.method)) throw Error("Only a division has a remainder.");
  if (d.remainder?.text && !WHOLE.test(d.remainder.text)) throw Error(`"${d.remainder.text}": a remainder is a whole number.`);
  if (d.extend.text && (!isDivision(d.method) || !/^0{1,6}$/.test(d.extend.text))) throw Error("Only a division's number can be extended, with up to six zeros.");
  if (d.method === "subtract" && d.working.length) throw Error("Column addition and subtraction have no working rows.");
  if (d.method === "add" && d.working.length) throw Error("Column addition and subtraction have no working rows.");
  if (d.method === "short-division" && d.working.length) throw Error("Short division has no working rows; use long division for those.");
  for (const m of d.marks) if (!ids.has(m.row) || m.row === "remainder") throw Error(`A small digit belongs to a row that is not there (${m.row}).`);
  const seen = new Set<string>();
  for (const m of d.marks) {
    const k = `${m.row}@${m.place}`;
    if (seen.has(k)) throw Error("Two small digits are in the same place on one row.");
    seen.add(k);
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
export const hasHidden = (e: Envelope) => rowValues(e.document).some((v) => v.show === "hidden" && !!v.text) || e.document.marks.some((m) => m.show === "hidden");

/* ---------- Building ---------- */

/** A new layout for a method; the numbers are given, everything else is left for pupils. */
export function create(method: Method = "multiply", numbers: string[] = method === "add" || method === "subtract" ? ["", ""] : ["", ""]): Envelope {
  return validate({
    kind: "written-method",
    schemaVersion: 1,
    rendererVersion: RENDERER_VERSION,
    document: {
      method,
      numbers: numbers.map((t, i) => ({ id: `n${i + 1}`, value: value(t) })),
      working: [],
      answer: value(),
      remainder: null,
      extend: value(),
      marks: [],
      cellMm: 7,
      intentionalError: false,
    },
  });
}
const clone = (e: Envelope) => structuredClone(e);
/** Changes the method, keeping the numbers that still fit and clearing the working. */
export function setMethod(e: Envelope, method: Method): Envelope {
  const n = clone(e),
    d = n.document;
  d.method = method;
  if (method !== "add") d.numbers = d.numbers.slice(0, 2);
  d.working = [];
  d.marks = [];
  d.answer = value();
  d.remainder = null;
  d.extend = value();
  return validate(n);
}
export function rowValue(d: MethodDocument, rowId: string): Value | null {
  if (rowId === "answer") return d.answer;
  if (rowId === "extend") return d.extend;
  if (rowId === "remainder") return d.remainder;
  return d.numbers.find((x) => x.id === rowId)?.value ?? d.working.find((x) => x.id === rowId)?.value ?? null;
}
/** Sets a row's text and visibility. Hiding a blank row is refused: a blank has no answer to keep. */
export function setRow(e: Envelope, rowId: string, change: { text?: string; show?: Value["show"] }): Envelope {
  const n = clone(e),
    d = n.document;
  if (rowId === "remainder" && !d.remainder) d.remainder = value();
  const v = rowValue(d, rowId);
  if (!v) throw Error(`There is no row ${rowId}.`);
  if (change.text !== undefined) v.text = change.text.trim();
  if (!v.text && change.show === "hidden") throw Error("A blank row cannot hold a hidden answer. Enter the answer, then hide it.");
  // A blank row keeps a chosen state (show or left out); an emptied hidden row becomes a plain blank.
  v.show = change.show ?? (!v.text && v.show === "hidden" ? "show" : v.show);
  return validate(n);
}
export function setRemainder(e: Envelope, on: boolean): Envelope {
  const n = clone(e);
  if (!isDivision(n.document.method)) throw Error("Only a division has a remainder.");
  n.document.remainder = on ? (n.document.remainder ?? value()) : null;
  return validate(n);
}
function freshRowId(d: MethodDocument, prefix: string) {
  let i = 1;
  while (d.numbers.some((x) => x.id === `${prefix}${i}`) || d.working.some((x) => x.id === `${prefix}${i}`)) i++;
  return `${prefix}${i}`;
}
export function addNumber(e: Envelope, text = ""): Envelope {
  const n = clone(e),
    d = n.document;
  if (d.method !== "add") throw Error("Only column addition takes more than two numbers.");
  if (d.numbers.length >= 4) throw Error("Add at most four numbers.");
  d.numbers.push({ id: freshRowId(d, "n"), value: value(text) });
  return validate(n);
}
export function removeNumber(e: Envelope, rowId: string): Envelope {
  const n = clone(e),
    d = n.document;
  if (d.numbers.length <= 2) throw Error("A written method needs two numbers.");
  d.numbers = d.numbers.filter((x) => x.id !== rowId);
  d.marks = d.marks.filter((m) => m.row !== rowId);
  return validate(n);
}
/** Adds an empty working row at the end (long multiplication or long division). */
export function addRow(e: Envelope, kind?: Row["kind"], place = 0, text = ""): Envelope {
  const n = clone(e),
    d = n.document;
  if (d.method !== "multiply" && d.method !== "long-division") throw Error("Only long multiplication and long division have working rows.");
  if (d.working.length >= MAX_ROWS) throw Error(`Use at most ${MAX_ROWS} working rows.`);
  const k = kind ?? (d.method === "multiply" ? "product" : d.working.at(-1)?.kind === "subtract" ? "remainder" : "subtract");
  d.working.push({ id: freshRowId(d, "w"), value: value(text), place, kind: k });
  return validate(n);
}
export function removeRow(e: Envelope, rowId: string): Envelope {
  const n = clone(e),
    d = n.document;
  if (!d.working.some((w) => w.id === rowId)) throw Error(`There is no working row ${rowId}.`);
  d.working = d.working.filter((w) => w.id !== rowId);
  d.marks = d.marks.filter((m) => m.row !== rowId);
  return validate(n);
}
/** Moves a working row one column left (+1) or right (-1). */
export function shiftRow(e: Envelope, rowId: string, by: number): Envelope {
  const n = clone(e),
    w = n.document.working.find((x) => x.id === rowId);
  if (!w) throw Error(`There is no working row ${rowId}.`);
  w.place += by;
  for (const m of n.document.marks) if (m.row === rowId) m.place += by;
  return validate(n);
}
/** Sets, changes or (with null) removes the small digit on a row at a place. */
export function setMark(e: Envelope, rowId: string, place: number, change: { text?: string; show?: Value["show"]; cross?: boolean } | null): Envelope {
  const n = clone(e),
    d = n.document;
  const at = d.marks.findIndex((m) => m.row === rowId && m.place === place);
  if (change === null || change.text === "") {
    if (at >= 0) d.marks.splice(at, 1);
    return validate(n);
  }
  const mark: Mark = at >= 0 ? d.marks[at] : { row: rowId, place, text: change.text ?? "", show: "show" };
  if (change.text !== undefined) mark.text = change.text.trim();
  if (change.show !== undefined) mark.show = change.show;
  if (change.cross === true) mark.cross = true;
  else if (change.cross === false) delete mark.cross;
  if (at < 0) d.marks.push(mark);
  return validate(n);
}

/* ---------- Explicit completion ---------- */

type Fill = { answer?: string; remainder?: string | null; extend?: string; working?: { text: string; place: number; kind: Row["kind"] }[]; marks: { row: string; place: number; text: string; cross?: true }[] };

/** Column addition of any numbers, with the carries into each column. */
function addition(texts: string[], row: string): Fill {
  const scale = Math.max(...texts.map(places));
  const total = texts.reduce((a, t) => a + scaled(t, scale), 0n);
  const marks: Fill["marks"] = [];
  const cols = texts.map((t) => scaled(t, scale).toString());
  const width = Math.max(...cols.map((c) => c.length));
  let carry = 0;
  for (let i = 0; i < width; i++) {
    const sum = cols.reduce((a, c) => a + Number(c[c.length - 1 - i] ?? 0), carry);
    carry = Math.floor(sum / 10);
    if (carry && i < width - 1) marks.push({ row, place: i + 1 - scale, text: String(carry) });
  }
  return { answer: unscale(total, scale), marks };
}
/** Column subtraction by exchanging: crossed-out digits with their new value, and a small 1 before a digit given ten. */
function subtraction(a: string, b: string, top: string): Fill {
  const scale = Math.max(places(a), places(b));
  const A = scaled(a, scale),
    B = scaled(b, scale);
  if (A < B) throw Error(`${a} is smaller than ${b}: column subtraction takes the smaller number from the larger.`);
  const digits = [...A.toString()].reverse().map(Number);
  const lower = [...B.toString()].reverse().map(Number);
  const now = [...digits],
    changed = new Set<number>(),
    tens = new Set<number>();
  for (let i = 0; i < now.length; i++) {
    if (now[i] >= (lower[i] ?? 0)) continue;
    let j = i + 1;
    while (now[j] === 0) j++;
    now[j]--;
    changed.add(j);
    for (let k = j - 1; k > i; k--) {
      now[k] = 9;
      changed.add(k);
    }
    now[i] += 10;
    tens.add(i);
  }
  const marks: Fill["marks"] = [];
  // Places the top number does not write (5.2 − 3.75 has no hundredths digit) show their value above the column.
  const unwritten = (i: number) => i < scale - places(a);
  // A crossed digit shows its final value: lowered by an exchange, then given ten if that came later (1 → 0 → 10).
  for (const i of changed) marks.push({ row: top, place: i - scale, text: String(now[i]), cross: true });
  for (const i of tens) if (!changed.has(i)) marks.push(unwritten(i) ? { row: top, place: i - scale, text: String(now[i]), cross: true } : { row: top, place: i - scale, text: "1" });
  return { answer: unscale(A - B, scale), marks };
}
/** One digit times a number, with its carries, placed `shift` columns left. */
function timesDigit(top: string, digit: number, shift: number, row: string): { text: string; marks: Fill["marks"] } {
  const marks: Fill["marks"] = [];
  let carry = 0;
  const out: number[] = [];
  const ds = [...top].reverse().map(Number);
  ds.forEach((d, i) => {
    const p = d * digit + carry;
    out.push(p % 10);
    carry = Math.floor(p / 10);
    if (carry && i < ds.length - 1) marks.push({ row, place: i + 1 + shift, text: String(carry) });
  });
  if (carry) out.push(carry);
  const text = out.reverse().join("").replace(/^0+(?=\d)/, "") + "0".repeat(shift);
  return { text: text.replace(/^0+(?=\d)/, ""), marks };
}
function multiplication(d: MethodDocument): Fill {
  const [a, b] = d.numbers.map((n) => n.value.text);
  const bd = [...b].reverse().map(Number);
  if (bd.length === 1) {
    const r = timesDigit(a, bd[0], 0, "answer");
    return { answer: r.text, marks: r.marks };
  }
  const working: NonNullable<Fill["working"]> = [];
  const marks: Fill["marks"] = [];
  const rowIds = d.working.map((w) => w.id);
  bd.forEach((digit, k) => {
    if (!digit) return;
    const rowId = rowIds[working.length] ?? `w${working.length + 1}`;
    const r = timesDigit(a, digit, k, rowId);
    working.push({ text: r.text, place: 0, kind: "product" });
    marks.push(...r.marks);
  });
  const sum = addition(
    working.map((w) => w.text),
    "answer",
  );
  return { answer: sum.answer, working, marks: [...marks, ...sum.marks] };
}
/** Short or long division, digit by digit, with carried remainders or the subtract and bring-down rows. */
function division(d: MethodDocument, decimals: boolean): Fill {
  const dividend = d.numbers[0].value.text,
    divisor = BigInt(d.numbers[1].value.text);
  if (divisor === 0n) throw Error("You cannot divide by zero.");
  if (d.method === "short-division" && divisor >= 100n) throw Error("Use long division to divide by 100 or more: the carried remainders would not fit as small digits.");
  // Zeros the teacher has already written are kept as they are; only with none written does it keep dividing.
  const extending = decimals && !d.extend.text;
  const given = digitsOf(dividend).concat([...d.extend.text].map((z, i) => ({ d: z, place: -places(dividend) - 1 - i })));
  const long = d.method === "long-division";
  const marks: Fill["marks"] = [];
  const working: NonNullable<Fill["working"]> = [];
  const quotient: Digit[] = [];
  let extend = d.extend.text;
  let r = 0n,
    started = false,
    current: { text: string; place: number } | null = null;
  const digits = [...given];
  for (let i = 0; i < digits.length; i++) {
    const { d: dg, place } = digits[i];
    const cur = r * 10n + BigInt(dg);
    const q = cur / divisor;
    r = cur % divisor;
    if (long) {
      current = current ? { text: (BigInt(current.text) * 10n + BigInt(dg)).toString(), place } : { text: cur.toString(), place };
      if (q > 0n) {
        if (started && working.length) working.push({ text: current.text, place, kind: "remainder" });
        working.push({ text: (q * divisor).toString(), place, kind: "subtract" });
        current = { text: r.toString(), place };
      }
    }
    if (q > 0n || started || place <= 0) {
      quotient.push({ d: q.toString(), place });
      started = true;
    }
    // Stop at MAX_PLACES decimal places in all, and before long division runs out of working rows.
    const room = places(dividend) + extend.length < MAX_PLACES && (!long || working.length + 3 <= MAX_ROWS);
    if (i === digits.length - 1 && r > 0n && extending && room) {
      extend += "0";
      digits.push({ d: "0", place: place - 1 });
    }
    if (!long && r > 0n && i < digits.length - 1) marks.push({ row: digits[i + 1].place < -places(dividend) ? "extend" : "n1", place: digits[i + 1].place, text: r.toString() });
  }
  if (long && current && working.length) working.push({ text: current.text, place: current.place, kind: "remainder" });
  const minPlace = Math.min(...quotient.map((q) => q.place));
  let answer = quotient
    .filter((q) => q.place >= 0)
    .map((q) => q.d)
    .join("");
  if (minPlace < 0) answer += "." + quotient.filter((q) => q.place < 0).map((q) => q.d).join("");
  if (!answer || answer.startsWith(".")) answer = "0" + answer;
  if (long && working.length > MAX_ROWS) throw Error(`This long division needs more than ${MAX_ROWS} working rows. Use smaller numbers.`);
  // A remainder belongs to a whole-number answer: after the point the division simply stops.
  return { answer, remainder: r > 0n && minPlace >= 0 ? r.toString() : null, extend, working: long ? working : undefined, marks };
}

/**
 * Works the method out when the teacher asks: fills a blank answer (and remainder), the working rows
 * of long multiplication and long division when there are none (or fills blank ones in order), and
 * the small digits (carries, exchanges, carried remainders). Rows already entered never change, and
 * a small digit already in a place is kept. With `decimals`, a division that does not come out keeps
 * going with zeros after the point instead of stopping at a remainder. Filled items are hidden when
 * `hidden` is true.
 */
export function complete(e: Envelope, hidden = true, decimals = false): { envelope: Envelope; filled: number } {
  const n = clone(e),
    d = n.document;
  const texts = d.numbers.map((x) => x.value.text);
  if (texts.some((t) => !t)) throw Error("Enter every number first.");
  const visibility = hidden ? "hidden" : "show";
  const fill: Fill =
    d.method === "add"
      ? addition(texts, "answer")
      : d.method === "subtract"
        ? subtraction(texts[0], texts[1], d.numbers[0].id)
        : d.method === "multiply"
          ? multiplication(d)
          : division(d, decimals);
  let filled = 0;
  const put = (v: Value, text: string) => {
    if (v.text) return;
    v.text = text;
    // A left-out blank stays left out once filled.
    v.show = v.show === "omit" ? "omit" : visibility;
    filled++;
  };
  if (fill.extend !== undefined && fill.extend !== d.extend.text && !d.extend.text) put(d.extend, fill.extend);
  if (fill.working) {
    if (!d.working.length)
      for (const w of fill.working) {
        d.working.push({ id: freshRowId(d, "w"), value: value(w.text, visibility), place: w.place, kind: w.kind });
        filled++;
      }
    else if (d.working.length === fill.working.length)
      d.working.forEach((w, i) => {
        if (!w.value.text) {
          w.place = fill.working![i].place;
          put(w.value, fill.working![i].text);
        }
      });
  }
  // Working rows made here take the IDs w1, w2... that the marks were computed for.
  if (fill.answer !== undefined) put(d.answer, fill.answer);
  if (fill.remainder) {
    d.remainder ??= value();
    put(d.remainder, fill.remainder);
  }
  const ids = new Set([...d.numbers.map((x) => x.id), ...d.working.map((x) => x.id), "answer", "extend"]);
  for (const m of fill.marks) {
    if (!ids.has(m.row) || d.marks.some((x) => x.row === m.row && x.place === m.place) || d.marks.length >= MAX_MARKS) continue;
    // The small digits of a left-out row are left out with it.
    const row = rowValue(d, m.row);
    d.marks.push({ row: m.row, place: m.place, text: m.text, show: row?.show === "omit" ? "omit" : visibility, ...(m.cross ? { cross: true as const } : {}) });
    filled++;
  }
  return { envelope: validate(n), filled };
}

/* ---------- Teacher warnings ---------- */

export function warnings(e: Envelope): string[] {
  const d = e.document;
  if (d.intentionalError) return [];
  const texts = d.numbers.map((x) => x.value.text);
  if (texts.some((t) => !t)) return [];
  let fill: Fill;
  try {
    fill = d.method === "add" ? addition(texts, "answer") : d.method === "subtract" ? subtraction(texts[0], texts[1], "n1") : d.method === "multiply" ? multiplication(d) : division(d, false);
  } catch (err) {
    return [err instanceof Error ? err.message : String(err)];
  }
  const out: string[] = [];
  const sign = { add: " + ", subtract: " − ", multiply: " × ", "short-division": " ÷ ", "long-division": " ÷ " }[d.method];
  const sum = texts.join(sign);
  const same = (a: string, b: string) => (a.includes(".") || b.includes(".") ? Number(a) === Number(b) : a.replace(/^0+(?=\d)/, "") === b.replace(/^0+(?=\d)/, ""));
  if (d.answer.text && fill.answer && !same(d.answer.text, fill.answer)) out.push(`${sum} is ${fill.answer}${fill.remainder && !d.extend.text ? ` r ${fill.remainder}` : ""}, not ${d.answer.text}.`);
  if (isDivision(d.method) && d.remainder?.text && d.remainder.text !== (fill.remainder ?? "0") && !d.extend.text) out.push(`The remainder of ${sum} is ${fill.remainder ?? "0"}, not ${d.remainder.text}.`);
  // A working row's value is its digits in their columns: "2184" one column left is 21840.
  const atPlace = (text: string, place: number) => (place > 0 ? text + "0".repeat(place) : text);
  if ((d.method === "multiply" || d.method === "long-division") && fill.working && d.working.length === fill.working.length)
    d.working.forEach((w, i) => {
      const want = fill.working![i];
      if (!w.value.text || !/^\d+$/.test(w.value.text)) return;
      const ok = d.method === "multiply" ? same(atPlace(w.value.text, w.place), atPlace(want.text, want.place)) : same(w.value.text, want.text) && w.place === want.place;
      if (!ok) out.push(`Working row ${i + 1} should be ${want.text}${d.method === "long-division" && same(w.value.text, want.text) ? ", ending under the digit it was worked from" : ""}, not ${w.value.text}${d.method === "multiply" && w.place ? ` moved ${w.place} column${w.place === 1 ? "" : "s"} left` : ""}.`);
    });
  return out;
}

/* ---------- Views ---------- */

const REVEALED = new WeakSet<object>();
/** The answers copy prints hidden rows and small digits; with `mark` they print in the answer colour. */
export function forView(e: Envelope, view: "pupil" | "answer", mark = false): Envelope {
  if (view === "pupil") return e;
  const n = clone(e);
  for (const v of [...rowValues(n.document), ...n.document.marks]) {
    // A left-out row or small digit stays out of the teacher copy too.
    if (v.show === "omit") continue;
    if (mark && v.show === "hidden" && ("place" in v || v.text)) REVEALED.add(v);
    v.show = "show";
  }
  return n;
}

/* ---------- Layout ---------- */

const MARGIN = 1;
const SMALL = FONT * 0.8;
const MAX_WIDTH_MM = 180;
export type Hit = { row: string; x: number; y: number; width: number; height: number };
type Cell = { d: string; place: number; y: number; ink: string; struck?: boolean };
type Small = { text: string; place: number; y: number; before: boolean; ink: string };
type Line = { x1: number; x2: number; y: number };

const printed = (v: Value) => (v.show === "show" ? v.text : "");
const ink = (o: object) => (REVEALED.has(o) ? ANSWER_COLOUR : "black");

export function layout(e: Envelope) {
  const d = e.document,
    c = d.cellMm,
    band = c * 0.5,
    issues: string[] = [];
  const div = isDivision(d.method);
  const dividend = d.numbers[0].value;
  // Every row's places, from every row's text (hidden too), so both copies keep the same columns.
  const all: Digit[] = [];
  const numberDigits = d.numbers.map((n, i) => (div && i === 1 ? [] : digitsOf(n.value.text)));
  numberDigits.forEach((x) => all.push(...x));
  const extendDigits = [...d.extend.text].map((z, i) => ({ d: z, place: -places(dividend.text) - 1 - i }));
  all.push(...extendDigits);
  const workDigits = d.working.map((w) => digitsOf(w.value.text, w.place));
  workDigits.forEach((x) => all.push(...x));
  const answerDigits = digitsOf(d.answer.text);
  all.push(...answerDigits);
  // Room for an answer still to be written: one column more than the numbers (addition), or both lengths (multiplication).
  const lengths = d.numbers.map((n) => n.value.text.split(".")[0].length || 1);
  const reserve = d.method === "add" ? Math.max(...lengths) : d.method === "multiply" ? lengths[0] + (lengths[1] ?? 1) - 1 : Math.max(...lengths) - 1;
  const maxPlace = Math.max(0, reserve, ...all.map((x) => x.place));
  const minPlace = Math.min(0, ...all.map((x) => x.place));
  const divisorText = div ? d.numbers[1].value.text || "00" : "";
  const lead = div ? textWidth(divisorText) + 4 : c;
  const left = MARGIN + lead;
  const colX = (p: number) => left + (maxPlace - p) * c;
  const right = colX(minPlace) + c;
  const cells: Cell[] = [],
    smalls: Small[] = [],
    lines: Line[] = [],
    hits: Hit[] = [],
    labels: { text: string; x: number; y: number; ink: string; anchor: "start" | "end" | "middle" }[] = [],
    points: { x: number; y: number; ink: string }[] = [];
  let y = MARGIN;
  const markOf = (row: string) => d.marks.filter((m) => m.row === row);
  const crossed = (row: string) => new Set(markOf(row).filter((m) => m.cross && m.show === "show").map((m) => m.place));
  const putRow = (row: string, v: Value, digits: Digit[], top: number, struck = new Set<number>()) => {
    const shown = printed(v);
    if (shown) {
      for (const dg of digits) cells.push({ d: dg.d, place: dg.place, y: top, ink: ink(v), struck: struck.has(dg.place) });
      if (v.text.includes(".") || (row === "n1" && div && extendDigits.length && printed(d.extend))) points.push({ x: colX(0) + c, y: top + c * 0.68, ink: ink(v) });
    }
    const span = digits.length ? { from: Math.max(...digits.map((x) => x.place)), to: Math.min(...digits.map((x) => x.place)) } : { from: maxPlace, to: minPlace };
    hits.push({ row, x: colX(span.from), y: top, width: colX(span.to) + c - colX(span.from), height: c });
  };
  /** Small digits of a result row sit in the band above it; those of a number sit before the digit. */
  const putMarks = (row: string, rowTop: number, before: boolean) => {
    for (const m of markOf(row)) {
      if (m.show !== "show") continue;
      if (m.cross) smalls.push({ text: m.text, place: m.place, y: rowTop - band * 0.2, before: false, ink: ink(m) });
      else smalls.push({ text: m.text, place: m.place, y: before ? rowTop + c * 0.42 : rowTop - band * 0.2, before, ink: ink(m) });
    }
  };
  if (!div) {
    const sign = SIGNS[d.method]!;
    if (d.method === "subtract") y += band;
    d.numbers.forEach((n, i) => {
      putRow(n.id, n.value, numberDigits[i], y, crossed(n.id));
      putMarks(n.id, y, true);
      if (i === d.numbers.length - 1) labels.push({ text: sign, x: colX(maxPlace) - c / 2, y: y + c * 0.68, ink: "black", anchor: "middle" });
      y += c;
    });
    const rule = () => {
      lines.push({ x1: colX(maxPlace) - c, x2: right, y: y + 0.4 });
      y += 0.8;
    };
    if (d.method === "multiply") {
      rule();
      d.working.forEach((w, i) => {
        y += band;
        putMarks(w.id, y, false);
        putRow(w.id, w.value, workDigits[i], y);
        y += c;
      });
      if (d.working.length) {
        y += band;
        putMarks("answer", y, false);
        rule();
      } else {
        y += band;
        putMarks("answer", y, false);
      }
    } else {
      y += band;
      putMarks("answer", y, false);
      rule();
    }
    putRow("answer", d.answer, answerDigits, y);
    y += c;
    lines.push({ x1: colX(maxPlace) - c, x2: right, y: y + 0.4 });
    y += 1;
  } else {
    // The quotient above the bus stop, the dividend under it, the divisor outside.
    putRow("answer", d.answer, answerDigits, y);
    const quotientEnd = answerDigits.length ? colX(Math.min(...answerDigits.map((x) => x.place))) + c : colX(minPlace) + c;
    if (d.remainder) {
      const rem = printed(d.remainder);
      const x = Math.max(quotientEnd, right) + 1.5;
      if (rem) labels.push({ text: `r ${rem}`, x, y: y + c * 0.68, ink: ink(d.remainder), anchor: "start" });
      hits.push({ row: "remainder", x, y, width: Math.max(10, textWidth(`r ${d.remainder.text || "00"}`) + 2), height: c });
    }
    y += c;
    const top = y + 0.4;
    y += 0.8;
    const bracketTop = top;
    putRow("n1", dividend, numberDigits[0], y, crossed("n1"));
    putMarks("n1", y, true);
    if (extendDigits.length) {
      if (printed(d.extend)) for (const z of extendDigits) cells.push({ d: z.d, place: z.place, y, ink: ink(d.extend) });
      if (printed(d.extend) && !dividend.text.includes(".")) points.push({ x: colX(0) + c, y: y + c * 0.68, ink: ink(d.extend) });
      putMarks("extend", y, true);
      hits.push({ row: "extend", x: colX(extendDigits[0].place), y, width: extendDigits.length * c, height: c });
    } else hits.push({ row: "extend", x: right - 1, y, width: c, height: c });
    lines.push({ x1: colX(maxPlace) - 0.6, x2: right, y: bracketTop });
    labels.push({ text: printed(d.numbers[1].value), x: colX(maxPlace) - 2.6, y: y + c * 0.68, ink: ink(d.numbers[1].value), anchor: "end" });
    hits.push({ row: "n2", x: MARGIN, y, width: lead - 2, height: c });
    const bracket = { x: colX(maxPlace) - 0.6, top: bracketTop, bottom: y + c };
    y += c;
    d.working.forEach((w, i) => {
      putRow(w.id, w.value, workDigits[i], y);
      y += c;
      if (w.kind === "subtract") {
        const ds = workDigits[i];
        const from = ds.length ? Math.max(...ds.map((x) => x.place)) : maxPlace,
          to = ds.length ? Math.min(...ds.map((x) => x.place)) : minPlace;
        lines.push({ x1: colX(from) - 0.5, x2: colX(to) + c + 0.5, y: y + 0.2 });
        y += 0.8;
      }
    });
    y += 1;
    return finish({ bracket });
  }
  return finish({});
  function finish(extra: { bracket?: { x: number; top: number; bottom: number } }) {
    let width = right + MARGIN;
    for (const l of labels) if (l.anchor === "start") width = Math.max(width, l.x + textWidth(l.text) + MARGIN);
    for (const h of hits) width = Math.max(width, h.x + h.width + MARGIN);
    const height = y + MARGIN;
    const outside = d.marks.find((m) => m.place > maxPlace + 1 || m.place < minPlace);
    if (outside) issues.push(`A small digit on row ${outside.row} is outside the method's columns. Remove it in the row's small digits.`);
    if (width > MAX_WIDTH_MM) issues.push(`The method is ${Math.round(width)} mm wide, over the ${MAX_WIDTH_MM} mm print width. Use narrower columns or fewer digits.`);
    return { width, height, cell: c, colX, cells, smalls, lines, labels, points, hits, issues, maxPlace, minPlace, ...extra };
  }
}
export const exportIssue = (e: Envelope) => layout(e).issues[0] ?? null;

/* ---------- SVG ---------- */

const num = (v: number) => String(Math.round(v * 1000) / 1000);
const text = (t: string, x: number, y: number, fill: string, size = FONT, anchor = "middle") =>
  `<text x="${num(x)}" y="${num(y)}" text-anchor="${anchor}" font-family="${FAMILY}" font-size="${num(size)}" fill="${fill}">${esc(t)}</text>`;

export function renderSvg(e: Envelope): string {
  const d = e.document,
    g = layout(e),
    c = g.cell,
    out: string[] = [`<rect width="${num(g.width)}" height="${num(g.height)}" fill="white"/>`];
  for (const cell of g.cells) {
    const cx = g.colX(cell.place) + c / 2,
      base = cell.y + c * 0.68;
    out.push(text(cell.d, cx, base, cell.ink));
    if (cell.struck) out.push(`<line x1="${num(cx - c * 0.28)}" y1="${num(base + 0.4)}" x2="${num(cx + c * 0.28)}" y2="${num(base - FONT * 0.75)}" stroke="black" stroke-width="0.3"/>`);
  }
  for (const s of g.smalls) {
    // A carried digit ends just left of the digit it belongs to (a digit is about half the type size wide).
    const x = s.before ? g.colX(s.place) + c / 2 - FONT * 0.27 : g.colX(s.place) + c / 2;
    out.push(text(s.text, x, s.y, s.ink, SMALL, s.before ? "end" : "middle"));
  }
  for (const p of g.points) out.push(`<circle cx="${num(p.x)}" cy="${num(p.y - 0.15)}" r="0.42" fill="${p.ink}"/>`);
  for (const l of g.lines) out.push(`<line x1="${num(l.x1)}" y1="${num(l.y)}" x2="${num(l.x2)}" y2="${num(l.y)}" stroke="black" stroke-width="0.3"/>`);
  if (g.bracket) {
    const b = g.bracket;
    out.push(`<path d="M${num(b.x)} ${num(b.top)}Q${num(b.x + 1.6)} ${num((b.top + b.bottom) / 2)} ${num(b.x - 0.4)} ${num(b.bottom)}" fill="none" stroke="black" stroke-width="0.3"/>`);
  }
  for (const l of g.labels) out.push(text(l.text, l.x, l.y, l.ink, FONT, l.anchor));
  const shown = d.numbers.map((n) => printed(n.value) || "a blank").join(isDivision(d.method) ? " ÷ " : ` ${SIGNS[d.method]} `);
  const label = `${METHOD_NAMES[d.method]}: ${shown}`;
  return boldLines(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(g.width)}mm" height="${num(g.height)}mm" viewBox="0 0 ${num(g.width)} ${num(g.height)}" role="img" aria-label="${esc(label)}">${out.join("")}</svg>`,
    d.lines,
  );
}

/* ---------- Editor links ---------- */

export const MAX_LINK_LENGTH = 16_000;
export const LINK_PREFIX = "#written-method=";
export const linkHash = (e: Envelope) => LINK_PREFIX + toBase64Url(canonical(e));
export function editorLink(e: Envelope, base: string): string | null {
  const url = new URL(base);
  url.pathname = url.pathname.replace(/(\/tools(\/[^/]*)?)?\/?$/, "/") + "tools/written-method";
  url.search = "";
  url.hash = linkHash(e);
  return url.href.length <= MAX_LINK_LENGTH ? url.href : null;
}
export function decodeLinkHash(hashText: string): Envelope {
  if (!hashText.startsWith(LINK_PREFIX) || !/^[A-Za-z0-9_-]+$/.test(hashText.slice(LINK_PREFIX.length)) || hashText.length > MAX_LINK_LENGTH)
    throw Error("This is not a supported written method link. Open an editable file instead.");
  try {
    const binary = atob(hashText.slice(LINK_PREFIX.length).replaceAll("-", "+").replaceAll("_", "/"));
    return parseFile(new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (ch) => ch.charCodeAt(0))));
  } catch {
    throw Error("This written method link could not be read. Open an editable file instead.");
  }
}
