import { validateBooklet, type Booklet } from "./booklet";
import type { Card, Item } from "./schema";

/**
 * Golden booklet: two lessons of an A7 "visualising" unit, written to the standard of the best
 * lesson in the department's A07 booklet (positive gradients): a one-sentence key idea, a short
 * check-in on exactly the prerequisites, a worked example beside a faded "our turn", identical
 * pre-drawn grids for "your turn", lettered mini-whiteboard hinge questions, practice that fades
 * support, spot the mistake and an open challenge. Every diagram is a MathsDock graph.
 */

type Pt = [number, number];
const axes = (x: Pt, y: Pt) => ({ x: { negativeSquares: x[0], positiveSquares: x[1], unitsPerSquare: 1 as const }, y: { negativeSquares: y[0], positiveSquares: y[1], unitsPerSquare: 1 as const } });
function graph(x: Pt, y: Pt, objects: unknown[] = []): Item {
  // Written as a spec, as the AI maker writes it; validateBooklet builds the envelope.
  return { type: "diagram", diagram: { tool: "graph", spec: { axes: axes(x, y), objects } } };
}
const line = (a: Pt, b: Pt) => ({ kind: "line", start: { x: a[0], y: a[1] }, end: { x: b[0], y: b[1] } });
const seg = (a: Pt, b: Pt, dashed = true) => ({ kind: "segment", start: { x: a[0], y: a[1] }, end: { x: b[0], y: b[1] }, strokeStyle: dashed ? "dashed" : "solid" });
const point = (p: Pt) => ({ kind: "point", position: { x: p[0], y: p[1] } });
/** A line on the standard first-quadrant gradient grid, as in the exemplar's "your turn" boxes. */
const gradientGrid = (a: Pt, b: Pt) => graph([1, 5], [1, 6], [line(a, b)]);

const t = (text: string): Item => ({ type: "text", text });
const claim = (text: string): Item => ({ type: "claim", text });
const answer = (prefix: string, value = "", suffix = ""): Item => ({ type: "answerLine", prefix, suffix, answer: value, inline: false });
const part = (text: string, ...items: Item[]): Item => ({ type: "part", text, items: items as never });
const space = (heightMm: number, kind: "working" | "drawing" = "working"): Item => ({ type: "space", kind, heightMm });
const steps = (...list: string[]): Item => ({ type: "steps", steps: list.map((text) => ({ label: "", text })) });
const checklist = (...items: string[]): Item => ({ type: "checklist", items });
const choose = (options: string[], answerIndex: number | null): Item => ({ type: "choice", mode: "letters", options, answer: answerIndex });
type C = [string, "supplied" | "blank" | "hidden"];
const g = (text: string): C => [text, "supplied"];
const h = (text: string): C => [text, "hidden"];
const table = (columns: string[], ...rows: C[][]): Item => ({ type: "table", columns, rows: rows.map((r) => r.map(([text, state]) => ({ text, state }))) });
/**
 * The x → / y ↑ movement table from the design guide, drawn by the ratio-table tool in its compact
 * form so the curved scaling arrows show the method. Cells: "2" printed, "" blank, "[2]" a hidden
 * answer (answers copy only). Steps: "÷ 2" printed beside the arrows, "[÷ 2]" hidden.
 */
const moves = (rows: string[][], steps: string[] = []): Item => ({
  type: "diagram",
  diagram: { tool: "ratio-table", spec: { columns: ["x →", "y ↑"], table: rows, ...(steps.length ? { steps } : {}) } },
});
const card = (title: string, ...items: Item[]): Card => ({ title, items: items as Card["items"] });

