/**
 * Plain shapes for the tools whose galleries are built in src/examples (graph, ratio tables,
 * plotting quadratics, expanding and factorising): simple, common versions with the given values,
 * shown before the exam-style examples. Nothing is calculated for pupils and no answers are filled.
 */
import type { DiagramDocumentV1, GraphObject } from "../domain/types";
import { createRatioTable, type RatioEnvelope } from "../../packages/ratio-table-core/src/interchange";
import { apply, defaultEnvelope, type Equation, type ValueEnvelope } from "../../packages/value-graph-core/src/interchange";
import { example as algebraExample, type Envelope as AlgebraEnvelope } from "../../packages/algebra-grid-core/src";

interface Plain<T> {
  id: string;
  title: string;
  note: string;
  make: () => T;
}

function axes(xNegative: number, xPositive: number, yNegative: number, yPositive: number, objects: GraphObject[] = []): DiagramDocumentV1 {
  return {
    version: 1,
    styleProfile: "portable-v1",
    axes: {
      x: { negativeSquares: xNegative, positiveSquares: xPositive, unitsPerSquare: 1 },
      y: { negativeSquares: yNegative, positiveSquares: yPositive, unitsPerSquare: 1 },
    },
    objects,
  };
}
const line = (id: string, start: [number, number], end: [number, number], more: Partial<GraphObject> = {}): GraphObject =>
  ({
    id,
    kind: "straight",
    display: "line",
    strokeStyle: "solid",
    start: { x: start[0], y: start[1] },
    end: { x: end[0], y: end[1] },
    equationVisible: false,
    ...more,
  }) as GraphObject;

export const plainGraphs: Plain<DiagramDocumentV1>[] = [
  { id: "axes", title: "Blank axes −5 to 5", note: "x and y axes from −5 to 5 on centimetre squares.", make: () => axes(5, 5, 5, 5) },
  { id: "first-quadrant", title: "Blank axes 0 to 10", note: "The first quadrant only, from 0 to 10 on both axes.", make: () => axes(0, 10, 0, 10) },
  { id: "straight-line", title: "Straight line y = 2x + 1", note: "The line y = 2x + 1 drawn on axes from −5 to 5, its equation not printed.", make: () => axes(5, 5, 5, 5, [line("l1", [-3, -5], [2, 5])]) },
  {
    id: "two-lines",
    title: "Two lines crossing",
    note: "y = x + 1 and y = 5 − x crossing, for simultaneous equations.",
    make: () => axes(5, 5, 5, 5, [line("l1", [-5, -4], [4, 5]), line("l2", [0, 5], [5, 0])]),
  },
  {
    id: "gradient-triangle",
    title: "Gradient triangle on a line",
    note: "The line y = 2x − 1 with a gradient triangle, its run and rise left as answer spaces.",
    make: () => axes(5, 5, 5, 5, [line("l1", [-2, -5], [3, 5], { gradientTriangle: { x: 1, run: 2, labels: "blank" } } as Partial<GraphObject>)]),
  },
  {
    id: "shape",
    title: "Shape to transform",
    note: "Triangle A on axes from −6 to 6, to reflect, rotate, enlarge or translate.",
    make: () => axes(6, 6, 6, 6, [{ id: "a", kind: "polygon", name: "A", vertices: [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 1, y: 4 }], shaded: true }]),
  },
  {
    id: "region",
    title: "Inequality region",
    note: "The region y ≥ 1, x < 4 and y ≤ x + 1 shaded, with its boundary lines.",
    make: () => axes(5, 5, 5, 5, [{ id: "r", kind: "region", name: "R", inequalities: ["y ≥ 1", "x < 4", "y ≤ x + 1"], shade: "wanted", boundaries: true }]),
  },
];

