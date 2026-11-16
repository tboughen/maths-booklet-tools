import { RENDERER_VERSION, forView, validate, value, type Envelope, type Line, type Relation, type Step, type Under, type Value } from "./index";

/** "?12" is a hidden answer; "" is a pupil blank. */
const v = (t: string): Value => (t.startsWith("?") ? value(t.slice(1), "hidden") : value(t));
const ln = (lhs: string, rhs: string, rel: Relation = "="): Line => ({ lhs: v(lhs), rel, rhs: v(rhs) });
/** A step: the same operation in both bubbles (or one each), then the line it leads to. */
function step(ops: string | [string, string], next: Line, under: [Under, Under] = ["auto", "auto"]): Step {
  const [l, r] = typeof ops === "string" ? [ops, ops] : ops;
  return { left: { op: v(l), under: under[0] }, right: { op: v(r), under: under[1] }, line: next };
}
function doc(first: Line, steps: Step[], intentionalError = false): Envelope {
  return validate({ kind: "bubble-method", schemaVersion: 1, rendererVersion: RENDERER_VERSION, document: { first, steps, intentionalError } });
}
const finish = (e: Envelope, worked: boolean) => (worked ? forView(e, "answer") : e);

/** Editable starting points with original numbers. Hidden answers stay blank for pupils. */
export const examples: { id: string; title: string; note: string; make: (worked: boolean) => Envelope }[] = [
  {
    id: "subject-one-step",
    title: "Change the subject: one step",
    note: "Make x the subject of y = x + 7 (A4.08). The bubbles and the new line are hidden answers.",
    make: (worked) => finish(doc(ln("y", "x + 7"), [step("?−7", ln("?y − 7", "?x"))]), worked),
  },
  {
    id: "subject-two-steps",
    title: "Change the subject: two steps",
    note: "Make x the subject of y = 3x + 2 (A4.09). The first bubbles are given; the rest are hidden answers, ending in a stacked fraction.",
    make: (worked) => finish(doc(ln("y", "3x + 2"), [step("−2", ln("?y − 2", "?3x")), step("?÷3", ln("?(y − 2)/3", "?x"))]), worked),
  },
  {
    id: "subject-formula",
    title: "Change the subject: v = u + at",
    note: "Make t the subject (A4.09). The first bubble on the right sits under u, the term it takes away.",
    make: (worked) =>
      finish(doc(ln("v", "u + at"), [step("?−u", ln("?v − u", "?at"), ["auto", 0]), step("?÷a", ln("?(v − u)/a", "?t"))]), worked),
  },
  {
    id: "solve-equation",
    title: "Solve 4x + 3 = 23",
    note: "A two-step equation (A3). Pupils see empty bubbles and blank lines to fill in.",
    make: (worked) => finish(doc(ln("4x + 3", "23"), [step("?−3", ln("?4x", "?20")), step("?÷4", ln("?x", "?5"))]), worked),
  },
  {
    id: "inequality",
    title: "Solve 2x − 5 < 9",
    note: "A linear inequality (A10), balanced in the same way. The sign stays the same throughout.",
    make: (worked) => finish(doc(ln("2x − 5", "9", "<"), [step("?+5", ln("?2x", "?14", "<")), step("?÷2", ln("?x", "?7", "<"))]), worked),
  },
];