/** The model lesson, as source (diagrams as specs). The AI maker shows it as its example. */
export const exampleLessonSource = {
  title: "Find the gradient of a line (positive)",
  code: "A7.03",
  objective: "Find the gradient of a straight line (positive)",
  keyIdea:
    "The **gradient** tells us how far up a line goes for every 1 unit it goes right. **Perfect points** are points where the line passes exactly through a grid intersection.",
  teacherNotes:
    "Prerequisites: reading coordinates, scaling a ratio table down to 1. Insight: the gradient is the y ↑ movement for 1 unit of x →, found from any right-angled triangle between perfect points. Misconceptions: dividing across by up (Adam), subtracting the movements (Beatrice), reading coordinates instead of movements. Support fades: the triangle and table are given, then the table only, then nothing; the last practice questions use two points and no grid.",
  sections: [
    {
      kind: "check-in",
      title: "",
      instruction: "Answer each question.",
      columns: 2,
      cards: [
        card("Coordinates", part("In the coordinate (2, 5), what is the *x* value?", answer("*x* =", "2")), part("In the coordinate (2, 5), what is the *y* value?", answer("*y* =", "5"))),
        card("Complete the ratio table", moves([["4", "8"], ["1", "[2]"]], ["[÷ 4]"])),
        card("Complete the ratio table", moves([["4", "2"], ["1", "[1/2]"]], ["[÷ 4]"])),
        card("Fill in the blanks", t("The ____________ tells us how far ______ a line goes for every 1 unit it goes ______."), t("____________ points are where a line passes exactly through a grid intersection.")),
      ],
    },
    {
      kind: "worked",
      title: "Worked example",
      instruction: "",
      columns: 2,
      cards: [
        card(
          "Worked example",
          t("Find the gradient of the line."),
          graph([1, 5], [1, 6], [line([1, 1], [3, 5]), point([1, 1]), point([3, 5]), seg([1, 1], [3, 1]), seg([3, 1], [3, 5])]),
          steps(
            "Mark two perfect points on the line.",
            "From the left-hand point, go right until you are under the second point, then go up to it. Draw the triangle.",
            "Read the movements: *x* → 2 and *y* ↑ 4.",
            "Use a ratio table to find the movement up for 1 unit right.",
          ),
          moves([["2", "4"], ["1", "2"]], ["÷ 2"]),
          t("**Gradient = 2**"),
        ),
        card(
          "Our turn",
          t("Find the gradient of the line."),
          graph([1, 5], [1, 6], [line([0, 0], [2, 6])]),
          steps("Perfect points.", "Triangle.", "Read the movements.", "Ratio table."),
          moves([["[2]", "[6]"], ["1", "[3]"]], ["[÷ 2]"]),
          answer("Gradient =", "3"),
        ),
      ],
    },
    {
      kind: "practice",
      title: "Your turn",
      instruction: "Mark two perfect points, draw the triangle, then use the table.",
      columns: 2,
      cards: [
        card("Find the gradient", gradientGrid([0, 0], [3, 3]), checklist("Mark two perfect points", "Draw the triangle", "Complete the table"), moves([["", ""], ["1", "[1]"]]), answer("Gradient =", "1")),
        card("Find the gradient", gradientGrid([0, 2], [1, 5]), moves([["", ""], ["1", "[3]"]]), answer("Gradient =", "3")),
        card("Find the gradient", gradientGrid([0, 1], [4, 3]), moves([["", ""], ["1", "[1/2]"]]), answer("Gradient =", "½")),
        card("Find the gradient", gradientGrid([1, 0], [3, 5]), moves([["", ""], ["1", "[5/2]"]]), answer("Gradient =", "2½")),
      ],
    },
    {
      kind: "diagnostic",
      title: "",
      instruction: "Answer on your mini whiteboard.",
      columns: 2,
      cards: [
        card("Read the movements", t("Between two perfect points a line goes 2 right and 6 up. What is its gradient?"), choose(["2", "3", "6", "⅓"], 1)),
        card("Read the triangle", t("The triangle under a line is 4 across and 2 up. What is the gradient?"), choose(["2", "½", "4", "6"], 1)),
        card("Steeper", t("Line P has gradient 3. Line Q has gradient ½. Which line is steeper?"), choose(["P", "Q", "Equally steep"], 0)),
        card("Gradient of 1", t("Which line has a gradient of 1?"), choose(["1 right, 2 up", "3 right, 3 up", "2 right, 1 up", "4 right, 2 up"], 1)),
      ],
    },
    {
      kind: "practice",
      title: "Practice",
      instruction: "",
      columns: 2,
      cards: [
        card("Find the gradient", gradientGrid([0, 1], [1, 3]), moves([["[1]", "[2]"], ["1", "[2]"]]), answer("Gradient =", "2")),
        card("Find the gradient", gradientGrid([0, 0], [2, 5]), moves([["", ""], ["1", "[5/2]"]]), answer("Gradient =", "2½")),
        card("Find the gradient", gradientGrid([0, 2], [3, 3]), space(12), answer("Gradient =", "⅓")),
        card("Find the gradient", gradientGrid([1, 1], [3, 6]), space(12), answer("Gradient =", "2½")),
        card("No grid", t("A line passes through (1, 2) and (3, 8). Find its gradient."), space(22), answer("Gradient =", "3")),
        card("No grid", t("A line passes through (0, 1) and (4, 4). Find its gradient."), space(22), answer("Gradient =", "¾")),
      ],
    },
    {
      kind: "mistake",
      title: "",
      instruction: "",
      columns: 2,
      cards: [
        card(
          "Adam's working",
          t("Adam found the gradient of the line through (0, 0) and (2, 6)."),
          claim("The line goes 2 across and 6 up, so the gradient is 2 ÷ 6 = ⅓."),
          part("Explain Adam's mistake.", space(14)),
          part("Find the correct gradient.", answer("Gradient =", "3")),
        ),
        card(
          "Beatrice's working",
          t("Beatrice used the perfect points (1, 1) and (4, 3)."),
          claim("The triangle is 3 across and 2 up, so the gradient is 3 − 2 = 1."),
          part("Explain Beatrice's mistake.", space(14)),
          part("Find the correct gradient.", answer("Gradient =", "⅔")),
        ),
      ],
    },
    {
      kind: "challenge",
      title: "",
      instruction: "",
      columns: 1,
      cards: [
        card(
          "Lines through the origin",
          t("On the grid, draw and label lines through (0, 0) with gradients 1, 2, 3, ½ and ⅓."),
          graph([1, 12], [1, 8]),
          part("Which line is the steepest? How could you tell without drawing it?", space(12)),
        ),
      ],
    },
  ],
};

