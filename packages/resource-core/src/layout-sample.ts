import { validate, type Item, type Resource } from "./schema";

/**
 * The layout test sheet (A3 Word worksheets plan, build step 3): a side 1 score box, a wide and a
 * narrow column, a stage band inside a column, grid paper with blank axes and hidden stored
 * working. It checks the layouts in the SVG pages and in Word; it is not a finished teaching sheet.
 */
const t = (text: string): Item => ({ type: "text", text });
const answer = (value = "", prefix = "", suffix = ""): Item => ({ type: "answerLine", prefix, suffix, answer: value, inline: false });
const part = (text: string, working: string | undefined, ...items: Item[]): Item => ({ type: "part", text, items: items as never, ...(working ? { working } : {}) });
const space = (heightMm: number, kind: "working" | "drawing" = "working"): Item => ({ type: "space", kind, heightMm });
type C = [string, "supplied" | "blank" | "hidden"];
const table = (columns: string[], ...rows: C[][]): Item => ({ type: "table", columns, rows: rows.map((r) => r.map(([text, state]) => ({ text, state }))) });
/** A table of values: x printed, each y a hidden answer (or blank when no answer is saved). */
const values = (xs: number[], ys: string[]) => table(["x", ...xs.map((v) => String(v).replace("-", "−"))], [["y", "supplied"], ...ys.map((y) => [y, y ? "hidden" : "blank"] as C)]);

export const layoutSample: Resource = validate({
  tool: "resource",
  schemaVersion: 1,
  document: {
    kind: "worksheet-a3",
    title: "Drawing straight-line graphs",
    code: "TEST-LAYOUT",
    objective: "Layout test: plot a straight line from a table of values",
    group: "Year 9",
    nameLine: true,
    sides: [
      {
        instruction: "Complete each table of values, then plot the points.",
        layout: "three",
        score: 12,
        columns: [
          {
            heading: "Substitute",
            cards: [
              {
                title: "Find y",
                items: [
                  t("Work out the value of y = 2x + 1 for each value of x."),
                  part("x = 3", "2 × 3 + 1 = 7", answer("7", "y =")),
                  part("x = 0", "2 × 0 + 1 = 1", answer("1", "y =")),
                  part("x = −2", "2 × −2 + 1 = −3", answer("−3", "y =")),
                ],
              },
              {
                title: "Negative x",
                working: "3 − (−1) = 4 and 3 − (−3) = 6.",
                items: [t("Work out the value of y = 3 − x when x = −1 and when x = −3."), answer("4", "x = −1, y ="), answer("6", "x = −3, y =")],
              },
            ],
          },
          {
            heading: "Complete the table",
            cards: [
              {
                title: "y = x + 2",
                working: "Add 2 to each x value: 0, 1, 2, 3, 4.",
                items: [values([-2, -1, 0, 1, 2], ["0", "1", "", "3", "4"]), space(14)],
              },
              {
                title: "y = 2x − 1",
                items: [values([-1, 0, 1, 2, 3], ["−3", "−1", "1", "3", "5"]), space(14)],
              },
            ],
          },
          {
            heading: "Plot the line",
            cards: [
              {
                title: "Plot y = x + 2",
                items: [
                  t("Plot the points from your table and join them with a straight line."),
                  { type: "paper", style: "graph", widthMm: 100, heightMm: 100, axes: { originMm: { x: 50, y: 40 }, xLabel: "x", yLabel: "y" } },
                ],
              },
            ],
          },
        ],
      },
      {
        instruction: "Choose your own scale on the blank axes.",
        layout: "wide-narrow",
        columns: [
          {
            heading: "Draw the graph",
            cards: [
              {
                title: "Draw y = 3x − 2",
                working: "x −1, 0, 1, 2, 3 gives y −5, −2, 1, 4, 7.",
                items: [
                  t("Complete the table of values for y = 3x − 2, then draw the graph of y = 3x − 2 for values of x from −1 to 3."),
                  values([-1, 0, 1, 2, 3], ["−5", "−2", "", "4", "7"]),
                  { type: "paper", style: "squared", widthMm: 160, heightMm: 70, axes: { originMm: { x: 40, y: 25 }, xLabel: "x", yLabel: "y" } },
                ],
              },
              {
                title: "Where do they cross?",
                stage: "Use your graph",
                items: [
                  part("Draw the line y = 4 on the same axes.", undefined, space(8)),
                  part("Write the coordinates of the point where the lines cross.", "3x − 2 = 4 so x = 2: the point (2, 4).", answer("(2, 4)")),
                ],
              },
            ],
          },
          {
            heading: "Think backwards",
            cards: [
              {
                title: "Which equation?",
                working: "Gradient 2 and y-intercept 1: y = 2x + 1.",
                items: [t("A line goes through (0, 1) and (2, 5). Write its equation."), answer("y = 2x + 1")],
              },
              {
                title: "Make a table",
                items: [t("Write a table of values that would give a line through (0, 3) going down 1 for each 1 across."), { type: "paper", style: "dotted", widthMm: 110, heightMm: 40 }],
              },
            ],
          },
        ],
      },
    ],
  },
});
