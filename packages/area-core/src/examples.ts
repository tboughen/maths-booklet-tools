import { blank, label, presetShape, starter, validate, PRESETS, PRESET_NAMES, type Envelope, type Label, type Preset } from "./index";

type Extra = Partial<Omit<Envelope["document"], "labels">>;
/** An example as pupils see it; the worked version keeps the same file with its answers saved. */
const make = (preset: Preset, labels: Label[], extra: Extra = {}) => (worked: boolean) => {
  const e = blank(preset);
  e.document = { ...e.document, ...presetShape(preset), ...extra, labels };
  const v = validate(e);
  if (!worked) for (const l of v.document.labels) l.answer = "";
  return v;
};
const given = (id: string, text: string) => label(id, text, "value");
const find = (id: string, letter: string, answer: string) => label(id, letter, letter ? "symbol" : "hidden", answer);

/**
 * Editable starting points. Pupil versions carry no saved answers; worked versions save them, so the
 * answers copy prints them in the answer colour. Answers are as typed: nothing is calculated.
 */
export const examples: { id: string; title: string; note: string; worked: boolean; make: (worked: boolean) => Envelope }[] = [
  {
    id: "l-shape",
    title: "Compound shape: area",
    note: "An L shape with four sides given. Pupils find the two missing sides and the area.",
    worked: true,
    make: make("l-shape", [given("e1", "12 cm"), given("e2", "5 cm"), find("e3", "", "7 cm"), find("e4", "", "5 cm"), given("e5", "5 cm"), given("e6", "10 cm"), find("area", "", "85 cm²")]),
  },
  {
    id: "perimeter",
    title: "Compound shape: perimeter",
    note: "A U shape with the missing lengths left blank. Pupils find the perimeter.",
    worked: true,
    make: make("u-shape", [given("e1", "14 cm"), given("e2", "9 cm"), given("e4", "5 cm"), given("e5", "5 cm"), given("e6", "5 cm"), find("area", "P", "56 cm")]),
  },
  {
    id: "trapezium",
    title: "Area of a trapezium",
    note: "Parallel sides and the perpendicular height given. Pupils find the area.",
    worked: true,
    make: make("trapezium", [given("e1", "14 cm"), given("e3", "8 cm"), given("h1", "7 cm"), find("area", "", "77 cm²")]),
  },
  {
    id: "triangle",
    title: "Area of a triangle",
    note: "Base and perpendicular height given; the slanting sides are not needed.",
    worked: true,
    make: make("triangle", [given("e1", "16 cm"), given("h1", "10 cm"), given("e2", "13 cm"), find("area", "", "80 cm²")]),
  },
  {
    id: "rectangle-semicircle",
    title: "Rectangle and semicircle",
    note: "A semicircle on the end of a rectangle. Pupils find the area in terms of π.",
    worked: true,
    make: make("rectangle-semicircle", [given("e1", "10 cm"), given("e4", "8 cm"), find("area", "", "80 + 8π cm²")]),
  },
  {
    id: "frame",
    title: "Shaded frame",
    note: "A rectangle with a rectangular hole. Pupils find the shaded area.",
    worked: true,
    make: make("frame", [given("e1", "20 cm"), given("e2", "13 cm"), given("hw", "14 cm"), given("hh", "7 cm"), find("area", "", "162 cm²")]),
  },
  {
    id: "circle",
    title: "Circle: area and circumference",
    note: "A circle with its radius given. Answers saved in terms of π.",
    worked: true,
    make: make("circle", [given("r", "6 cm"), find("arc", "", "12π cm"), find("area", "", "36π cm²")]),
  },
  {
    id: "semicircle",
    title: "Semicircle: arc length",
    note: "A semicircle with its diameter given. Pupils find the length of the arc to 1 decimal place.",
    worked: true,
    make: make("semicircle", [given("d", "12 cm"), find("arc", "", "18.8 cm")]),
  },
  {
    id: "sector",
    title: "Sector: arc length and area",
    note: "A sector with radius and angle given. Pupils find the arc length.",
    worked: true,
    make: make("sector", [given("r", "9 cm"), given("angle", "110"), find("arc", "", "17.3 cm")]),
  },
  {
    id: "grid",
    title: "Counting squares",
    note: "An L shape on a centimetre grid at true size. Pupils count squares for the area.",
    worked: true,
    make: make("l-shape", [find("area", "", "10 cm²")], {
      shape: { type: "polygon", corners: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 20 }, { x: 20, y: 20 }, { x: 20, y: 30 }, { x: 0, y: 30 }], arcs: ["none", "none", "none", "none", "none", "none"], heights: [], rightAngles: [] },
      grid: true,
      notToScale: false,
    }),
  },
];

/** A four-sided shape drawn from its corners (mm), with its sides labelled in order. */
function quadrilateral(corners: [number, number][], sides: string[]): Envelope {
  const e = blank("rectangle");
  e.document.shape = { type: "polygon", corners: corners.map(([x, y]) => ({ x, y })), arcs: corners.map(() => "none" as const), heights: [], rightAngles: [] };
  e.document.labels = sides.flatMap((text, i) => (text ? [given(`e${i + 1}`, text)] : []));
  return validate(e);
}
const PLAIN_NOTES: Record<Preset, string> = {
  rectangle: "A rectangle with its length and width given.",
  "l-shape": "An L shape with four of its sides given.",
  "t-shape": "A T shape with four of its sides given.",
  "u-shape": "A U shape with four of its sides given.",
  triangle: "A triangle with its base and perpendicular height given.",
  parallelogram: "A parallelogram with its base and perpendicular height given.",
  trapezium: "A trapezium with its parallel sides and height given.",
  house: "A rectangle with a triangle on top.",
  "rectangle-semicircle": "A rectangle with a semicircle on one end.",
  "rectangle-cut": "A rectangle with a semicircle cut out of one side.",
  frame: "A rectangle with a smaller rectangle inside it, the frame shaded.",
  circle: "A circle with its radius given.",
  semicircle: "A semicircle with its diameter given.",
  quarter: "A quarter circle with its radius given.",
  sector: "A sector with its radius and angle given.",
};

/** Plain shapes: every built-in shape with typical lengths given, then a kite and a rhombus. */
export const plainShapes: { id: string; title: string; note: string; make: () => Envelope }[] = [
  ...PRESETS.map((p) => ({ id: p, title: PRESET_NAMES[p], note: PLAIN_NOTES[p], make: () => starter(p) })),
  { id: "kite", title: "Kite", note: "A kite with its two pairs of equal sides given.", make: () => quadrilateral([[30, 0], [55, 30], [30, 70], [5, 30]], ["7 cm", "6 cm"]) },
  { id: "rhombus", title: "Rhombus", note: "A rhombus with one side given.", make: () => quadrilateral([[0, 0], [40, 0], [64, 32], [24, 32]], ["8 cm"]) },
];
