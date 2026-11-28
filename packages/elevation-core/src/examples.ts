import { blank, forView, panel, validate, type Envelope, type LengthLabel, type Panel, type Shape } from "./index";

const make = (heights: number[][], panels: Panel[], extra: Partial<Envelope["document"]> = {}) => (worked: boolean) => {
  const e = blank();
  e.document = { ...e.document, heights, panels, ...extra };
  const v = validate(e);
  return worked ? forView(v, "answer") : v;
};

/** A solid built from shapes, with its panels and any lengths on the 3D drawing. */
const fromShapes = (shapes: Shape[], panels: Panel[], lengths: LengthLabel[] = [], extra: Partial<Envelope["document"]> = {}) => (worked: boolean) => {
  const e = blank();
  const { heights: _cubes, ...rest } = e.document;
  void _cubes;
  e.document = { ...rest, shapes, panels, ...(lengths.length ? { lengths } : {}), ...extra };
  const v = validate(e);
  return worked ? forView(v, "answer") : v;
};
const at = (x: number, y: number, z: number) => ({ x, y, z });
const len = (a: [number, number, number], b: [number, number, number], text: string): LengthLabel => ({ a: at(...a), b: at(...b), text, show: "show" });
const trapeziumPrism: Shape = { type: "prism", at: at(0, 0, 0), section: [[0, 0], [6, 0], [6, 3], [2, 3]], axis: "y", length: 4 };
const lPrism: Shape = { type: "prism", at: at(0, 0, 0), section: [[0, 0], [5, 0], [5, 2], [2, 2], [2, 4], [0, 4]], axis: "y", length: 3 };
const cylinder: Shape = { type: "cylinder", at: at(2, 2, 0), r: 2, h: 5, axis: "z" };
const roofHouse: Shape[] = [
  { type: "prism", at: at(0, 0, 0), section: [[0, 0], [4, 0], [4, 4], [0, 4]], axis: "y", length: 4 },
  { type: "pyramid", at: at(0, 0, 4), base: [[0, 0], [4, 0], [4, 4], [0, 4]], apex: at(2, 2, 3) },
];

/** Editable starting points. The bank has no cube-solid plan question yet (its prism questions need a later tool). */
export const examples: { id: string; title: string; note: string; sourceId?: string; worked: boolean; make: (worked: boolean) => Envelope }[] = [
  {
    id: "draw-views",
    title: "Draw the plan and elevations",
    note: "Six cubes. Pupils draw the plan, front elevation and side elevation on the centimetre grids; the views are saved answers.",
    worked: true,
    make: make([[2, 1, 1], [3, 0, 0]], [panel("isometric"), panel("plan", "answer"), panel("front", "answer"), panel("side", "answer")]),
  },
  {
    id: "draw-solid",
    title: "Draw the solid from its views",
    note: "The plan and elevations are given. Pupils draw the solid on isometric paper; the drawing is the saved answer.",
    worked: true,
    make: make([[3, 2, 1, 1], [2, 1, 0, 1], [1, 0, 0, 2]], [panel("plan"), panel("front"), panel("side"), panel("isometric", "answer")]),
  },
  {
    id: "steps",
    title: "Steps: match the views",
    note: "A staircase of 12 cubes. The front elevation is given; pupils draw the plan and side elevation.",
    worked: true,
    make: make([[1, 2, 3], [1, 2, 3]], [panel("isometric"), panel("front"), panel("plan", "answer"), panel("side", "answer")]),
  },
  {
    id: "scale-2cm",
    title: "Elevations at 2 cm to one cube",
    note: "Pupils draw the front and side elevations with each cube edge 2 cm long.",
    worked: true,
    make: make([[2, 2], [1, 0]], [panel("isometric"), panel("front", "answer"), panel("side", "answer")], { unitCm: 2 }),
  },
  {
    id: "prism-elevations",
    title: "Front and side elevations of a prism",
    note: "A prism with a trapezium cross-section, its lengths given. Pupils draw the front and side elevations on centimetre squares; the views are saved answers.",
    worked: true,
    make: fromShapes(
      [trapeziumPrism],
      [panel("isometric"), panel("front", "answer"), panel("side", "answer")],
      [len([0, 0, 0], [6, 0, 0], "6 cm"), len([6, 0, 0], [6, 0, 3], "3 cm"), len([2, 0, 3], [6, 0, 3], "4 cm"), len([6, 0, 3], [6, 4, 3], "4 cm")],
    ),
  },
  {
    id: "prism-side-elevation",
    title: "Side elevation from the plan and front elevation",
    note: "An L-shaped prism. The plan and front elevation are given; pupils draw the side elevation.",
    worked: true,
    make: fromShapes([lPrism], [panel("plan"), panel("front"), panel("side", "answer")]),
  },
  {
    id: "cylinder-views",
    title: "A cylinder from its plan and front elevation",
    note: "The plan and front elevation of a cylinder on centimetre squares. Pupils read its radius and height, then sketch the cylinder (the sketch is the saved answer).",
    worked: true,
    make: fromShapes([cylinder], [panel("plan"), panel("front"), panel("isometric", "answer")]),
  },
  {
    id: "pyramid-roof-plan",
    title: "Plan of a cube with a pyramid roof",
    note: "A cube with a square-based pyramid on top. Pupils draw the plan and front elevation; both are saved answers.",
    worked: true,
    make: fromShapes(roofHouse, [panel("isometric"), panel("plan", "answer"), panel("front", "answer")], [len([0, 0, 0], [4, 0, 0], "4 cm")]),
  },
];

