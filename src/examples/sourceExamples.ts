import { pageHref } from "../site/routes";
import type { DiagramDocumentV1 } from "../domain/types";
import {
  createRatioTable,
  type RatioEnvelope,
} from "../../packages/ratio-table-core/src/interchange";

export interface SourceExample<T> {
  id: string;
  source: string;
  title: string;
  description: string;
  create: (worked: boolean) => T;
}

/** Values checked against the published question and its official mark scheme. */
export const graphExamples: SourceExample<DiagramDocumentV1>[] = [
  {
    id: "1MA1_JUN_2019_2H_Q2",
    source: "June 2019 · Higher 2 · Q2",
    title: "y = 2x − 3",
    description: "Draw from x = −2 to 4. Half-unit x squares, unit y squares.",
    create: (worked) =>
      graph(
        5,
        9,
        8,
        6,
        0.5,
        1,
        worked
          ? [
              { x: -2, y: -7 },
              { x: 4, y: 5 },
            ]
          : null,
      ),
  },
  {
    id: "1MA1_NOV_2017_3F_Q13",
    source: "November 2017 · Foundation 3 · Q13",
    title: "y = ½x − 1",
    description:
      "Draw from x = −2 to 3 with half-unit scales. The source includes a table and a graph-reading task.",
    create: (worked) =>
      graph(
        5,
        7,
        5,
        5,
        0.5,
        0.5,
        worked
          ? [
              { x: -2, y: -2 },
              { x: 3, y: 0.5 },
            ]
          : null,
      ),
  },
  {
    id: "1MA1_NOV_2021_1F_Q18",
    source: "November 2021 · Foundation 1 · Q18",
    title: "y = 2x − 2",
    description: "Draw from x = −2 to 3. Half-unit x squares, unit y squares.",
    create: (worked) =>
      graph(
        5,
        7,
        7,
        8,
        0.5,
        1,
        worked
          ? [
              { x: -2, y: -6 },
              { x: 3, y: 4 },
            ]
          : null,
      ),
  },
];
function graph(
  xNegative: number,
  xPositive: number,
  yNegative: number,
  yPositive: number,
  xUnits: 0.5 | 1 | 2,
  yUnits: 0.5 | 1 | 2,
  points: [{ x: number; y: number }, { x: number; y: number }] | null,
): DiagramDocumentV1 {
  return {
    version: 1,
    styleProfile: "portable-v1",
    axes: {
      x: {
        negativeSquares: xNegative,
        positiveSquares: xPositive,
        unitsPerSquare: xUnits,
      },
      y: {
        negativeSquares: yNegative,
        positiveSquares: yPositive,
        unitsPerSquare: yUnits,
      },
    },
    objects: points
      ? [
          {
            id: "example-line",
            kind: "straight",
            display: "segment",
            strokeStyle: "solid",
            start: points[0],
            end: points[1],
            equationVisible: false,
          },
        ]
      : [],
    selectedObjectId: null,
  };
}
const numberCell = (value: string) => ({ kind: "number" as const, value });
const answerCell = () => ({ kind: "answer-line" as const });
export const ratioExamples: SourceExample<RatioEnvelope>[] = [
  {
    id: "1MA1_NOV_2017_3F_Q12",
    source: "November 2017 · Foundation 3 · Q12",
    title: "Apple prices",
    description:
      "2.5 kg costs £3.60. Use the unit-price step to find the cost of 3.5 kg.",
    create: (worked) =>
      createRatioTable({
        schemaVersion: 1,
        headings: [
          { text: "kg", italic: false, direction: "none" },
          { text: "GBP", italic: false, direction: "none" },
        ],
        rows: [
          { id: "given", cells: [numberCell("2.5"), numberCell("3.6")] },
          {
            id: "unit",
            cells: [
              numberCell("1"),
              worked ? numberCell("1.44") : answerCell(),
            ],
          },
          {
            id: "target",
            cells: [
              numberCell("3.5"),
              worked ? numberCell("5.04") : answerCell(),
            ],
          },
        ],
        mode: "annotated",
        transitions: [
          { from: "given", to: "unit", operation: "divide", factor: "2.5" },
          { from: "unit", to: "target", operation: "multiply", factor: "3.5" },
        ],
      }),
  },
  {
    id: "1MA1_NOV_2021_1F_Q17",
    source: "November 2021 · Foundation 1 · Q17",
    title: "Biscuit recipe: one biscuit",
    description:
      "The recipe makes 12 biscuits. Find the butter, flour and sugar in grams for one biscuit as a first step towards the source question.",
    create: (worked) =>
      createRatioTable({
        schemaVersion: 2,
        headings: ["Butter", "Flour", "Sugar"].map((text) => ({
          text,
          italic: false,
          direction: "none",
        })),
        rows: [
          {
            id: "recipe",
            cells: [numberCell("125"), numberCell("200"), numberCell("50")],
          },
          {
            id: "one-biscuit",
            cells: worked
              ? [numberCell("125/12"), numberCell("50/3"), numberCell("25/6")]
              : [answerCell(), answerCell(), answerCell()],
          },
        ],
        mode: "annotated",
        transitions: [
          {
            from: "recipe",
            to: "one-biscuit",
            operation: "divide",
            factor: "12",
          },
        ],
      }),
  },
];
export const sourceQuestionHref = (id: string) =>
  `${pageHref("question-bank")}?question=${encodeURIComponent(id)}`;
