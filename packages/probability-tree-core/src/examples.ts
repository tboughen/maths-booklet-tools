import {
  calculateQuestion,
  fillEnd,
  fillFromBag,
  forView,
  fromNested,
  leaves,
  pathName,
  uniform,
  validate,
  type Envelope,
  type NestedBranch,
} from "./index";

type Q = { text: string; event: string[]; given?: string[] };
/** Adds questions whose paths are named like "Red, Blue", then calculates their saved (hidden) answers. */
function withQuestions(e: Envelope, questions: Q[]): Envelope {
  const n = structuredClone(e),
    d = n.document;
  const byName = new Map(leaves(d).map((b) => [pathName(d, b.id), b.id]));
  const ids = (names: string[]) =>
    names.map((name) => {
      const id = byName.get(name);
      if (!id) throw Error(`Example path ${name} is missing.`);
      return id;
    });
  d.questions = questions.map((q, i) => ({
    id: `q${i + 1}`,
    text: q.text,
    answer: { text: "", show: "hidden" },
    event: ids(q.event),
    given: ids(q.given ?? []),
  }));
  let out = validate(n);
  for (const q of out.document.questions) out = calculateQuestion(out, q.id) ?? out;
  return out;
}
const finish = (e: Envelope, worked: boolean) => (worked ? forView(e, "answer") : e);
const hideP = (nodes: NestedBranch[], keep: (path: string) => boolean, prefix = ""): NestedBranch[] =>
  nodes.map((b) => {
    const path = prefix ? `${prefix}, ${b.outcome}` : b.outcome;
    return {
      ...b,
      hidden: keep(path) ? b.hidden : [...(b.hidden ?? []), "probability"],
      children: b.children && hideP(b.children, keep, path),
    };
  });

