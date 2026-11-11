import { validate, type Item, type Resource } from "./schema";

/**
 * The Word rendering-test sheet (A3 Word worksheets plan, build step 1): every worksheet block,
 * stacked fractions in question text, hidden answers and straight-line graphs on one two-sided
 * sheet. It checks how Word and LibreOffice draw the file; it is not a finished teaching sheet.
 */
type Pt = [number, number];
const axes = (x: Pt, y: Pt) => ({ x: { negativeSquares: x[0], positiveSquares: x[1], unitsPerSquare: 1 as const }, y: { negativeSquares: y[0], positiveSquares: y[1], unitsPerSquare: 1 as const } });
const graph = (x: Pt, y: Pt, objects: unknown[] = []): Item => ({ type: "diagram", diagram: { tool: "graph", spec: { axes: axes(x, y), objects } } });
const line = (a: Pt, b: Pt) => ({ kind: "line", start: { x: a[0], y: a[1] }, end: { x: b[0], y: b[1] } });
const seg = (a: Pt, b: Pt) => ({ kind: "segment", start: { x: a[0], y: a[1] }, end: { x: b[0], y: b[1] }, strokeStyle: "dashed" });
const point = (p: Pt) => ({ kind: "point", position: { x: p[0], y: p[1] } });
const t = (text: string): Item => ({ type: "text", text });
const answer = (value = "", prefix = "", suffix = ""): Item => ({ type: "answerLine", prefix, suffix, answer: value, inline: false });
const inline = (prefix: string, value: string): Item => ({ type: "answerLine", prefix, suffix: "", answer: value, inline: true });
const part = (text: string, ...items: Item[]): Item => ({ type: "part", text, items: items as never });
const space = (heightMm: number, kind: "working" | "drawing" = "working"): Item => ({ type: "space", kind, heightMm });
type C = [string, "supplied" | "blank" | "hidden"];
const table = (columns: string[], ...rows: C[][]): Item => ({ type: "table", columns, rows: rows.map((r) => r.map(([text, state]) => ({ text, state }))) });

export const wordSample: Resource = validate({
  tool: "resource",
  schemaVersion: 1,
  document: {
    kind: "worksheet-a3",
    title: "Gradient as a fraction",
    code: "TEST",
    objective: "Word rendering test: find the gradient of a straight line as a fraction",
    group: "Year 9",
    nameLine: true,
    notation: "maths",
    sides: [
      {
        instruction: "Write each gradient as a fraction in its simplest form.",
        columns: [
          {
            heading: "Count the steps",
            cards: [
              {
                title: "Rise over run",
                items: [
                  { type: "info", text: "Gradient = {rise/run}. Count squares up for the rise and squares across for the run." },
                  graph([1, 6], [1, 5], [line([1, 1], [5, 3]), point([1, 1]), point([5, 3]), seg([1, 1], [5, 1]), seg([5, 1], [5, 3])]),
                  part("Write the rise.", answer("2")),
                  part("Write the run.", answer("4")),
                  part("Write the gradient as a fraction.", answer("2/4 = 1/2")),
                ],
              },
              {
                title: "Simplify the gradient",
                items: [
                  part("A line rises 3 squares for every 6 across. Is its gradient {3/6} or {6/3}?", answer("3/6")),
                  part("Simplify {3/6}.", answer("1/2")),
                  part("Simplify {8/12}.", answer("2/3")),
                  { type: "checklist", items: ["Divide the rise and the run by the same number.", "Stop when they share no factor."] },
                ],
              },
            ],
          },
          {
            heading: "Use a table",
            cards: [
              {
                title: "Complete the table",
                items: [
                  t("A line goes through (0, 1) and (6, 4)."),
                  table(["", "Rise", "Run", "Gradient"], [["Steps", "supplied"], ["3", "supplied"], ["6", "supplied"], ["1/2", "hidden"]]),
                  { type: "steps", steps: [{ label: "", text: "Find the rise: 4 − 1 = 3." }, { label: "", text: "Find the run: 6 − 0 = 6." }, { label: "", text: "Gradient = {3/6} = {1/2}." }] },
                  part("Another line has rise 5 and run 10. Write its gradient.", answer("1/2")),
                ],
              },
              {
                title: "Which line?",
                items: [
                  t("Which gradient is steeper than {1/2}?"),
                  { type: "choice", mode: "letters", options: ["{1/3}", "{2/5}", "{3/4}", "{1/4}"], answer: 2 },
                  part("Explain your choice.", space(18)),
                ],
              },
            ],
          },
          {
            heading: "Compare gradients",
            cards: [
              {
                title: "Order the lines",
                items: [
                  t("Four lines have gradients {1/2}, {2/3}, {3/8} and {5/6}."),
                  part("Which line is the steepest?", answer("5/6")),
                  part("Write the gradients in order, least steep first.", answer("3/8, 1/2, 2/3, 5/6")),
                  { type: "choice", mode: "circle", options: ["Parallel", "Not parallel"], answer: 1 },
                ],
              },
              {
                title: "Draw a line",
                items: [
                  t("Draw a line with gradient {2/3} through (0, 0)."),
                  graph([1, 6], [1, 5]),
                  part("Write one more point on your line.", answer("(3, 2)")),
                ],
              },
            ],
          },
        ],
      },
      {
        instruction: "Show your working. Write gradients as fractions.",
        columns: [
          {
            heading: "Think backwards",
            cards: [
              {
                title: "Find the missing run",
                items: [
                  t("A line has gradient {3/4}. It rises 6 squares."),
                  part("How many squares across does it go?", answer("8")),
                  { type: "claim", text: "A gradient of {3/4} means the line goes 3 across and 4 up." },
                  part("Is the claim correct? Explain.", space(16)),
                ],
              },
              {
                title: "Mixed numbers",
                items: [
                  t("A ramp rises 5 m over a run of 2 m. Its gradient is {5/2}, or 2{1/2}."),
                  part("Write a gradient of 1{1/3} as an improper fraction.", answer("4/3")),
                  space(30),
                ],
              },
            ],
          },
          {
            heading: "Problem solving",
            cards: [
              {
                title: "Two ramps",
                items: [
                  table(["Ramp", "Rise (m)", "Run (m)"], [["A", "supplied"], ["1", "supplied"], ["12", "supplied"]], [["B", "supplied"], ["2", "supplied"], ["15", "supplied"]]),
                  part("Write each gradient as a fraction.", inline("A:", "1/12"), inline("B:", "2/15")),
                  part("Which ramp is steeper? Show how you know.", space(40)),
                ],
              },
            ],
          },
          {
            heading: "Extension",
            cards: [
              {
                title: "Make your own",
                items: [
                  t("Choose two points so the line through them has gradient {2/5}."),
                  { type: "choice", mode: "tick", options: ["My rise and run share no factor.", "My line slopes up from left to right."], answer: null },
                  part("Write your two points.", answer("")),
                  space(60, "drawing"),
                ],
              },
            ],
          },
        ],
      },
    ],
  },
});
