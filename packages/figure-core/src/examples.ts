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