/** Editable starting points. Source examples name the question they adapt. */
export const examples: {
  id: string;
  title: string;
  note: string;
  sourceId?: string;
  worked: boolean;
  make: (worked: boolean) => Envelope;
}[] = [
  {
    id: "two-bags",
    title: "November 2018 1F Q27: two bags",
    note: "3 red and 7 green balls in the first bag; 5 red and 4 green in the second. Pupils complete the four missing probabilities, then find P(two red). Answers are saved hidden.",
    sourceId: "1MA1_NOV_2018_1F_Q27",
    worked: true,
    make: (worked) => {
      const second = (): NestedBranch[] => [
        { outcome: "red", probability: "5/9" },
        { outcome: "green", probability: "4/9" },
      ];
      const tree = hideP(
        [
          { outcome: "red", probability: "3/10", children: second() },
          { outcome: "green", probability: "7/10", children: second() },
        ],
        (p) => p === "red" || p === "red, red",
      );
      const e = fromNested(tree, { stageTitles: ["first bag", "second bag"], linkLabels: true });
      return finish(withQuestions(e, [{ text: "P(two red balls) =", event: ["red, red"] }]), worked);
    },
  },
  {
    id: "darts",
    title: "June 2018 2H Q15: dependent events",
    note: "Win on Saturday 0.45; win on Sunday 0.67 after a win and 0.35 otherwise. Pupils complete the tree, then find P(exactly one win).",
    sourceId: "1MA1_JUN_2018_2H_Q15",
    worked: true,
    make: (worked) => {
      const tree = hideP(
        [
          {
            outcome: "win",
            probability: "0.45",
            children: [
              { outcome: "win", probability: "0.67" },
              { outcome: "not win", probability: "0.33" },
            ],
          },
          {
            outcome: "not win",
            probability: "0.55",
            children: [
              { outcome: "win", probability: "0.35" },
              { outcome: "not win", probability: "0.65" },
            ],
          },
        ],
        (p) => p === "win",
      );
      const e = fromNested(tree, { stageTitles: ["Saturday", "Sunday"], linkLabels: true });
      return finish(
        withQuestions(e, [
          { text: "P(wins exactly one match) =", event: ["win, not win", "not win, win"] },
        ]),
        worked,
      );
    },
  },
  {
    id: "without-replacement",
    title: "Counters without replacement",
    note: "Teaching example: 5 red and 3 blue counters, two taken without replacement. Probabilities come from Fill from bag; the outcome and probability columns are saved as hidden answers.",
    worked: true,
    make: (worked) => {
      let e = uniform([{ outcomes: ["Red", "Blue"] }, { outcomes: ["Red", "Blue"] }], {
        stageTitles: ["First counter", "Second counter"],
        endColumn: "both",
      });
      e = fillFromBag(e, [5, 3], false)!;
      e = fillEnd(fillEnd(e, "outcome"), "probability");
      for (const b of e.document.branches) {
        b.endOutcome.show = "hidden";
        b.endProbability.show = "hidden";
      }
      return finish(
        withQuestions(e, [{ text: "P(both the same colour) =", event: ["Red, Red", "Blue, Blue"] }]),
        worked,
      );
    },
  },
  {
    id: "unequal",
    title: "Unequal tree: up to three attempts",
    note: "Teaching example: a path stops after a pass. Each attempt is passed with probability 0.6. Missing probabilities and P(passes within three attempts) are saved hidden.",
    worked: true,
    make: (worked) => {
      const attempt = (rest: NestedBranch[] | undefined): NestedBranch[] => [
        { outcome: "Pass", probability: "0.6" },
        { outcome: "Fail", probability: "0.4", hidden: ["probability"], children: rest },
      ];
      const e = fromNested(attempt(attempt(attempt(undefined))), {
        stageTitles: ["1st attempt", "2nd attempt", "3rd attempt"],
        linkLabels: false,
        branchMm: 26,
        gapMm: 13,
      });
      return finish(
        withQuestions(e, [
          {
            text: "P(passes within three attempts) =",
            event: ["Pass", "Fail, Pass", "Fail, Fail, Pass"],
          },
        ]),
        worked,
      );
    },
  },
  {
    id: "given-that",
    title: "Given that: conditional probability",
    note: "Teaching example: 4 red and 6 blue counters, two taken without replacement. The paths where the second counter is red are drawn bold for the condition.",
    worked: true,
    make: (worked) => {
      let e = uniform([{ outcomes: ["Red", "Blue"] }, { outcomes: ["Red", "Blue"] }], {
        stageTitles: ["First counter", "Second counter"],
      });
      e = fillFromBag(e, [4, 6], false)!;
      const d = e.document;
      for (const leaf of leaves(d)) if (pathName(d, leaf.id).endsWith(", Red")) leaf.bold = true;
      return finish(
        withQuestions(e, [
          { text: "P(second counter is red) =", event: ["Red, Red", "Blue, Red"] },
          {
            text: "P(first is red given that the second is red) =",
            event: ["Red, Red"],
            given: ["Red, Red", "Blue, Red"],
          },
        ]),
        worked,
      );
    },
  },
  {
    id: "three-coins",
    title: "Three coins",
    note: "Teaching example: an equal three-stage tree with outcome and probability columns left for pupils.",
    worked: true,
    make: (worked) => {
      const coin = { outcomes: ["H", "T"], probabilities: ["1/2", "1/2"] };
      let e = uniform([coin, coin, coin], {
        stageTitles: ["1st coin", "2nd coin", "3rd coin"],
        endColumn: "both",
        branchMm: 24,
        gapMm: 11,
      });
      e = fillEnd(fillEnd(e, "outcome"), "probability");
      for (const b of e.document.branches) {
        b.endOutcome.show = "hidden";
        b.endProbability.show = "hidden";
      }
      return finish(withQuestions(e, [{ text: "P(exactly two heads) =", event: ["H, H, T", "H, T, H", "T, H, H"] }]), worked);
    },
  },
];
