/**
 * Maths typesetting for question text (worksheet and booklet `notation: "typeset"`).
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

const OPERATOR = "=+−×÷<>≤≥≠±";
const OPERATOR_TOKEN = new RegExp(`^[${OPERATOR}]$`);
/** Letter runs that stay upright inside a maths token: function names, units, ordinals and times. */
const UPRIGHT = new Set(["sin", "cos", "tan", "log", "ln", "exp", "min", "max", "mm", "cm", "km", "kg", "mg", "ml", "cl", "mph", "st", "nd", "rd", "th", "am", "pm"]);

/** Character rewrites that are safe anywhere printed text appears, fractions and bold included. */
export function typesetSymbols(s: string): string {
  return (
    s
      .replace(/<=/g, "≤")
      .replace(/>=/g, "≥")
      .replace(/!=/g, "≠")
      .replace(/\+\/-|\+-(?=\s|\d)/g, "±")
      .replace(/\bsqrt\s*(?=[\d(a-zπ])/g, "√")
      .replace(/\bpi\b/g, "π")
      .replace(/\^\(?2\)?(?!\d)/g, "²")
      .replace(/\^\(?3\)?(?!\d)/g, "³")
      // 3 x 4: a lone x between two numbers is a times sign.
      .replace(/(\d) x (?=\d)/g, "$1 × ")
      // A sign: at the start, after a space, a bracket, a slash or an operator, before a number,
      // a bracket, a root, π or a short letter run (-x, -ab). Not inside words (well-known).
      .replace(new RegExp(`(^|[\\s([{/${OPERATOR}])-(?=[\\d.(√π]|[a-z]{1,2}(?![a-z]))`, "g"), "$1−")
      // A spaced binary minus between maths atoms: 7 - 3, x - 2, (x + 1) - 4.
      .replace(/(\d|\)|[²³]|(?<![A-Za-z])[a-z]) - (?=[\d(√π]|[a-z](?![a-z]))/g, "$1 − ")
      // An unspaced minus after a letter or bracket: x-3, 2x-1, (x+1)-y. A digit-digit hyphen is a range.
      .replace(/((?<![A-Za-z])[a-z]|\)|[²³])-(?=\d|\(|[a-z](?![a-z]))/g, "$1−")
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
    if (/^[a-z]$/.test(core)) {
      // A unit after a number (5 m, 3 g) stays upright; so does the word "a" unless it is maths (a = 3).
      const afterNumber = /^[−-]?[\d.,]+%?$/.test(prev) && !OPERATOR_TOKEN.test(next);
      if ((core === "a" && !byOperator) || afterNumber) return;
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

/** One printed string typeset: symbols everywhere, italic maths letters outside markup and fractions. */
export function typesetText(source: string, italic = true): string {
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

/** Printed keys whose text takes italic maths letters, and those that print in bold (symbols only). */
const BODY = new Set(["text", "prefix", "suffix", "answer", "items", "options", "objective", "instruction", "keyIdea", "coverNote", "meaning", "remember", "learn", "next"]);
const HEADINGS = new Set(["title", "heading", "label", "word"]);

function typesetValue(v: unknown, key: string): unknown {
  if (typeof v === "string") return BODY.has(key) ? typesetText(v) : HEADINGS.has(key) ? typesetText(v, false) : v;
  if (Array.isArray(v)) return v.map((x) => typesetValue(x, key));
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "diagram" || k === "working" || k === "teacherNotes" ? x : typesetValue(x, k)]));
  }
  return v;
}

/**
 * The copy of a worksheet or booklet the renderers print. A typeset document prints as a maths
 * document whose text has been typeset; any other document is returned unchanged (the same
 * object), so saved plain and maths sheets print byte-identically.
 */
export function typesetForPrint<T extends { document: { notation?: string } }>(resource: T): T {
  if (resource.document.notation !== "typeset") return resource;
  const document = typesetValue(resource.document, "") as T["document"];
  return { ...resource, document: { ...document, notation: "maths" } };
}