const number = (value: string) => ({ kind: "number" as const, value });
const answer = () => ({ kind: "answer-line" as const });
const heading = (text: string) => ({ text, italic: false, direction: "none" as const });
export const plainRatioTables: Plain<RatioEnvelope>[] = [
  {
    id: "multiplier",
    title: "Two columns with a multiplier",
    note: "3 and 12 scaled up by × 3, with answer lines for the new row.",
    make: () =>
      createRatioTable({
        rows: [
          { id: "row-1", cells: [number("3"), number("12")] },
          { id: "row-2", cells: [number("9"), answer()] },
        ],
        mode: "annotated",
        transitions: [{ from: "row-1", to: "row-2", operation: "multiply", factor: "3" }],
      }),
  },
  {
    id: "unitary",
    title: "Unitary method",
    note: "6 pens cost £9: scale down to 1 pen, then up to 4 pens.",
    make: () =>
      createRatioTable({
        headings: [heading("Pens"), heading("Cost (£)")],
        rows: [
          { id: "row-1", cells: [number("6"), number("9")] },
          { id: "row-2", cells: [number("1"), answer()] },
          { id: "row-3", cells: [number("4"), answer()] },
        ],
        mode: "annotated",
        transitions: [
          { from: "row-1", to: "row-2", operation: "divide", factor: "6" },
          { from: "row-2", to: "row-3", operation: "multiply", factor: "4" },
        ],
      }),
  },
  {
    id: "recipe",
    title: "Recipe",
    note: "A recipe for 4 people with two ingredients, scaled for 10 people.",
    make: () =>
      createRatioTable({
        headings: [heading("People"), heading("Flour (g)"), heading("Sugar (g)")],
        rows: [
          { id: "row-1", cells: [number("4"), number("200"), number("150")] },
          { id: "row-2", cells: [number("10"), answer(), answer()] },
        ],
        mode: "simple",
        transitions: [],
      }),
  },
  {
    id: "best-buy",
    title: "Best buy",
    note: "Two sizes of the same product, 500 g for 240p and 750 g for 330p, to compare.",
    make: () =>
      createRatioTable({
        headings: [heading("Mass (g)"), heading("Price (p)")],
        rows: [
          { id: "row-1", cells: [number("500"), number("240")] },
          { id: "row-2", cells: [number("750"), number("330")] },
        ],
        mode: "simple",
        transitions: [],
      }),
  },
];

function quadratic(equation: Equation, known: Record<number, string>, bounds: { yMin: string; yMax: string }): ValueEnvelope {
  const e = defaultEnvelope();
  e.document.equation = equation;
  e.document.columns = [-3, -2, -1, 0, 1, 2, 3].map((x, i) => ({
    id: `c${i + 1}`,
    x: String(x),
    y: known[x] === undefined ? { kind: "blank" } : { kind: "value", value: known[x] },
  }));
  e.document.graph.bounds = { xMin: "-3", xMax: "3", ...bounds };
  return e;
}
const columns = (e: ValueEnvelope) => e.document.columns.map((c) => c.id);
const SQUARES: Record<number, string> = { [-3]: "9", [-2]: "4", [-1]: "1", 0: "0", 1: "1", 2: "4", 3: "9" };
export const plainQuadratics: Plain<ValueEnvelope>[] = [
  { id: "table", title: "Table of values with blank graph paper", note: "y = x² − 3 for x from −3 to 3: the table blank and the graph paper empty.", make: () => quadratic({ a: "1", b: "0", c: "-3" }, {}, { yMin: "-4", yMax: "7" }) },
  {
    id: "y-equals-x-squared",
    title: "Table and curve y = x²",
    note: "y = x² with every value in the table, the points plotted and the curve drawn.",
    make: () => {
      const e = quadratic({ a: "1", b: "0", c: "0" }, SQUARES, { yMin: "-1", yMax: "10" });
      return apply(e, [
        { op: "plot_series", id: "points", source: "table", columnIds: columns(e), connection: "none" },
        { op: "set_curve", curve: { id: "curve", equation: e.document.equation, min: "-3", max: "3" } },
      ]);
    },
  },
  {
    id: "roots-turning-point",
    title: "Curve with roots and turning point",
    note: "The curve y = x² − 2x − 3 with its roots (−1, 0) and (3, 0) and turning point (1, −4) marked.",
    make: () => {
      const e = quadratic({ a: "1", b: "-2", c: "-3" }, {}, { yMin: "-5", yMax: "12" });
      e.document.presentation.composition = "graph";
      return apply(e, [
        { op: "set_curve", curve: { id: "curve", equation: e.document.equation, min: "-3", max: "3" } },
        {
          op: "put_series",
          series: {
            id: "marked",
            source: "custom",
            connection: "none",
            points: [
              { id: "root-1", x: "-1", y: "0" },
              { id: "root-2", x: "3", y: "0" },
              { id: "turning", x: "1", y: "-4" },
            ],
          },
        },
      ]);
    },
  },
];

export const plainAlgebraGrids: Plain<AlgebraEnvelope>[] = [
  { id: "single", title: "Single bracket grid", note: "5(x + 3) in a grid, the products left blank.", make: () => algebraExample("plain-single") },
  { id: "double", title: "Double bracket grid", note: "(x + 4)(x + 1) in a grid, the products left blank.", make: () => algebraExample("plain-double") },
  { id: "common-factor", title: "Factorising grid: common factor", note: "6x + 15 in the grid, the factor and bracket left blank.", make: () => algebraExample("plain-common") },
  { id: "quadratic", title: "Factorising a quadratic grid", note: "x² + 7x + 12: the x² and 12 given, the rest left blank.", make: () => algebraExample("plain-quadratic") },
];