const plotLesson = {
  title: "Plot a linear graph from its equation",
  code: "A7.01",
  objective: "Plot graphs of functions of the form y = mx ± c",
  keyIdea:
    "An equation links *x* and *y*. Each *x* value gives one *y* value, and the pair (*x*, *y*) is a point on the line. Plot the points and join them with a ruler.",
  teacherNotes:
    "Prerequisites: substituting positive and negative values. Insight: the table, the coordinates and the line are three views of the same rule. Misconceptions: plotting (y, x), multiplying before the sign of a negative x, joining points freehand. Ezra's table has one wrong value, which shows as a point off the line.",
  sections: [
    {
      kind: "check-in",
      title: "",
      instruction: "",
      columns: 2,
      cards: [
        card("Substitute", part("If *x* = 3, find 2*x* + 1.", answer("", "7")), part("If *x* = −1, find 2*x* + 1.", answer("", "−1"))),
        card("Substitute", part("If *x* = 0, find 3*x* − 2.", answer("", "−2")), part("If *x* = −2, find 3*x* − 2.", answer("", "−8"))),
      ],
    },
    {
      kind: "worked",
      title: "",
      instruction: "",
      columns: 2,
      cards: [
        card(
          "Worked example: draw *y* = *x* + 2",
          steps("Work out each *y* value.", "Write the coordinates.", "Plot the points.", "Join them with a ruler."),
          table(["*x*", "−1", "0", "1", "2"], [g("*y*"), g("1"), g("2"), g("3"), g("4")]),
          t("(−1, 1)  (0, 2)  (1, 3)  (2, 4)"),
          graph([2, 4], [1, 6], [line([-1, 1], [2, 4]), point([-1, 1]), point([0, 2]), point([1, 3]), point([2, 4])]),
        ),
        card(
          "Our turn: draw *y* = *x* + 3",
          steps("Work out each *y* value.", "Write the coordinates.", "Plot the points.", "Join them with a ruler."),
          table(["*x*", "−1", "0", "1", "2"], [g("*y*"), h("2"), h("3"), h("4"), h("5")]),
          answer("Coordinates:", "(−1, 2) (0, 3) (1, 4) (2, 5)"),
          graph([2, 4], [1, 6]),
        ),
      ],
    },
    {
      kind: "practice",
      title: "Your turn",
      instruction: "Complete the table, then draw the graph.",
      columns: 2,
      cards: [
        card("Draw *y* = 2*x* − 1", table(["*x*", "−1", "0", "1", "2", "3"], [g("*y*"), h("−3"), h("−1"), h("1"), h("3"), h("5")]), graph([2, 4], [3, 5])),
        card("Draw *y* = 3 − *x*", table(["*x*", "−1", "0", "1", "2", "3"], [g("*y*"), h("4"), h("3"), h("2"), h("1"), h("0")]), graph([2, 4], [1, 5])),
      ],
    },
    {
      kind: "mistake",
      title: "",
      instruction: "",
      columns: 1,
      cards: [
        card(
          "Ezra's graph",
          t("Ezra made this table for *y* = 4*x* + 2 and plotted the points."),
          table(["*x*", "−1", "0", "1", "2"], [g("*y*"), g("6"), g("2"), g("6"), g("10")]),
          part("Which value in Ezra's table is wrong? How would the graph show it?", space(12)),
          part("Write the correct value.", answer("", "−2")),
        ),
      ],
    },
  ],
};

export const a7Booklet: Booklet = validateBooklet({
  tool: "resource",
  schemaVersion: 1,
  document: {
    kind: "booklet-a4",
    title: "Algebraic proficiency: visualising",
    code: "A7",
    group: "Year 9",
    coverNote: "Use a sharp pencil and a ruler for every graph. Show your working in the spaces given.",
    nameLine: true,
    intro: {
      remember: ["Coordinates in all four quadrants", "Substitution into expressions", "Ratio tables and scaling"],
      learn: ["Plotting straight-line graphs", "Gradient and *y*-intercept", "Equations of the form *y* = *mx* + *c*", "Parallel lines"],
      next: ["Perpendicular lines", "Quadratic, cubic and reciprocal graphs", "Real-life graphs"],
      keywords: [
        { word: "Linear", meaning: "An equation whose graph is a straight line." },
        { word: "Coefficient", meaning: "The number multiplying a letter: in 4*x*, the coefficient is 4." },
        { word: "Gradient", meaning: "How far up a line goes for every 1 unit it goes right." },
        { word: "Perfect point", meaning: "A point where a line passes exactly through a grid intersection." },
        { word: "*y*-intercept", meaning: "Where a line crosses the *y*-axis." },
      ],
    },
    lessons: [plotLesson, exampleLessonSource],
  },
});
