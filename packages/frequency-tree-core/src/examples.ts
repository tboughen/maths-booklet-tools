import { calculateQuestion, forView, fromNested, groupName, validate, type Envelope, type NestedNode } from "./index";

type Q = { text: string; numerator: string[]; denominator?: string[] };
/** Adds questions whose groups are named like "men, like coffee", then calculates their saved (hidden) answers. */
function withQuestions(e: Envelope, questions: Q[]): Envelope {
  const n = structuredClone(e),
    d = n.document;
  const byName = new Map(d.nodes.map((b) => [groupName(d, b.id), b.id]));
  const ids = (names: string[]) =>
    names.map((name) => {
      const id = byName.get(name);
      if (!id) throw Error(`Example group ${name} is missing.`);
      return id;
    });
  d.questions = questions.map((q, i) => ({
    id: `q${i + 1}`,
    text: q.text,
    answer: { text: "", show: "hidden" },
    numerator: ids(q.numerator),
    denominator: ids(q.denominator ?? []),
  }));
  let out = validate(n);
  for (const q of out.document.questions) out = calculateQuestion(out, q.id) ?? out;
  return out;
}
const finish = (e: Envelope, worked: boolean) => (worked ? forView(e, "answer") : e);
/** Every count hidden for pupils. */
const hidden = (category: string, count: string, children?: NestedNode[]): NestedNode => ({
  category,
  count,
  hidden: ["count"],
  children,
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
    id: "coffee",
    title: "November 2018 1F Q17: who likes coffee",
    note: "80 people; 48 are women, 61 like coffee and 8 of the men do not. Pupils complete the six ovals, then find the probability that a coffee drinker is a woman. Answers are saved hidden.",
    sourceId: "1MA1_NOV_2018_1F_Q17",
    worked: true,
    make: (worked) => {
      const split = (like: string, not: string) => [hidden("like coffee", like), hidden("do not like coffee", not)];
      const e = fromNested("80", [hidden("men", "32", split("24", "8")), hidden("women", "48", split("37", "11"))]);
      return finish(
        withQuestions(e, [
          {
            text: "P(a person who likes coffee is a woman) =",
            numerator: ["women, like coffee"],
            denominator: ["men, like coffee", "women, like coffee"],
          },
        ]),
        worked,
      );
    },
  },
  {
    id: "lunches",
    title: "Mock Set 4 3F Q16: school or packed lunch",
    note: "60 children; 32 are boys, 3/4 of the boys have a school lunch and 1/2 of the girls have a packed lunch. Every oval, including the total, is left for pupils.",
    sourceId: "1MA1_MOCK_SET_04_3F_Q16",
    worked: true,
    make: (worked) => {
      const split = (school: string, packed: string) => [hidden("school lunch", school), hidden("packed lunch", packed)];
      const e = fromNested("60", [hidden("boys", "32", split("24", "8")), hidden("girls", "28", split("14", "14"))], {
        hideTotal: true,
      });
      return finish(e, worked);
    },
  },
  {
    id: "handedness",
    title: "June 2018 2F Q14: left or right-handed",
    note: "45 workers; 22 are male and 16 of the 34 right-handed workers are female. Group names sit beside the ovals, as on this paper.",
    sourceId: "1MA1_JUN_2018_2F_Q14",
    worked: true,
    make: (worked) => {
      const split = (l: string, r: string) => [hidden("left-handed", l), hidden("right-handed", r)];
      const e = fromNested("45", [hidden("male", "22", split("4", "18")), hidden("female", "23", split("7", "16"))], {
        labelPlace: "node",
      });
      return finish(e, worked);
    },
  },
  {
    id: "text-or-email",
    title: "November 2021 2F Q17: text or email",
    note: "60 people; 38 are women, 15 of the men prefer email and 60% of the people prefer to text. Group names beside the ovals.",
    sourceId: "1MA1_NOV_2021_2F_Q17",
    worked: true,
    make: (worked) => {
      const split = (t: string, m: string) => [hidden("text", t), hidden("email", m)];
      const e = fromNested("60", [hidden("men", "22", split("7", "15")), hidden("women", "38", split("29", "9"))], {
        labelPlace: "node",
      });
      return finish(e, worked);
    },
  },
  {
    id: "three-years",
    title: "Three groups: languages by year",
    note: "120 pupils in Years 9, 10 and 11 each study French or Spanish. Two counts are given in each year; pupils fill the rest and answer a given-that question.",
    worked: true,
    make: (worked) => {
      const split = (f: string, s: string, showFrench = true): NestedNode[] => [
        { category: "French", count: f, hidden: showFrench ? [] : ["count"] },
        { category: "Spanish", count: s, hidden: showFrench ? ["count"] : [] },
      ];
      const e = fromNested(
        "120",
        [
          { category: "Year 9", count: "45", children: split("20", "25") },
          { category: "Year 10", count: "40", children: split("18", "22", false) },
          { category: "Year 11", count: "35", hidden: ["count"], children: split("21", "14") },
        ],
        { gapMm: 16, branchMm: 30 },
      );
      return finish(
        withQuestions(e, [
          {
            text: "P(a Spanish student is in Year 10) =",
            numerator: ["Year 10, Spanish"],
            denominator: ["Year 9, Spanish", "Year 10, Spanish", "Year 11, Spanish"],
          },
        ]),
        worked,
      );
    },
  },
];
