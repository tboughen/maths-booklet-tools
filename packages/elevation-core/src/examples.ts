import { blank, forView, panel, validate, type Envelope, type Panel } from "./index";

const make = (heights: number[][], panels: Panel[], extra: Partial<Envelope["document"]> = {}) => (worked: boolean) => {
  const e = blank();
  e.document = { ...e.document, heights, panels, ...extra };
  const v = validate(e);
  return worked ? forView(v, "answer") : v;
};

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
];

const drawn = (heights: number[][]) => () => make(heights, [panel("isometric"), panel("plan"), panel("front"), panel("side")])(false);
/** Plain shapes: simple solids of cubes with every view drawn, and one with blank grids for the views. */
export const plainShapes: { id: string; title: string; note: string; make: () => Envelope }[] = [
  { id: "row", title: "Row of cubes", note: "Four cubes in a row, with the plan, front and side elevations drawn.", make: drawn([[1, 1, 1, 1]]) },
  { id: "l-shape", title: "L-shape of cubes", note: "An L-shape of cubes, with the plan, front and side elevations drawn.", make: drawn([[2, 1, 1], [2, 0, 0]]) },
  { id: "steps", title: "Steps of cubes", note: "A staircase of cubes, with the plan, front and side elevations drawn.", make: drawn([[1, 2, 3], [1, 2, 3]]) },
  { id: "blank-views", title: "Solid with blank grids for its views", note: "A solid of cubes beside empty centimetre grids for its plan, front and side elevations.", make: () => make([[2, 1, 1], [3, 0, 0]], [panel("isometric"), panel("plan", "blank"), panel("front", "blank"), panel("side", "blank")])(false) },
];
