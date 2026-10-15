import {
  create,
  createExtended,
  activeMasks,
  validate,
  type Envelope,
  type Arrangement,
} from "./index";
type Example = {
  id: string;
  title: string;
  note: string;
  url?: string;
  make: (worked: boolean) => Envelope;
};
function example(
  sets: 2 | 3,
  labels: string[],
  values: string[],
  kind: "members" | "frequency" | "algebra",
  worked: boolean,
  definitions: string[],
  omitLabels = false,
) {
  const e = create(sets),
    d = e.document;
  labels.forEach((text, i) => {
    d.labels[i + 1].text = text;
    if (omitLabels && !worked) d.labels[i + 1].visibility = "hidden";
  });
  d.definitions = definitions;
  d.showDefinitions = true;
  if (worked)
    values.forEach((text, mask) => {
      d.regions[mask] = { kind, text, visibility: "show", shade: "none" };
    });
  return validate(e);
}
const bank = "https://mathsdock.co.uk/?tool=question-bank&";
export const examples: Example[] = [
  {
    id: "2017",
    title: "June 2017 · 3F Q15 / 3H Q1",
    note: "Two sets; pupil set labels and member regions remain blank in the scaffold.",
    url: bank + "code=U748&question=1MA1_JUN_2017_3H_Q1",
    make: (worked) =>
      example(
        2,
        ["A", "B"],
        ["1,7,11,13,17,19,23,29", "3,9,21,27", "5,25", "15"],
        "members",
        worked,
        [
          "ξ = {odd numbers less than 30}",
          "A = {3, 9, 15, 21, 27}",
          "B = {5, 15, 25}",
          "",
        ],
        true,
      ),
  },
  {
    id: "2019",
    title: "June 2019 · 3H Q1 / 3F Q24",
    note: "Labelled two-set scaffold; two separate members in the intersection.",
    url: bank + "code=U748&question=1MA1_JUN_2019_3H_Q1",
    make: (worked) => {
      const e = example(
        2,
        ["A", "B"],
        ["3,4,7", "1,5,8", "2", "6,9"],
        "members",
        worked,
        [
          "ξ = {1, 2, 3, 4, 5, 6, 7, 8, 9}",
          "A = {1, 5, 6, 8, 9}",
          "B = {2, 6, 9}",
          "",
        ],
      );
      e.document.shape = "ovals";
      return e;
    },
  },
  {
    id: "2018",
    title: "November 2018 · 2H Q1 / 2F Q20",
    note: "Three sets with genuinely empty pair-only regions. The central member belongs to all three sets.",
    url: bank + "code=U748&question=1MA1_NOV_2018_2F_Q20",
    make: (worked) =>
      example(
        3,
        ["A", "B", "C"],
        ["4,12,16,24", "2,10,14", "6", "", "18,22", "", "20", "8"],
        "members",
        worked,
        [
          "ξ = {even numbers between 1 and 25}",
          "A = {2, 8, 10, 14}",
          "B = {6, 8, 20}",
          "C = {8, 18, 20, 22}",
        ],
      ),
  },
  {
    id: "languages",
    title: "June 2018 · 3H Q20",
    note: "Teaching scaffold adapted from a prose question. Worked copy retains the zero frequency.",
    url: bank + "code=U476&question=1MA1_JUN_2018_3H_Q20",
    make: (worked) =>
      example(
        3,
        ["F", "G", "S"],
        ["8", "22", "0", "3", "6", "4", "5", "2"],
        "frequency",
        worked,
        [
          "ξ = {50 people}",
          "F = {people who speak French}",
          "G = {people who speak German}",
          "S = {people who speak Spanish}",
        ],
      ),
  },
  {
    id: "films",
    title: "Mock set 07 · 2H Q16",
    note: "Film survey from a mock. All eight frequencies are given in the source, so both copies retain them.",
    url: bank + "code=U699&question=1MA1_MOCK_SET_07_2H_Q16",
    make: () =>
      example(
        3,
        ["C", "A", "S"],
        ["6", "20", "23", "5", "31", "4", "9", "2"],
        "frequency",
        true,
        [
          "ξ = {100 people}",
          "C = {people who like comedy}",
          "A = {people who like action}",
          "S = {people who like science fiction}",
        ],
      ),
  },
  {
    id: "algebra",
    title: "Mock set 08 · 1H Q23",
    note: "The source gives these algebraic labels. Both copies retain them, without solving or substitution.",
    url: bank + "code=U699&question=1MA1_MOCK_SET_08_1H_Q23",
    make: () =>
      example(2, ["C", "G"], ["x - 1", "3x + 2", "3x", "x"], "algebra", true, [
        "ξ = {all people in the room}",
        "C = {children}",
        "G = {people wearing glasses}",
        "",
      ]),
  },
  {
    id: "shading",
    title: "Complement of a union",
    note: "Original teaching example, not a source-paper shading task.",
    make: () => {
      const e = create();
      e.document.regions[0].shade = "hatch";
      return e;
    },
  },
];

