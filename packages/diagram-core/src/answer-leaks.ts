/**
 * The answer-leak check (improvement item W90): a pupil copy must never show a saved answer.
 * It reads the shared answer slots (W3) and checks the pupil artwork two ways:
 *
 * 1. Colour: the house answer colour marks revealed answers, so it never appears on a pupil copy.
 * 2. Text: every saved answer is swapped for a stand-in of the same length and the pupil copy is
 *    drawn again. If any printed text (including the title and aria-label that alt text comes
 *    from) changes, the pupil copy depends on a hidden answer. Geometry is not compared, because
 *    both copies deliberately share one layout sized for the answers.
 *
 * It never changes the saved file; it only reports.
 */
import { ANSWER_COLOUR, holdsAnswer, type AnswerSlot } from "../../envelope-core/src/answer-state";
import { answerSlots } from "./answer-slots";
import { FAMILIES, type DiagramKind } from "./registry";

export interface AnswerLeak {
  /** The slot whose saved answer reaches the pupil copy; "svg" for the answer colour. */
  path: string;
  message: string;
}

const COLOUR = new RegExp(ANSWER_COLOUR.replace("#", "#?"), "i");

/** Every printed string in an SVG: text content, titles, descriptions and aria-labels. */
export function printedText(svg: string): string[] {
  const out = [...svg.matchAll(/<(text|title|desc)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => m[2].replace(/<[^>]+>/g, ""));
  for (const m of svg.matchAll(/aria-label="([^"]*)"/g)) out.push(m[1]);
  return out;
}

/** A same-length stand-in: digits move by 5, letters by 13, so widths stay close and no value repeats. */
const standIn = (s: string) =>
  s.replace(/[0-9]/g, (d) => String((Number(d) + 5) % 10)).replace(/[a-z]/gi, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });

/** Fields that hold a slot's saved text. Number-line tick keys and graph objects are not swapped. */
const TEXT_FIELDS = ["text", "value", "answer", "factor"] as const;

function swapped(envelope: unknown, slots: AnswerSlot[]): { envelope: unknown; swappedPaths: string[] } {
  const copy = structuredClone(envelope) as Record<string, unknown>;
  const swappedPaths: string[] = [];
  for (const s of slots) {
    const node = s.path.split(".").reduce<unknown>((n, k) => (n && typeof n === "object" ? (n as Record<string, unknown>)[k] : undefined), copy);
    if (typeof node === "string" && s.path.endsWith(".answer") && node === s.text) {
      // A document-level answer string (number line, algebra grid).
      const parent = s.path.split(".").slice(0, -1).reduce<unknown>((n, k) => (n as Record<string, unknown>)[k], copy) as Record<string, unknown>;
      parent.answer = standIn(node);
      swappedPaths.push(s.path);
      continue;
    }
    if (!node || typeof node !== "object") continue;
    const n = node as Record<string, unknown>;
    for (const f of TEXT_FIELDS)
      if (n[f] === s.text) {
        n[f] = standIn(s.text);
        swappedPaths.push(s.path);
        break;
      }
  }
  return { envelope: copy, swappedPaths };
}

/** Leaks of saved answers into one diagram's pupil copy. Empty when the copy is safe. */
export function answerLeaks(kind: DiagramKind, envelope: unknown, pupilSvg?: string): AnswerLeak[] {
  const family = FAMILIES[kind];
  const pupil = pupilSvg ?? family.svg(envelope, "pupil");
  const leaks: AnswerLeak[] = [];
  if (COLOUR.test(pupil)) leaks.push({ path: "svg", message: `The pupil copy of this ${family.label} uses the answer colour, so an answer may be showing.` });
  const held = answerSlots(kind, envelope).filter(holdsAnswer);
  if (!held.length) return leaks;
  const { envelope: other, swappedPaths } = swapped(envelope, held);
  if (!swappedPaths.length) return leaks;
  let redrawn: string;
  try {
    redrawn = family.svg(other, "pupil");
  } catch {
    return leaks; // The stand-in is not drawable for this family: the colour check still applies.
  }
  const before = printedText(pupil), after = printedText(redrawn);
  if (before.join("\u0000") !== after.join("\u0000")) {
    // Name the slots whose answer text is printed, so the teacher can find them.
    const named = held.filter((s) => swappedPaths.includes(s.path) && before.some((t) => t.includes(s.text)));
    for (const s of named.length ? named : held.filter((s) => swappedPaths.includes(s.path)))
      leaks.push({ path: s.path, message: `The pupil copy of this ${family.label} prints a saved answer ("${s.text}" at ${s.path}).` });
  }
  return leaks;
}
