import { angle, blank, free, label, on, point, segment, validate, type Envelope, type FigureDocument } from "./index";

/**
 * Editable starting points, each redrawn from a real Question Bank question (sourceId) in the same
 * layout. Worked versions add only answers copied from that question's mark scheme; nothing is
 * calculated. The question's words stay in the question; the figure carries only what the paper's diagram
 * shows.
 */
type Build = (d: FigureDocument) => void;
/** An example as pupils see it; worked adds the mark scheme's answers as hidden labels, printed only on the answers copy. */
const make = (build: Build, answers?: Build) => (worked = false) => {
  const e = blank();
  e.document.points = [];
  build(e.document);
  if (worked && answers) answers(e.document);
  return validate(e);
};
const hidden = (answer: string) => label("", "hidden", answer);
const v = (text: string) => label(text, "value");
const s = (text: string) => label(text, "symbol");

export const examples: { id: string; title: string; note: string; sourceId: string; worked: boolean; make: (worked?: boolean) => Envelope }[] = [
  {
    id: "tangent-cyclic",
    title: "Tangent and cyclic quadrilateral",
    note: "A, B, C and D on a circle with the tangent SBT and angle ABD given.",
    sourceId: "1MA1_NOV_2021_2H_Q14",
    worked: true,
    make: make((d) => {
      d.circles = [{ id: "c", centre: "o", r: 26, style: "solid" }];
      d.points = [
        point("o", free(0, 0)),
        point("a", on("c", 145), "A"),
        point("b", on("c", 90), "B"),
        point("c1", on("c", 305), "C"),
        point("d", on("c", 228), "D"),
        point("s", { type: "tangent", at: "b", mm: 36 }, "S"),
        point("t", { type: "tangent", at: "b", mm: -44 }, "T"),
      ];
      d.segments = [segment("st", "s", "t"), segment("ab", "a", "b"), segment("bc", "b", "c1"), segment("cd", "c1", "d"), segment("da", "d", "a"), segment("bd", "b", "d")];
      d.angles = [angle("abd", "b", "a", "d", v("20"))];
    }, (d) => {
      // Mark scheme: SBA = 25.
      d.angles.push(angle("sba", "b", "s", "a", hidden("25"), "none"));
    }),
  },
  {
    id: "two-tangents",
    title: "Two tangents from a point",
    note: "Tangents DA and DC to a circle of radius 5 cm, centre O, with OD dashed.",
    sourceId: "1MA1_JUN_2017_3H_Q18",
    worked: false,
    make: make((d) => {
      d.circles = [{ id: "c", centre: "o", r: 18, style: "solid" }];
      d.points = [
        point("o", free(0, 0), "O"),
        point("a", on("c", 60), "A"),
        point("c1", on("c", 300), "C"),
        point("b", on("c", 180), "B"),
        point("d", { type: "tangents", a: "a", b: "c1" }, "D"),
      ];
      d.segments = [segment("oa", "o", "a", v("5 cm")), segment("oc", "o", "c1", v("5 cm")), segment("ad", "a", "d"), segment("cd", "c1", "d"), segment("od", "o", "d", undefined, { style: "dashed" })];
    }),
  },
  {
    id: "centre-angle",
    title: "Angle at the centre",
    note: "A, B, C and D on a circle, centre O, with angle AOC = x°.",
    sourceId: "1MA1_MOCK_SET_08_2H_Q13",
    worked: true,
    make: make((d) => {
      d.circles = [{ id: "c", centre: "o", r: 30, style: "solid" }];
      d.points = [
        point("o", free(0, 0), "O", "dot"),
        point("a", on("c", 100), "A"),
        point("b", on("c", 160), "B"),
        point("c1", on("c", 235), "C"),
        point("d", on("c", 345), "D"),
      ];
      d.segments = [segment("ab", "a", "b"), segment("bc", "b", "c1"), segment("cd", "c1", "d"), segment("da", "d", "a"), segment("oa", "o", "a"), segment("oc", "o", "c1")];
      d.angles = [angle("aoc", "o", "a", "c1", s("x"))];
    }, (d) => {
      // Mark scheme: angle ABC = 180 − ½x.
      d.angles.push(angle("abc", "b", "c1", "a", hidden("180 - 1/2x"), "none"));
    }),
  },
  {
    id: "similar-right",
    title: "Similar right-angled triangles",
    note: "ABC and PQR are similar: matching angles carry matching arcs.",
    sourceId: "1MA1_MOCK_SET_05_3H_Q2",
    worked: true,
    make: make((d) => {
      d.points = [
        point("a", free(0, 0), "A"),
        point("c1", free(28, 0), "C"),
        point("b", free(28, 16), "B"),
        point("p", free(52, 0), "P"),
        point("r", free(122, 0), "R"),
        point("q", free(122, 40), "Q"),
      ];
      d.segments = [segment("ab", "a", "b", v("9 cm")), segment("bc", "b", "c1"), segment("ca", "c1", "a"), segment("pq", "p", "q"), segment("qr", "q", "r", v("18 cm")), segment("rp", "r", "p")];
      d.angles = [
        angle("a", "a", "c1", "b"),
        angle("bb", "b", "a", "c1", label(), "double"),
        angle("cc", "c1", "b", "a", label(), "right"),
        angle("p", "p", "r", "q"),
        angle("qq", "q", "p", "r", label(), "double"),
        angle("rr", "r", "q", "p", label(), "right"),
      ];
    }, (d) => {
      // Mark scheme: PQ = 22.5, BC = 7.2.
      d.segments.find((x) => x.id === "pq")!.label = hidden("22.5 cm");
      d.segments.find((x) => x.id === "bc")!.label = hidden("7.2 cm");
    }),
  },
  {
    id: "parallel-in-triangle",
    title: "Parallel lines in a triangle",
    note: "ABC and EDC are straight lines and EA is parallel to DB.",
    sourceId: "1MA1_JUN_2017_2H_Q5",
    worked: false,
    make: make((d) => {
      d.points = [
        point("e", free(0, 0), "E"),
        point("c1", free(96, 0), "C"),
        point("a", free(36, 36), "A"),
        point("dd", { type: "along", a: "c1", b: "e", t: 0.67 }, "D"),
        point("b", { type: "along", a: "c1", b: "a", t: 0.67 }, "B"),
      ];
      d.segments = [segment("ea", "e", "a", undefined, { arrows: 1 }), segment("ac", "a", "c1"), segment("ec", "e", "c1"), segment("db", "dd", "b", undefined, { arrows: 1 })];
    }),
  },
  {
    id: "congruent-four",
    title: "Which triangles are congruent?",
    note: "Four triangles, each with two angles and a side or two sides and an angle given.",
    sourceId: "1MA1_NOV_2020_1H_Q4",
    worked: false,
    make: make((d) => {
      d.points = [
        point("a1", free(0, 40), ""),
        point("a2", free(36, 40), ""),
        point("a3", free(13, 62), ""),
        point("b1", free(56, 46), ""),
        point("b2", free(88, 40), ""),
        point("b3", free(90, 66), ""),
        point("c1", free(4, -10), ""),
        point("c2", free(34, -10), ""),
        point("c3", free(30, 14), ""),
        point("d1", free(64, -6), ""),
        point("d2", free(92, -10), ""),
        point("d3", free(80, 20), ""),
      ];
      d.segments = [
        segment("a12", "a1", "a2", v("10 cm")),
        segment("a23", "a2", "a3"),
        segment("a31", "a3", "a1"),
        segment("b12", "b1", "b2", v("8 cm")),
        segment("b23", "b2", "b3", v("10 cm")),
        segment("b31", "b3", "b1"),
        segment("c12", "c1", "c2", v("10 cm")),
        segment("c23", "c2", "c3", v("8 cm")),
        segment("c31", "c3", "c1"),
        segment("d12", "d1", "d2"),
        segment("d23", "d2", "d3", v("10 cm")),
        segment("d31", "d3", "d1"),
      ];
      d.angles = [
        angle("a1", "a1", "a2", "a3", v("55")),
        angle("a2", "a2", "a3", "a1", v("45")),
        angle("b1", "b1", "b2", "b3", v("45")),
        angle("c3", "c3", "c1", "c2", v("55")),
        angle("d3", "d3", "d1", "d2", v("45")),
        angle("d1", "d1", "d2", "d3", v("80")),
      ];
      d.captions = [
        { id: "ca", x: 18, y: 32, text: "Triangle A", bold: false },
        { id: "cb", x: 76, y: 32, text: "Triangle B", bold: false },
        { id: "cc", x: 19, y: -19, text: "Triangle C", bold: false },
        { id: "cd", x: 78, y: -19, text: "Triangle D", bold: false },
      ];
    }),
  },
];