function teaching(
  sets: 1 | 2,
  arrangement: Arrangement,
  definitions: string[],
  values: Record<number, string>,
  worked: boolean,
) {
  const e = createExtended(sets);
  e.document.arrangement = arrangement;
  e.document.definitions = definitions;
  e.document.showDefinitions = true;
  for (const mask of activeMasks(e))
    e.document.regions[mask] = {
      kind: "members",
      text: values[mask] ?? "",
      visibility: worked ? "show" : "hidden",
      shade: "none",
    };
  return validate(e);
}
export const teachingExamples: Example[] = [
  {
    id: "one-set",
    title: "One set · even numbers",
    note: "Membership and complement in a finite universe.",
    make: (worked) =>
      teaching(
        1,
        "overlap",
        [
          "ξ = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12}",
          "A = {even numbers}",
          "",
          "",
        ],
        { 0: "1,3,5,7,9,11", 1: "2,4,6,8,10,12" },
        worked,
      ),
  },
  {
    id: "separate",
    title: "Separate sets · even and odd",
    note: "Mutually exclusive sets; every member is in exactly one of these sets.",
    make: (worked) =>
      teaching(
        2,
        "separate",
        [
          "ξ = {integers from 1 to 12}",
          "A = {even numbers}",
          "B = {odd numbers}",
          "",
        ],
        { 0: "", 1: "2,4,6,8,10,12", 2: "1,3,5,7,9,11" },
        worked,
      ),
  },
  {
    id: "nested",
    title: "B inside A · multiples of 4",
    note: "Every multiple of 4 is even. Compare with the overlapping example using the same labels.",
    make: (worked) =>
      teaching(
        2,
        "b-inside-a",
        [
          "ξ = {integers from 1 to 12}",
          "A = {even numbers}",
          "B = {multiples of 4}",
          "",
        ],
        { 0: "1,3,5,7,9,11", 1: "2,6,10", 3: "4,8,12" },
        worked,
      ),
  },
  {
    id: "reverse-nested",
    title: "A inside B · reverse the labels",
    note: "The subset relationship works in either direction; A is now multiples of 4.",
    make: (worked) =>
      teaching(
        2,
        "a-inside-b",
        [
          "ξ = {integers from 1 to 12}",
          "A = {multiples of 4}",
          "B = {even numbers}",
          "",
        ],
        { 0: "1,3,5,7,9,11", 2: "2,6,10", 3: "4,8,12" },
        worked,
      ),
  },
  {
    id: "overlap-contrast",
    title: "Overlap · multiples of 3",
    note: "Keep A as even numbers; change B to multiples of 3 and compare with containment.",
    make: (worked) =>
      teaching(
        2,
        "overlap",
        [
          "ξ = {integers from 1 to 12}",
          "A = {even numbers}",
          "B = {multiples of 3}",
          "",
        ],
        { 0: "1,5,7,11", 1: "2,4,8,10", 2: "3,9", 3: "6,12" },
        worked,
      ),
  },
];
