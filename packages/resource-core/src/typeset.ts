/**
 * Maths typesetting for question text (worksheet and booklet `notation: "maths"`).
 *
 * A teacher or a model types maths with an ordinary keyboard: x^2, -3, <=, sqrt 16, pi, 3 x 4.
 * With typesetting on, that text prints as a maths paper prints it: x², −3, ≤, √16, π, 3 × 4, and
 * lower-case letters used as maths (x, 2n + 1, f(x)) in italic. It is a pure rewrite of the text
 * into characters and markup the renderers already print ({3/4} fractions and *italic*), so the
 * SVG pages, PDF and Word file all print the same thing, and nothing is calculated or changed in
 * the saved file: only the printed copy is typeset.
 *
 * The rules are deliberately cautious. Prose stays as typed: hyphenated words, ranges (3-5),
 * point labels (A, ABC), units after a number (5 m, 3 cm), ordinals (2nd), part labels ((a)) and
 * function names (sin) stay upright. A power other than 2 or 3 keeps its caret (x^4), because
 * Inter holds no other superscript digits.
 */
import { FRACTION } from "./text";
import { advance } from "./metrics";

const OPERATOR = "=+−×÷<>≤≥≠±";
const OPERATOR_TOKEN = new RegExp(`^[${OPERATOR}]$`);
/** Letter runs that stay upright inside a maths token: function names, units, ordinals and times. */
const UPRIGHT = new Set(["sin", "cos", "tan", "log", "ln", "exp", "min", "max", "mm", "cm", "km", "kg", "mg", "ml", "cl", "mph", "st", "nd", "rd", "th", "am", "pm"]);

/** Short English words that can sit beside an operator in prose ("x = 3 or 4") and stay upright. */
const WORDS = new Set(["an", "as", "at", "be", "by", "do", "if", "in", "is", "it", "of", "on", "or", "so", "to", "up", "we", "and", "are", "but", "can", "for", "has", "its", "not", "the", "was", "who", "why", "how", "all", "any", "one", "two", "six", "ten"]);

