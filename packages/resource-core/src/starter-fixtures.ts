import { blank, label, presetShape, validate as validateArea, type Label, type Preset } from "../../area-core/src/index";
import type { Card } from "./schema";
import type { StarterRun } from "./starter";

/** An area-tool shape with its lengths given, as pupils see it (no saved answers). */
/** Drawn at `scale` of the preset's size: a starter slot is small, and labels stay at full size. */
function shape(preset: Preset, labels: [string, string][], scale = 0.5) {
  const e = blank(preset);
  const start = presetShape(preset);
  const shrink = start.shape.type === "polygon" ? { ...start.shape, corners: start.shape.corners.map((c) => ({ x: c.x * scale, y: c.y * scale })) } : start.shape;
  e.document = { ...e.document, ...start, shape: shrink, notToScale: false, labels: labels.map(([id, t]): Label => label(id, t, "value")) };
  return { type: "diagram" as const, diagram: { tool: "area" as const, envelope: validateArea(e) } };
}
const fraction = (a: number, b: number, op: string, c: number, d: number) => `{${a}/${b}} ${op} {${c}/${d}}`;
const answer = (text = "") => ({ type: "answerLine" as const, prefix: "", suffix: "", answer: text, inline: false });

/**
 * Tim's Year 9 run (18 Nov 2026): four core questions and two extension, in six starters whose
 * numbers move a little each time. Every answer is typed, never calculated.
 */
function year9Starter(i: number): Card[] {
  const mult = [[2, 3, 1, 4], [3, 5, 1, 2], [3, 4, 2, 7], [2, 5, 3, 8], [4, 9, 3, 10], [5, 6, 9, 10]][i];
  const add = [[1, 7, 3, 7], [2, 9, 4, 9], [2, 9, 5, 9], [3, 10, 1, 5], [1, 4, 2, 3], [2, 5, 3, 7]][i];
  const rect = [[8, 5], [7, 4], [9, 6], [12, 7], [8.5, 6], [11.5, 4.5]][i];
  const expand = [[2, 3], [3, 4], [2, 5], [4, 6], [3, 2], [5, 3]][i];
  const simplify = ["(2x + 1)(x + 3)", "(2x + 3)(x + 1)", "(2x + 3)(x + 4)", "(3x + 2)(x + 5)", "(3x − 1)(2x + 4)", "(2x − 3)(3x − 2)"][i];
  return [
    { title: "Multiply:", items: [{ type: "text", text: fraction(mult[0], mult[1], "×", mult[2], mult[3]) }, { type: "space", kind: "working", heightMm: 8 }] },
    { title: "Add:", items: [{ type: "text", text: fraction(add[0], add[1], "+", add[2], add[3]) }, { type: "space", kind: "working", heightMm: 8 }] },
    { title: "Find the perimeter.", items: [{ type: "text", text: `A rectangle is ${rect[0]} cm by ${rect[1]} cm.` }, { type: "space", kind: "working", heightMm: 8 }, { ...answer(), suffix: "cm" }] },
    { title: "Expand:", items: [{ type: "text", text: `(x + ${expand[0]})(x + ${expand[1]})` }, { type: "space", kind: "working", heightMm: 8 }, answer()] },
    { title: "Find the area.", items: [shape("l-shape", [["e1", `${12 + (i % 3)} cm`], ["e2", "5 cm"], ["e5", "5 cm"], ["e6", "10 cm"]], 0.36), { ...answer(), suffix: "cm²" }] },
    { title: "Expand and simplify:", items: [{ type: "text", text: simplify }, { type: "space", kind: "working", heightMm: 8 }, answer()] },
  ];
}

export const year9Run: StarterRun = {
  tool: "resource",
  schemaVersion: 1,
  document: {
    kind: "starter-run",
    title: "Year 9 fractions, perimeter and expanding",
    group: "Year 9",
    topic: "Fractions, area and expanding",
    template: "core-extension",
    notation: "maths",
    slots: [
      { name: "Multiply fractions", icon: "none" },
      { name: "Add fractions", icon: "none" },
      { name: "Perimeter of a rectangle", icon: "none" },
      { name: "Expand two brackets", icon: "none" },
      { name: "Compound area", icon: "none" },
      { name: "Expand and simplify", icon: "none" },
    ],
    starters: [0, 1, 2, 3, 4, 5].map((i) => ({ cards: year9Starter(i) })),
    logo: null,
  },
};

/** Tim's Year 8 starter (area and estimation) on the four-question template with its icons. */
export const year8Run: StarterRun = {
  tool: "resource",
  schemaVersion: 1,
  document: {
    kind: "starter-run",
    title: "Year 8 area",
    group: "Year 8",
    topic: "Area and estimation",
    template: "four",
    notation: "maths",
    slots: [
      { name: "", icon: "pencil" },
      { name: "", icon: "talk" },
      { name: "", icon: "book" },
      { name: "", icon: "puzzle" },
    ],
    starters: [
      {
        cards: [
          { title: "Choose the correct area.", items: [shape("parallelogram", [["e1", "9 cm"], ["h1", "6 cm"], ["e2", "5 cm"]]), { type: "choice", mode: "circle", options: ["45 cm", "54 cm", "45 cm²", "54 cm²"], answer: null }] },
          { title: "Amy says:", items: [{ type: "claim", text: "The perimeter of a 15 cm by 10 cm rectangle is 150 cm²." }, { type: "text", text: "Is she correct? Explain." }, { type: "space", kind: "working", heightMm: 10 }] },
          { title: "Estimate:", items: [{ type: "text", text: "9.81 × 0.52" }, { type: "space", kind: "working", heightMm: 10 }, answer()] },
          { title: "Find the surface area.", items: [{ type: "text", text: "A cuboid is 4 cm by 3 cm by 2 cm." }, { type: "space", kind: "working", heightMm: 10 }, { ...answer(), suffix: "cm²" }] },
        ],
      },
    ],
    logo: null,
  },
};
