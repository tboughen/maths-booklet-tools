import { RENDERER_VERSION, addInverse, complete, forView, validate, value, type Envelope, type Machine, type Value } from "./index";

/** "?12" is a hidden answer; "" is a pupil blank. */
const v = (t: string): Value => (t.startsWith("?") ? value(t.slice(1), "hidden") : value(t));
function machine(id: string, start: string, ops: string[], end: string, outs: (string | null)[] = []): Machine {
  return { id, direction: "right", start: v(start), steps: ops.map((op, i) => ({ op: v(op), out: i < ops.length - 1 && outs[i] != null ? v(outs[i]!) : null })), end: v(end) };
}
function doc(machines: Machine[], intentionalError = false): Envelope {
  return validate({ kind: "function-machine", schemaVersion: 1, rendererVersion: RENDERER_VERSION, document: { machines, boxShape: "pentagon", intentionalError } });
}
const finish = (e: Envelope, worked: boolean) => (worked ? forView(e, "answer") : e);

/** Editable starting points with original numbers. Hidden answers stay blank for pupils. */
export const examples: { id: string; title: string; note: string; make: (worked: boolean) => Envelope }[] = [
  {
    id: "find-output",
    title: "Find the output: input 7",
    note: "A two-step machine with 7 going in. The value between the boxes and the output are hidden answers.",
    make: (worked) => finish(doc([machine("m1", "7", ["× 4", "+ 3"], "?31", ["?28"])]), worked),
  },
  {
    id: "find-input",
    title: "Find the input: output 13",
    note: "The output is given. The worked version adds the inverse machine beneath, worked back from 13.",
    make: (worked) => {
      const e = doc([machine("m1", "?6", ["× 3", "− 5"], "13")]);
      if (!worked) return e;
      return forView(complete(addInverse(e, "m1"), "m2", true).envelope, "answer");
    },
  },
  {
    id: "missing-operation",
    title: "Complete the machine",
    note: "Input 9 gives output 28. The first box is a hidden answer: pupils see an empty box with a dotted line.",
    make: (worked) => finish(doc([machine("m1", "9", ["?+ 5", "× 2"], "28", ["?14"])]), worked),
  },
  {
    id: "letters",
    title: "Function machine with letters",
    note: "Input n through × 3 then + 2. The output 3n + 2 is a hidden answer.",
    make: (worked) => finish(doc([machine("m1", "n", ["× 3", "+ 2"], "?3n + 2", ["?3n"])]), worked),
  },
  {
    id: "two-machines",
    title: "Two machines, the same input",
    note: "Here is a different number machine: two machines one above the other, with blank outputs for pupils.",
    make: (worked) => finish(doc([machine("m1", "12", ["÷ 4", "+ 6"], "?9"), machine("m2", "12", ["− 3", "× 1/3"], "?3")]), worked),
  },
];

/** The inverse machine's operations and output left as pupil blanks; only its input is given. */
function blankInverse(e: Envelope): Envelope {
  const inverse = e.document.machines[1];
  inverse.steps.forEach((s) => (s.op = value("")));
  inverse.end = value("");
  return validate(e);
}
/** Plain shapes: common machines with the input and operations given and the output blank. */
export const plainShapes: { id: string; title: string; note: string; make: () => Envelope }[] = [
  { id: "one-step", title: "One-step machine", note: "Input 5 through × 3, with the output blank.", make: () => doc([machine("m1", "5", ["× 3"], "")]) },
  { id: "two-step", title: "Two-step machine", note: "Input 4 through × 2 then + 5, with the output blank.", make: () => doc([machine("m1", "4", ["× 2", "+ 5"], "")]) },
  { id: "inverse", title: "Two-step machine with its inverse", note: "A two-step machine with output 17, and an inverse machine beneath with its boxes and output blank to work backwards.", make: () => blankInverse(addInverse(doc([machine("m1", "", ["× 2", "+ 5"], "17")]), "m1")) },
];