/** Character rewrites that are safe anywhere printed text appears, fractions and bold included. */
export function typesetSymbols(s: string): string {
  return (
    s
      .replace(/<=/g, "≤")
      .replace(/>=/g, "≥")
      .replace(/!=/g, "≠")
      .replace(/\+\/-|\+-(?=\s|\d)/g, "±")
      .replace(/\bsqrt\s*(?=[\d(a-zπ])/g, "√")
      .replace(/(?<![A-Za-z])pi(?![A-Za-z-])/g, "π")
      .replace(/\^\(?2\)?(?!\d)/g, "²")
      .replace(/\^\(?3\)?(?!\d)/g, "³")
      // 3 x 4: a lone x between two numbers is a times sign.
      .replace(/(\d) x (?=\d)/g, "$1 × ")
      // A sign: at the start, after a space, a bracket, a slash or an operator, before a number,
      // a bracket, a root, π or a short letter run (-x, -ab). Not inside words (well-known).
      .replace(new RegExp(`(^|[\\s([{/${OPERATOR}])-(?=[\\d.(√π{]|[a-z]{1,2}(?![a-z]))`, "g"), "$1−")
      // A spaced binary minus between maths atoms: 7 - 3, x - 2, (x + 1) - 4.
      .replace(/(\d|\)|\}|[²³]|(?<![A-Za-z])[a-z]) - (?=[\d(√π{−]|[a-z](?![a-z]))/g, "$1 − ")
      // An unspaced minus after a letter or bracket: x-3, 2x-1, (x+1)-y. A digit-digit hyphen is a range.
      .replace(/((?<![A-Za-z])[a-z]|\)|\}|[²³])-(?=\d|\(|\{|[a-z](?![a-z]))/g, "$1−")
  );
}

/** Italic markup for the maths letters in one stretch of plain text (no markup or fractions in it). */
function italicLetters(s: string): string {
  const tokens = s.split(/(\s+)/);
  const words = tokens.map((t, i) => ({ t, i })).filter((w) => w.t && !/^\s+$/.test(w.t));
  const out = [...tokens];
  words.forEach((w, k) => {
    const prev = words[k - 1]?.t ?? "";
    const next = words[k + 1]?.t ?? "";
    const m = w.t.match(/^([([]*)(.*?)([.,;:?!)\]]*)$/)!;
    const [, lead, core, tail] = m;
    if (!core) return;
    const byOperator = OPERATOR_TOKEN.test(prev) || OPERATOR_TOKEN.test(next);
    // Part labels such as (a) and (ii) stay upright.
    if (lead === "(" && tail.startsWith(")") && /^([a-z]|[ivx]+)$/.test(core) && !byOperator) return;
    // x-axis, y-coordinate, x-value: the letter is maths.
    const axis = core.match(/^([a-z])-(axis|axes|coordinate|coordinates|value|values|intercept)$/);
    if (axis) {
      out[w.i] = `${lead}*${axis[1]}*-${axis[2]}${tail}`;
      return;
    }
    // A short product of letters beside an operator (mx ± c, ab = 6) is maths; a short word is not.
    if (/^[a-z]{2,3}$/.test(core) && byOperator && !WORDS.has(core) && !UPRIGHT.has(core)) {
      out[w.i] = `${lead}*${core}*${tail}`;
      return;
    }
    if (/^[a-z]$/.test(core)) {
      // A unit after a number (5 m, 3 g) stays upright; so does the word "a" unless it is maths (a = 3).
      const afterNumber = /^[−-]?[\d.,]+%?$/.test(prev);
      // A part or option named in prose (part b, Option c) is a label.
      const named = /^(part|option)$/i.test(prev);
      if ((core === "a" && !byOperator) || afterNumber || named) return;
      out[w.i] = `${lead}*${core}*${tail}`;
      return;
    }
    // A question or paper label (Q3a, A4) is not maths.
    if (/^[A-Z]+\d/.test(core)) return;
    const mathsy = /\d/.test(core) || new RegExp(`[${OPERATOR}²³√π^]`).test(core) || /[a-z]\(/.test(core);
    if (!mathsy) return;
    const body = core.replace(/[a-z]+/g, (run, at: number, whole: string) => {
      if (run.length > 3 || UPRIGHT.has(run)) return run;
      // Joined to a capital or a longer word (Q3a, 3D): leave it.
      if (/[A-Z]/.test(whole[at - 1] ?? "") || /[A-Z]/.test(whole[at + run.length] ?? "")) return run;
      return `*${run}*`;
    });
    out[w.i] = `${lead}${body}${tail}`;
  });
  return out.join("");
}

/** Markup segments (**bold**, *italic*) and fractions: their letters are left as they are. */
const PROTECTED = new RegExp(`(\\*\\*.+?\\*\\*|\\*.+?\\*|${FRACTION.source})`, "g");

/** Web addresses print exactly as typed. */
const ADDRESS = /(?:https?:\/\/|www\.)\S+/g;

/** One printed string typeset: symbols everywhere, italic maths letters outside markup and fractions. */
export function typesetText(source: string, italic = true): string {
  let out = "";
  let at = 0;
  for (const m of source.matchAll(ADDRESS)) {
    out += typesetPlain(source.slice(at, m.index), italic) + m[0];
    at = m.index + m[0].length;
  }
  return out + typesetPlain(source.slice(at), italic);
}

function typesetPlain(source: string, italic: boolean): string {
  const s = typesetSymbols(source);
  if (!italic) return s;
  let out = "";
  let at = 0;
  for (const m of s.matchAll(PROTECTED)) {
    out += italicLetters(s.slice(at, m.index)) + m[0];
    at = m.index + m[0].length;
  }
  return out + italicLetters(s.slice(at));
}

/** A no-break space: Word and the page layout both keep the words either side of it on one line. */
export const NBSP = "\u00a0";
/** What a token prints, without its markup: "*x*" is x, "{1/2}" is 1/2. */
const visible = (t: string) => t.replace(/\*/g, "").replace(/[{}]/g, "");
/** A number as printed: −3, 2.5, 40%, {1/2}, 2{1/2}, *x*-free. Trailing punctuation allowed. */
const NUMBER = /^[(]?[−-]?(\d+([.,]\d+)?%?|\d*\{[^{}/]+\/[^{}/]+\})[)]?[²³]?[.,;:?!]*$/;
const UNIT = /^(mm|cm|m|km|g|kg|mg|ml|cl|l|litres?|s|mins?|hours?|days?|weeks?|years?|°C?|%|p|pence|£)[.,;:?!)]*$/;
/** A maths operator token, spaced on both sides in typed text. */
const OPERATOR_SPACED = new RegExp(`^[${OPERATOR}]$`);
/** A short maths operand: a number, a maths letter or a short term such as 2*x* or *x*². */
const operand = (t: string) => visible(t).length <= 8 && (NUMBER.test(t) || /^[(]?[−-]?\d*(\*[a-z]{1,3}\*)+[²³]?[)]?[.,;:?!]*$/.test(t) || /^[(]?\d*[a-z][²³]?[)]?[.,;:?!]*$/.test(visible(t)) && t.includes("*"));
/** A glued run never grows past this many printed characters, nor past GLUE_MAX_MM at body size. */
const GLUE_MAX = 24;
/**
 * The narrowest flowing text on a sheet is about 51 mm (steps inside a part in a half-width
 * booklet card), so a glued run stays under 44 mm, measured in bold (the widest style) at 11 pt.
 */
const GLUE_MAX_MM = 44;
const BODY_MM = 11 * (25.4 / 72);
const runMm = (t: string) => [...visible(t)].reduce((w, c) => w + advance(c, "bold"), 0) * BODY_MM;

/**
 * Line breaks that read badly are prevented with no-break spaces (Tim, A7 marking, 15 Nov 2026):
 * - the last word of a paragraph never sits alone on a new line when it is a number or a short
 *   word ("… gradient of the line is" / "−2." is not allowed);
 * - a range stays together: "−1 to 1", "3 to 5";
 * - a number keeps its unit: "5 cm", "40 %";
 * - a short equation or expression stays on one line: "y = 2*x* + 1", "*x* = 3".
 * Each glued run is at most 24 printed characters, so it still fits the narrowest card.
 */
export function keepTogether(source: string): string {
  if (source.includes("\n")) return source.split("\n").map(keepTogether).join("\n");
  // Leading and trailing spaces stay; repeated spaces inside print as one anyway.
  const [, lead, core, trail] = source.match(/^( *)(.*?)( *)$/s)!;
  if (lead || trail || / {2}/.test(core)) return lead + keepTogether(core.replace(/ {2,}/g, " ")) + trail;
  const words = source.split(" ");
  if (words.length < 2) return source;
  const glue = new Array<boolean>(words.length - 1).fill(false);
  // Ranges and units.
  for (let i = 0; i < words.length - 1; i++) {
    const [a, b, c] = [words[i], words[i + 1], words[i + 2]];
    if (NUMBER.test(a) && b === "to" && c !== undefined && NUMBER.test(c)) glue[i] = glue[i + 1] = true;
    if (/^[−-]?\d+([.,]\d+)?$/.test(a) && b !== undefined && UNIT.test(b)) glue[i] = true;
  }
  // Short equations and expressions: operand (operator operand)+.
  for (let i = 0; i < words.length; i++) {
    if (!operand(words[i])) continue;
    let j = i;
    while (j + 2 < words.length && OPERATOR_SPACED.test(visible(words[j + 1])) && operand(words[j + 2])) j += 2;
    if (j === i) continue;
    const length = words.slice(i, j + 1).reduce((t, w) => t + visible(w).length + 1, -1);
    if (length <= GLUE_MAX) for (let k = i; k < j; k++) glue[k] = true;
    i = j;
  }
  // The last word: a number or a short word never starts a line on its own.
  const last = visible(words[words.length - 1]).replace(/[.,;:?!)"”’]+$/, "");
  const lastGlue = !!words[words.length - 1] && (NUMBER.test(words[words.length - 1]) || last.length <= 3);
  if (lastGlue) glue[words.length - 2] = true;
  // A glued run too long to fit the narrowest card is not glued at all (a half-glued equation
  // could leave its last number alone); only the last-word rule is kept, when that pair fits.
  const fits = (a: number, b: number) => {
    const joined = words.slice(a, b + 1).join(" ");
    return visible(joined).length <= GLUE_MAX && runMm(joined) <= GLUE_MAX_MM;
  };
  for (let i = 0; i < glue.length; ) {
    if (!glue[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < glue.length && glue[j]) j++;
    // Words i to j are one run.
    if (!fits(i, j)) {
      for (let k = i; k < j; k++) glue[k] = false;
      if (lastGlue && j === words.length - 1 && fits(j - 1, j)) glue[j - 1] = true;
    }
    i = j;
  }
  let out = words[0];
  for (let i = 1; i < words.length; i++) out += (glue[i - 1] ? NBSP : " ") + words[i];
  return out;
}

/** Printed keys whose text takes italic maths letters, and those that print in bold (symbols only). */
const BODY = new Set(["text", "prefix", "suffix", "answer", "before", "items", "options", "objective", "instruction", "keyIdea", "coverNote", "meaning", "remember", "learn", "next", "columns"]);
/** Printed keys that wrap as paragraphs; answer lines, options, cells and headings stay as typed. */
const FLOWING = new Set(["text", "items", "objective", "instruction", "keyIdea", "coverNote", "meaning", "remember", "learn", "next"]);
const HEADINGS = new Set(["title", "heading", "label", "word"]);

function typesetValue(v: unknown, key: string, maths = true): unknown {
  if (typeof v === "string") {
    if (!maths) return FLOWING.has(key) ? keepTogether(v) : v;
    return BODY.has(key) ? (FLOWING.has(key) ? keepTogether(typesetText(v)) : typesetText(v)) : HEADINGS.has(key) ? typesetText(v, false) : v;
  }
  if (Array.isArray(v)) return v.map((x) => typesetValue(x, key, maths));
  if (v && typeof v === "object") {
    // A table cell ({text, state}) prints on one line, as typed.
    const cell = "state" in v;
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "diagram" || k === "working" || k === "teacherNotes" ? x : typesetValue(x, cell && k === "text" ? "answer" : k, maths)]));
  }
  return v;
}

/** Printed copies already typeset, so a renderer that calls another does not typeset twice. */
const printed = new WeakSet<object>();

/**
 * The copy of a worksheet or booklet the renderers print: with maths notation, its printed text
 * typeset. In every document, flowing text keeps short last words, ranges and short equations on
 * one line (keepTogether). The saved document is never changed.
 */
export function typesetForPrint<T extends { document: { notation?: string } }>(resource: T): T {
  if (printed.has(resource)) return resource;
  // Plain text is printed as typed, except that its line breaks never read badly (keepTogether).
  const copy = { ...resource, document: typesetValue(resource.document, "", resource.document.notation === "maths") as T["document"] };
  printed.add(copy);
  return copy;
}
