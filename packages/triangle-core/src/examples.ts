import { build, create } from "./geometry";
import { label, validate, type Envelope, type Label } from "./model";

export type Example = {
  key: string;
  title: string;
  description: string;
  sourceId: string | null;
  source: string;
  build: () => Envelope;
};
function edge(
  e: Envelope,
  a: string,
  b: string,
  text: string,
  state: Label["state"] = "value",
  answer = "",
) {
  const v = e.document.edges.find(
    (v) => [v.from, v.to].sort().join("") === [a, b].sort().join(""),
  )!;
  v.label = label(text, state, "cm");
  v.label.answer = answer;
}
function angle(
  e: Envelope,
  t: string,
  v: string,
  text: string,
  state: Label["state"] = "value",
  answer = "",
) {
  const a = e.document.angles.find((a) => a.id === `${t}-${v}`)!;
  a.label = label(text, state, "°");
  a.label.answer = answer;
  if (a.mark !== "right") a.mark = state === "blank" ? "none" : "arc";
}
function area(
  e: Envelope,
  text: string,
  state: Label["state"] = "blank",
  answer = "",
) {
  const l = label(text, state, "cm²");
  l.prefix = "Area = ";
  l.answer = answer;
  e.document.captions.push({ id: "C1", label: l });
}
const source = (id: string, fn: () => Envelope) => () => {
  const e = fn();
  e.document.sourceId = id;
  return validate(e);
};
export const teachingExamples: Example[] = [
  {
    key: "missing-side",
    title: "Missing hypotenuse",
    description:
      "Teaching example: keep x visible while 10 cm stays saved as a hidden answer.",
    sourceId: null,
    source: "Teaching example",
    build: () => {
      const e = create();
      edge(e, "A", "B", "6");
      edge(e, "A", "C", "8");
      edge(e, "B", "C", "x", "symbol", "10");
      return validate(e);
    },
  },
  {
    key: "external-height",
    title: "External perpendicular height",
    description:
      "Teaching example: the height meets the extension of AB. The pupil supplies h.",
    sourceId: null,
    source: "Teaching example",
    build: () => {
      const e = build(
        [
          { id: "A", x: 0, y: 65 },
          { id: "B", x: 75, y: 65 },
          { id: "C", x: 115, y: 0 },
        ],
        [{ id: "T1", vertices: ["A", "B", "C"] }],
      );
      edge(e, "A", "B", "8");
      e.document.heights.push({
        id: "H1",
        triangleId: "T1",
        apex: "C",
        base: "AB",
        label: label("h", "symbol", "cm"),
        footName: "",
      });
      e.document.widthCm = 14;
      return validate(e);
    },
  },
  {
    key: "fractions",
    title: "Fractions and surds",
    description:
      "Teaching example: exact fractional lengths and a symbolic missing hypotenuse.",
    sourceId: null,
    source: "Teaching example",
    build: () => {
      const e = create();
      edge(e, "A", "B", "3/2");
      edge(e, "A", "C", "2");
      edge(e, "B", "C", "x", "symbol", "5/2");
      return validate(e);
    },
  },
  {
    key: "ssa",
    title: "Two possible triangles",
    description:
      "Teaching example: a = 8, b = 12, A = 30°. Sine rule gives two possible B angles. Choose a branch explicitly.",
    sourceId: null,
    source: "Teaching example",
    build: () => {
      const e = create("scalene");
      edge(e, "B", "C", "8");
      edge(e, "A", "C", "12");
      angle(e, "T1", "A", "30");
      angle(e, "T1", "B", "x", "symbol");
      e.document.notToScale = true;
      return validate(e);
    },
  },
  {
    key: "deliberate-error",
    title: "Spot the impossible lengths",
    description:
      "Deliberate teaching error: 3 cm, 4 cm and 9 cm cannot form a triangle. The labels are retained with a teacher warning.",
    sourceId: null,
    source: "Teaching example",
    build: () => {
      const e = create("scalene");
      edge(e, "A", "B", "3");
      edge(e, "A", "C", "4");
      edge(e, "B", "C", "9");
      e.document.notToScale = true;
      return validate(e);
    },
  },
];
export const sourceExamples: Example[] = [
  {
    key: "pythagoras-error",
    title: "Pythagoras: identify the hypotenuse",
    sourceId: "1MA1_JUN_2019_3H_Q8",
    source: "June 2019 3H Q8(a)",
    description:
      "Triangle only, supporting the source's mistake explanation. AB = 6 cm, AC = 8 cm; B is the right angle. The incorrect written working and enlargement part are not reproduced.",
    build: source("1MA1_JUN_2019_3H_Q8", () => {
      const e = build(
        [
          { id: "A", x: 0, y: 65 },
          { id: "B", x: 30, y: 0 },
          { id: "C", x: 120, y: 65 },
        ],
        [{ id: "T1", vertices: ["A", "B", "C"] }],
      );
      // A true right angle with the same identities, independent of printed givens.
      const b = e.document.vertices[1];
      b.x = 42;
      b.y = 65 - Math.sqrt(42 * 78);
      e.document.triangles[0].rightAt = "B";
      e.document.angles.find((a) => a.id === "T1-B")!.mark = "right";
      edge(e, "A", "B", "6");
      edge(e, "A", "C", "8");
      edge(e, "B", "C", "", "blank", "2√7");
      return e;
    }),
  },
  {
    key: "right-trig",
    title: "Right trigonometry: side and angle",
    sourceId: "1MA1_NOV_2021_2H_Q6",
    source: "November 2021 2H Q6",
    description:
      "Two separate source triangles: AC = 12 cm, A = 56°; PR = 18 cm, RQ = 15 cm and unknown x at R. Answers use 1 decimal place.",
    build: source("1MA1_NOV_2021_2H_Q6", () => {
      const e = build(
        [
          { id: "A", x: 0, y: 0 },
          { id: "B", x: 90, y: 60 },
          { id: "C", x: 0, y: 60 },
          { id: "P", x: 210, y: 15 },
          { id: "Q", x: 210, y: 60 },
          { id: "R", x: 125, y: 60 },
        ],
        [
          { id: "T1", vertices: ["A", "B", "C"], rightAt: "C" },
          { id: "T2", vertices: ["P", "Q", "R"], rightAt: "Q" },
        ],
        "separate",
      );
      edge(e, "A", "C", "12");
      angle(e, "T1", "A", "56");
      edge(e, "B", "C", "", "blank", "17.8");
      edge(e, "P", "R", "18");
      edge(e, "Q", "R", "15");
      angle(e, "T2", "R", "x", "symbol", "33.6");
      return e;
    }),
  },
  {
    key: "sine-side",
    title: "Sine rule: missing side",
    sourceId: "1MA1_NOV_2020_2H_Q13",
    source: "November 2020 2H Q13",
    description:
      "BC = 23.8 cm; B = 26°, C = 34°. AB and the third angle remain blank. Worked side: 15.4 cm, 1 d.p.",
    build: source("1MA1_NOV_2020_2H_Q13", () => {
      const e = build(
        [
          { id: "A", x: 35, y: 60 },
          { id: "B", x: 140, y: 60 },
          { id: "C", x: 0, y: 0 },
        ],
        [{ id: "T1", vertices: ["A", "B", "C"] }],
      );
      edge(e, "B", "C", "23.8");
      angle(e, "T1", "B", "26");
      angle(e, "T1", "C", "34");
      edge(e, "A", "B", "", "blank", "15.4");
      angle(e, "T1", "A", "", "blank", "120");
      e.document.widthCm = 14;
      return e;
    }),
  },
  {
    key: "sine-angle",
    title: "Sine rule: missing angle",
    sourceId: "1MA1_MOCK_SET_06_2H_Q16",
    source: "Mock set 6 2H Q16",
    description:
      "AC = 12 cm, BC = 8 cm and B = 130°. The supplementary candidate cannot form a triangle. x = 30.7°, 1 d.p.",
    build: source("1MA1_MOCK_SET_06_2H_Q16", () => {
      const e = build(
        [
          { id: "A", x: 0, y: 65 },
          { id: "B", x: 35, y: 35 },
          { id: "C", x: 125, y: 70 },
        ],
        [{ id: "T1", vertices: ["A", "B", "C"] }],
      );
      edge(e, "A", "C", "12");
      edge(e, "B", "C", "8");
      angle(e, "T1", "B", "130");
      angle(e, "T1", "A", "x", "symbol", "30.7");
      e.document.widthCm = 14;
      return e;
    }),
  },
  {
    key: "cosine-acute",
    title: "Cosine rule and area",
    sourceId: "1MA1_NOV_2021_2H_Q15",
    source: "November 2021 2H Q15",
    description:
      "AC = 8 cm, AB = 11 cm and A = 72°. BC and area stay unanswered. Worked results: 11.4 cm and 41.8 cm², 3 s.f.",
    build: source("1MA1_NOV_2021_2H_Q15", () => {
      const e = build(
        [
          { id: "A", x: 45, y: 0 },
          { id: "B", x: 110, y: 75 },
          { id: "C", x: 0, y: 75 },
        ],
        [{ id: "T1", vertices: ["A", "B", "C"] }],
      );
      edge(e, "A", "C", "8");
      edge(e, "A", "B", "11");
      angle(e, "T1", "A", "72");
      edge(e, "B", "C", "", "blank", "11.4");
      area(e, "", "blank", "41.8");
      return e;
    }),
  },
  {
    key: "cosine-obtuse",
    title: "Obtuse triangle: area and cosine rule",
    sourceId: "1MA1_MOCK_SET_06_3H_Q15",
    source: "Mock set 6 3H Q15",
    description:
      "AB = 5.6 cm, BC = 12.3 cm and B = 114°. Worked area 31.5 cm², AC = 15.4 cm, both 3 s.f.",
    build: source("1MA1_MOCK_SET_06_3H_Q15", () => {
      const e = build(
        [
          { id: "A", x: 0, y: 65 },
          { id: "B", x: 40, y: 20 },
          { id: "C", x: 135, y: 75 },
        ],
        [{ id: "T1", vertices: ["A", "B", "C"] }],
      );
      edge(e, "A", "B", "5.6");
      edge(e, "B", "C", "12.3");
      angle(e, "T1", "B", "114");
      edge(e, "A", "C", "", "blank", "15.4");
      area(e, "", "blank", "31.5");
      e.document.widthCm = 14;
      return e;
    }),
  },
  {
    key: "base-height",
    title: "Area from base and height",
    sourceId: "1MA1_JUN_2017_1F_Q15",
    source: "June 2017 1F Q15 - triangle substep",
    description:
      "Adapted triangle-only substep: perpendicular sides 8 cm and 9 cm. Area 36 cm². The full source also asks about a rectangle; its answer 13.5 cm is not this triangle's area.",
    build: source("1MA1_JUN_2017_1F_Q15", () => {
      const e = create();
      edge(e, "A", "B", "9");
      edge(e, "A", "C", "8");
      area(e, "", "blank", "36");
      return e;
    }),
  },
  {
    key: "inverse-area",
    title: "Isosceles triangle from area",
    sourceId: "1MA1_MOCK_SET_08_3H_Q20",
    source: "Mock set 8 3H Q20",
    description:
      "AB = AC = 11 cm, area = 42.5 cm². Source scheme chooses the acute apex and gives ABC = 67.7°. A calculation from bare measurements must offer both apex branches.",
    build: source("1MA1_MOCK_SET_08_3H_Q20", () => {
      const e = build(
        [
          { id: "A", x: 50, y: 0 },
          { id: "B", x: 0, y: 110 },
          { id: "C", x: 100, y: 110 },
        ],
        [{ id: "T1", vertices: ["A", "B", "C"], equalAt: "A" }],
      );
      edge(e, "A", "B", "11");
      edge(e, "A", "C", "11");
      area(e, "42.5", "value");
      angle(e, "T1", "B", "", "blank", "67.7");
      return e;
    }),
  },
  {
    key: "joined-rules",
    title: "Joined triangles: sine then cosine",
    sourceId: "1MA1_JUN_2018_3H_Q17",
    source: "June 2018 3H Q17",
    description:
      "ABD and BCD share BD. AB = 11.4 cm, CD = 12.5 cm; ABD = 86°, DBC = 109°, BCD = 34°. The concave outline is intentional. Worked AD = 13.1 cm, 3 s.f.",
    build: source("1MA1_JUN_2018_3H_Q17", () => {
      const e = build(
        [
          { id: "A", x: 55, y: 0 },
          { id: "B", x: 85, y: 65 },
          { id: "C", x: 130, y: 90 },
          { id: "D", x: 0, y: 110 },
        ],
        [
          { id: "T1", vertices: ["A", "B", "D"] },
          { id: "T2", vertices: ["B", "C", "D"] },
        ],
        "joined",
      );
      edge(e, "A", "B", "11.4");
      edge(e, "C", "D", "12.5");
      angle(e, "T1", "B", "86");
      angle(e, "T2", "B", "109");
      angle(e, "T2", "C", "34");
      edge(e, "B", "D", "", "blank", "7.39");
      edge(e, "A", "D", "", "blank", "13.1");
      return e;
    }),
  },
  {
    key: "bisector",
    title: "Split triangle: angle-bisector proof",
    sourceId: "1MA1_NOV_2021_3H_Q23",
    source: "November 2021 3H Q23",
    description:
      "D lies on BC and BAD = DAC = x°. Both displayed x labels share one stored symbol. The numerical helper does not generate a proof.",
    build: source("1MA1_NOV_2021_3H_Q23", () => {
      const e = build(
        [
          { id: "A", x: 0, y: 0 },
          { id: "B", x: 20, y: 90 },
          { id: "C", x: 140, y: 90 },
          { id: "D", x: 65, y: 90 },
        ],
        [
          { id: "T1", vertices: ["A", "B", "C"], role: "outer" },
          { id: "T2", vertices: ["A", "B", "D"] },
          { id: "T3", vertices: ["A", "D", "C"] },
        ],
        "split",
      );
      e.document.split = { point: "D", from: "B", to: "C" };
      e.document.edges.find((v) => v.id === "BC")!.draw = false;
      e.document.sharedLabels = [{ id: "bisector", text: "x" }];
      for (const t of ["T2", "T3"]) {
        angle(e, t, "A", "x", "symbol");
        const l = e.document.angles.find((a) => a.id === `${t}-A`)!.label;
        l.shared = "bisector";
        l.text = "";
      }
      return e;
    }),
  },
];
export const examples = [...teachingExamples, ...sourceExamples];
export const example = (key: string) => {
  const ex = examples.find((e) => e.key === key);
  if (!ex) throw Error("Unknown triangle example.");
  return ex.build();
};