const plain = (build: Build) => () => make(build)(false);
/** Plain shapes: the common circle-theorem and similarity figures, ready to label. */
export const plainShapes: { id: string; title: string; note: string; make: () => Envelope }[] = [
  {
    id: "chord",
    title: "Circle with a chord",
    note: "A circle, centre O, with a chord AB and the radii OA and OB.",
    make: plain((d) => {
      d.circles = [{ id: "c", centre: "o", r: 28, style: "solid" }];
      d.points = [point("o", free(0, 0), "O", "dot"), point("a", on("c", 200), "A"), point("b", on("c", 340), "B")];
      d.segments = [segment("ab", "a", "b"), segment("oa", "o", "a"), segment("ob", "o", "b")];
    }),
  },
  {
    id: "tangent-radius",
    title: "Tangent and radius",
    note: "A tangent touching a circle at A, with the radius OA meeting it at a right angle.",
    make: plain((d) => {
      d.circles = [{ id: "c", centre: "o", r: 24, style: "solid" }];
      d.points = [point("o", free(0, 0), "O", "dot"), point("a", on("c", 270), "A"), point("s", { type: "tangent", at: "a", mm: -36 }, "S"), point("t", { type: "tangent", at: "a", mm: 36 }, "T")];
      d.segments = [segment("st", "s", "t"), segment("oa", "o", "a")];
      d.angles = [angle("oat", "a", "t", "o", label(), "right")];
    }),
  },
  {
    id: "two-tangents",
    title: "Two tangents from a point",
    note: "Tangents PA and PB from a point P outside a circle, centre O.",
    make: plain((d) => {
      d.circles = [{ id: "c", centre: "o", r: 18, style: "solid" }];
      d.points = [point("o", free(0, 0), "O", "dot"), point("a", on("c", 60), "A"), point("b", on("c", 300), "B"), point("p", { type: "tangents", a: "a", b: "b" }, "P")];
      d.segments = [segment("pa", "p", "a"), segment("pb", "p", "b"), segment("oa", "o", "a"), segment("ob", "o", "b")];
    }),
  },
  {
    id: "centre-angle",
    title: "Angle at the centre",
    note: "The angle at the centre AOB and the angle at the circumference ACB, standing on the same arc.",
    make: plain((d) => {
      d.circles = [{ id: "c", centre: "o", r: 30, style: "solid" }];
      d.points = [point("o", free(0, 0), "O", "dot"), point("a", on("c", 210), "A"), point("b", on("c", 330), "B"), point("c1", on("c", 95), "C")];
      d.segments = [segment("oa", "o", "a"), segment("ob", "o", "b"), segment("ca", "c1", "a"), segment("cb", "c1", "b")];
      d.angles = [angle("aob", "o", "a", "b", s("x")), angle("acb", "c1", "a", "b", s("y"))];
    }),
  },
  {
    id: "same-segment",
    title: "Angles in the same segment",
    note: "Angles ACB and ADB standing on the same chord AB.",
    make: plain((d) => {
      d.circles = [{ id: "c", centre: "o", r: 30, style: "solid" }];
      d.points = [point("o", free(0, 0)), point("a", on("c", 200), "A"), point("b", on("c", 340), "B"), point("c1", on("c", 70), "C"), point("dd", on("c", 125), "D")];
      d.segments = [segment("ca", "c1", "a"), segment("cb", "c1", "b"), segment("da", "dd", "a"), segment("db", "dd", "b")];
      d.angles = [angle("acb", "c1", "a", "b", s("x")), angle("adb", "dd", "a", "b", s("y"))];
    }),
  },
  {
    id: "cyclic-quadrilateral",
    title: "Cyclic quadrilateral",
    note: "A quadrilateral ABCD with all four corners on a circle.",
    make: plain((d) => {
      d.circles = [{ id: "c", centre: "o", r: 30, style: "solid" }];
      d.points = [point("o", free(0, 0)), point("a", on("c", 110), "A"), point("b", on("c", 20), "B"), point("c1", on("c", 290), "C"), point("dd", on("c", 200), "D")];
      d.segments = [segment("ab", "a", "b"), segment("bc", "b", "c1"), segment("cd", "c1", "dd"), segment("da", "dd", "a")];
      d.angles = [angle("a", "a", "dd", "b", s("x")), angle("c", "c1", "b", "dd", s("y"))];
    }),
  },
  {
    id: "similar-triangles",
    title: "Similar triangles",
    note: "Two similar triangles, matching angles marked alike.",
    make: plain((d) => {
      d.points = [point("a", free(0, 0), "A"), point("b", free(36, 0), "B"), point("c1", free(10, 24), "C"), point("p", free(54, 0), "P"), point("q", free(108, 0), "Q"), point("r", free(69, 36), "R")];
      d.segments = [segment("ab", "a", "b", v("6 cm")), segment("bc", "b", "c1"), segment("ca", "c1", "a", v("4 cm")), segment("pq", "p", "q", v("9 cm")), segment("qr", "q", "r"), segment("rp", "r", "p", s("x"))];
      d.angles = [angle("a", "a", "b", "c1"), angle("b", "b", "c1", "a", label(), "double"), angle("p", "p", "q", "r"), angle("q", "q", "r", "p", label(), "double")];
    }),
  },
  {
    id: "congruent-triangles",
    title: "Congruent triangles",
    note: "Two congruent triangles, equal sides marked with matching ticks.",
    make: plain((d) => {
      d.points = [point("a", free(0, 0), "A"), point("b", free(40, 0), "B"), point("c1", free(12, 28), "C"), point("p", free(56, 0), "P"), point("q", free(96, 0), "Q"), point("r", free(68, 28), "R")];
      d.segments = [
        segment("ab", "a", "b", label(), { ticks: 1 }), segment("bc", "b", "c1", label(), { ticks: 2 }), segment("ca", "c1", "a", label(), { ticks: 3 }),
        segment("pq", "p", "q", label(), { ticks: 1 }), segment("qr", "q", "r", label(), { ticks: 2 }), segment("rp", "r", "p", label(), { ticks: 3 }),
      ];
    }),
  },
  {
    id: "parallelogram-diagonal",
    title: "Parallelogram with a diagonal",
    note: "A parallelogram ABCD with its diagonal AC, parallel sides arrowed, for a congruence proof.",
    make: plain((d) => {
      d.points = [point("a", free(0, 0), "A"), point("b", free(60, 0), "B"), point("c1", free(80, 32), "C"), point("dd", free(20, 32), "D")];
      d.segments = [segment("ab", "a", "b", label(), { arrows: 1 }), segment("bc", "b", "c1", label(), { arrows: 2 }), segment("dc", "dd", "c1", label(), { arrows: 1 }), segment("ad", "a", "dd", label(), { arrows: 2 }), segment("ac", "a", "c1", label(), { style: "dashed" })];
    }),
  },
];