const drawn = (heights: number[][]) => () => make(heights, [panel("isometric"), panel("plan"), panel("front"), panel("side")])(false);
/** Plain shapes: simple solids of cubes with every view drawn, and one with blank grids for the views. */
const drawnShapes = (shapes: Shape[]) => () => fromShapes(shapes, [panel("isometric"), panel("plan"), panel("front"), panel("side")])(false);
export const plainShapes: { id: string; title: string; note: string; make: () => Envelope }[] = [
  { id: "triangular-prism", title: "Triangular prism: plan and elevations", note: "A triangular prism, with the plan, front and side elevations drawn.", make: drawnShapes([{ type: "prism", at: at(0, 0, 0), section: [[0, 0], [4, 0], [2, 3]], axis: "y", length: 5 }]) },
  { id: "cylinder", title: "Cylinder: plan and elevations", note: "An upright cylinder, with the plan, front and side elevations drawn.", make: drawnShapes([cylinder]) },
  { id: "cone", title: "Cone: plan and elevations", note: "An upright cone, with the plan (a circle with its apex marked), front and side elevations drawn.", make: drawnShapes([{ type: "cone", at: at(2, 2, 0), r: 2, h: 4, axis: "z" }]) },
  { id: "square-pyramid", title: "Square-based pyramid: plan and elevations", note: "A square-based pyramid, with the plan, front and side elevations drawn.", make: drawnShapes([{ type: "pyramid", at: at(0, 0, 0), base: [[0, 0], [4, 0], [4, 4], [0, 4]], apex: at(2, 2, 3) }]) },
  { id: "row", title: "Row of cubes", note: "Four cubes in a row, with the plan, front and side elevations drawn.", make: drawn([[1, 1, 1, 1]]) },
  { id: "l-shape", title: "L-shape of cubes", note: "An L-shape of cubes, with the plan, front and side elevations drawn.", make: drawn([[2, 1, 1], [2, 0, 0]]) },
  { id: "steps", title: "Steps of cubes", note: "A staircase of cubes, with the plan, front and side elevations drawn.", make: drawn([[1, 2, 3], [1, 2, 3]]) },
  { id: "blank-views", title: "Solid with blank grids for its views", note: "A solid of cubes beside empty centimetre grids for its plan, front and side elevations.", make: () => make([[2, 1, 1], [3, 0, 0]], [panel("isometric"), panel("plan", "blank"), panel("front", "blank"), panel("side", "blank")])(false) },
];
