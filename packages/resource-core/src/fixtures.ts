import { create as createChart, validate as validateChart, type Envelope as ChartEnvelope } from "../../chart-core/src/index";
import { fromNested, type NestedBranch, type TreeDocument } from "../../probability-tree-core/src/index";
import { validate, type Item, type Resource } from "./schema";

/**
 * Golden fixtures: two of Tim's own A3 worksheets (made with his PLAN / FINALISE / PRODUCE prompts,
 * November 2026), rebuilt as data. Question wording follows his finalised sheets; values the PDFs
 * did not state exactly (for example bar heights read off a chart) are chosen to match.
 * Hidden values are saved answers that print only in the answers view.
 */

type Series = { name: string; fill: "grey" | "hatch" | "white"; values: string[]; hidden?: number[] };
function chart(categories: string[], series: Series[], max: number, step: number, extra: Partial<ChartEnvelope["document"]> = {}): Item {
  const e = createChart();
  e.document = {
    ...e.document,
    kind: "dual",
    categories,
    series: series.map((s) => ({
      name: s.name,
      fill: s.fill,
      values: s.values.map((value, i) => ({ value, show: s.hidden?.includes(i) ? "hidden" : "show" })),
    })),
    axis: { min: "0", max: String(max), step: String(step), minor: 1 },
    yTitle: "Number of pupils",
    grid: "major",
    key: true,
    heightMm: 40,
    barMm: 5,
    ...extra,
  };
  return { type: "diagram", diagram: { tool: "charts", envelope: validateChart(e) } };
}

const line = (prefix = "", answer = "", suffix = ""): Item => ({ type: "answerLine", prefix, suffix, answer, inline: false });
const part = (text: string, ...items: Item[]): Item => ({ type: "part", text, items: items as never });
const t = (text: string): Item => ({ type: "text", text });
const table = (columns: string[], rows: string[][]): Item => ({
  type: "table",
  columns,
  rows: rows.map((r) => r.map((text) => ({ text, state: "supplied" as const }))),
});
const space = (heightMm: number, kind: "working" | "drawing" = "working"): Item => ({ type: "space", kind, heightMm });

const activities = ["Reading", "Gaming", "Sport"];

export const comparativeBarCharts: Resource = validate({
  tool: "resource",
  schemaVersion: 1,
  document: {
    kind: "worksheet-a3",
    title: "Comparative bar charts",
    code: "SP2",
    objective: "Construct and interpret comparative bar charts",
    group: "Year 8",
    nameLine: true,
    sides: [
      {
        instruction: "Read, compare and complete comparative bar charts.",
        columns: [
          {
            heading: "Read and compare",
            cards: [
              {
                title: "Read the chart",
                items: [
                  t("The chart shows how pupils in two classes usually travel to school. Each pupil gives one answer."),
                  chart(
                    ["Walk", "Cycle", "Car", "Bus"],
                    [
                      { name: "Class A", fill: "white", values: ["8", "4", "6", "6"] },
                      { name: "Class B", fill: "hatch", values: ["6", "2", "6", "10"] },
                    ],
                    12,
                    1,
                    { xTitle: "Travel method", yTitle: "Pupils", heightMm: 40 },
                  ),
                  part("How many pupils in Class A usually walk to school?", line("", "8")),
                  part("Complete the sentence: the Class B bar above Bus shows that ______ pupils in Class B usually travel by bus."),
                  part(
                    "What is the most common travel method in each class?",
                    { type: "answerLine", prefix: "Class A:", suffix: "", answer: "Walk", inline: true },
                    { type: "answerLine", prefix: "Class B:", suffix: "", answer: "Bus", inline: true },
                  ),
                ],
              },
              {
                title: "Compare the classes",
                items: [
                  { type: "info", text: "Compare the two bars for a category. Subtract to find a difference; add to find a combined total." },
                  part("Which travel method is used by the same number of pupils in both classes?", line("", "Car")),
                  part("How many more pupils in Class B travel by bus than in Class A?", line("", "4")),
                  part("Which travel method has the greatest difference? What is it?", line("", "Bus, 4")),
                  part("How many pupils from both classes travel by bus altogether?", line("", "16")),
                ],
              },
            ],
          },
          {
            heading: "Complete paired bars",
            cards: [
              {
                title: "Complete the second group",
                items: [
                  t("Each pupil in two classes chose one favourite activity."),
                  table(["Activity", "Class A", "Class B"], [["Reading", "6", "8"], ["Gaming", "10", "6"], ["Sport", "8", "10"]]),
                  part("Draw the Class B bars. The Class A bars are already drawn."),
                  chart(activities, [
                      { name: "Class A", fill: "white", values: ["6", "10", "8"] },
                      { name: "Class B", fill: "hatch", values: ["8", "6", "10"], hidden: [0, 1, 2] },
                    ], 12, 2, { xTitle: "", heightMm: 40 }),
                  part("Which class has more pupils choosing sport? How many more?", line("", "Class B, 2 more")),
                ],
              },
              {
                title: "Draw both groups from another survey",
                items: [
                  table(["Activity", "Class A", "Class B"], [["Reading", "6", "10"], ["Gaming", "10", "6"], ["Sport", "8", "8"]]),
                  part("Draw both sets of bars, then find each combined total."),
                  chart(activities, [
                      { name: "Class A", fill: "white", values: ["6", "10", "8"], hidden: [0, 1, 2] },
                      { name: "Class B", fill: "hatch", values: ["10", "6", "8"], hidden: [0, 1, 2] },
                    ], 12, 2, { xTitle: "", heightMm: 40 }),
                  { type: "answerLine", prefix: "Reading:", suffix: "", answer: "16", inline: true },
                  { type: "answerLine", prefix: "Gaming:", suffix: "", answer: "16", inline: true },
                  { type: "answerLine", prefix: "Sport:", suffix: "", answer: "16", inline: true },
                  part("What do you notice about the totals?", line("", "They are all 16")),
                ],
              },
            ],
          },
          {
            heading: "Organise and interpret",
            cards: [
              {
                title: "Add the chart information",
                items: [
                  t("Pupils in a Year 7 group and a Year 8 group choose their preferred lunch. Each pupil chooses one option."),
                  table(["Lunch", "Year 7 group", "Year 8 group"], [["Sandwich", "12", "6"], ["Pasta", "8", "10"], ["Salad", "4", "8"]]),
                  t("Complete a comparative bar chart using the supplied axes. Add a title, label both axes, write the lunch categories and complete the key. Then draw the bars."),
                  chart(
                    ["", "", ""],
                    [
                      { name: "", fill: "white", values: ["12", "8", "4"], hidden: [0, 1, 2] },
                      { name: "", fill: "hatch", values: ["6", "10", "8"], hidden: [0, 1, 2] },
                    ],
                    14,
                    2,
                    { yTitle: "", xTitle: "", heightMm: 62, barMm: 7 },
                  ),
                ],
              },
              {
                title: "Compare categories and totals",
                items: [
                  t("Use your chart from Question 5."),
                  part(
                    "How many pupils are in each group?",
                    { type: "answerLine", prefix: "Year 7:", suffix: "", answer: "24", inline: true },
                    { type: "answerLine", prefix: "Year 8:", suffix: "", answer: "24", inline: true },
                  ),
                  part("Which two lunch options have the same combined total? What is that total?", line("", "Sandwich and pasta, 18")),
                  part("Which lunch option has the greatest difference? What is that difference?", line("", "Sandwich, 6")),
                ],
              },
            ],
          },
        ],
      },
      {
        instruction: "Use a ruler when drawing charts. Show any calculations in the space provided.",
        columns: [
          {
            heading: "Construct independently",
            cards: [
              {
                title: "Construct your own chart",
                items: [
                  t("Pupils in two classes choose their favourite sport. Each pupil chooses one sport."),
                  table(["Sport", "Class A", "Class B"], [["Football", "13", "7"], ["Swimming", "4", "6"], ["Tennis", "3", "5"], ["Basketball", "4", "6"]]),
                  t("Draw a comparative bar chart to represent the data. Choose a suitable scale. Include a title, labelled axes and a key."),
                  space(85, "drawing"),
                ],
              },
              {
                title: "Check a claim",
                items: [
                  t("Use your chart from Question 7."),
                  part("Find the total number of pupils in each class.", line("", "24 and 24")),
                  part(
                    "A pupil says:",
                    { type: "claim", text: "Class A must have more pupils because its football bar is the tallest." },
                    t("Is the pupil correct? Explain using your calculations."),
                    space(14),
                  ),
                  part("Which sport is most popular across both classes combined? How many pupils chose it?", line("", "Football, 20")),
                ],
              },
            ],
          },
          {
            heading: "Choose a scale and check",
            cards: [
              {
                title: "Choose a suitable scale",
                items: [
                  t("A school library records the number of books borrowed in January and March."),
                  table(["Type of book", "January", "March"], [["Fiction", "30", "40"], ["Non-fiction", "20", "10"], ["Comics", "10", "20"]]),
                  part("Draw a comparative bar chart. Choose a suitable scale and include a title, labelled axes and a key.", space(48, "drawing")),
                  part("How many more books were borrowed in March than in January?", line("", "10")),
                ],
              },
              {
                title: "Check someone else’s chart",
                items: [
                  t("A pupil uses the table from Question 9 to draw the chart below. One pair of bars does not match the key correctly."),
                  chart(
                    ["Fiction", "Non-fiction", "Comics"],
                    [
                      { name: "January", fill: "white", values: ["30", "20", "20"] },
                      { name: "March", fill: "hatch", values: ["40", "10", "10"] },
                    ],
                    50,
                    10,
                    { yTitle: "Books", xTitle: "Type of book", heightMm: 40 },
                  ),
                  part("Identify the incorrect pair.", line("", "Comics")),
                  part("Explain how it should be corrected. You may annotate the chart.", space(12)),
                ],
              },
            ],
          },
          {
            heading: "Find missing data and create",
            cards: [
              {
                title: "Find the missing bar",
                items: [
                  t("The chart shows the lunch choices of two classes. Each class contains 20 pupils. Every pupil chooses one lunch. The Class B bar for Salad has not yet been drawn."),
                  chart(
                    ["Sandwich", "Pasta", "Salad"],
                    [
                      { name: "Class A", fill: "white", values: ["8", "7", "5"] },
                      { name: "Class B", fill: "hatch", values: ["6", "9", "5"], hidden: [2] },
                    ],
                    10,
                    1,
                    { xTitle: "Lunch", yTitle: "Pupils", heightMm: 40 },
                  ),
                  part("Find how many pupils in Class B chose salad.", line("", "5")),
                  part("Add the missing bar to the chart."),
                  part("Compare the number of pupils choosing salad in the two classes.", line("", "The same: 5 each")),
                ],
              },
              {
                title: "Create a comparative chart",
                items: [
                  t("Two groups of 12 pupils each choose one favourite activity: reading, gaming or sport. Make up results that meet all three conditions:"),
                  {
                    type: "bullets",
                    items: [
                      "Reading is the single most popular activity in Group A.",
                      "Sport is the single most popular activity in Group B.",
                      "The same number of pupils in each group choose gaming.",
                    ],
                  },
                  part("Draw a comparative bar chart of your results with a suitable scale, a title, labelled axes and a key.", space(34, "drawing")),
                  part("Could a different set of results also meet all the conditions? Explain.", space(10)),
                ],
              },
            ],
          },
        ],
      },
    ],
  },
});

/* ---------- Tree diagrams (SP7.01) ---------- */

type Stage = string[];
/** An outcome tree with no probabilities. `ends` lists the end outcomes printed; the rest are left for pupils. */
function tree(stages: Stage[], opts: { ends?: string[]; endColumn?: boolean; hideOutcome?: string[]; titles?: string[] } = {}): Item {
  const build = (k: number, path: string[]): NestedBranch[] =>
    k >= stages.length
      ? []
      : stages[k].map((outcome) => {
          const p = [...path, outcome];
          const name = p.join("");
          const node: NestedBranch = { outcome, children: build(k + 1, p) };
          if (k === stages.length - 1 && opts.endColumn) node.endOutcome = name;
          const hidden: NonNullable<NestedBranch["hidden"]> = [];
          if (k === stages.length - 1 && opts.endColumn && !opts.ends?.includes(name)) hidden.push("endOutcome");
          if (opts.hideOutcome?.includes(p.join(","))) hidden.push("outcome");
          if (hidden.length) node.hidden = hidden;
          return node;
        });
  const base: Partial<TreeDocument> = {
    stageTitles: opts.titles ?? [],
    endColumn: opts.endColumn ? "outcome" : "none",
    endHeadings: ["Outcome", "Probability"],
    blankStyle: "box",
    branchMm: 26,
    gapMm: 10,
  };
  return { type: "diagram", diagram: { tool: "probability-tree", envelope: fromNested(build(0, []), base) } };
}
const outcomes = (...list: string[]): Item => line("", list.join(", "));

export const treeDiagrams: Resource = validate({
  tool: "resource",
  schemaVersion: 1,
  document: {
    kind: "worksheet-a3",
    title: "List outcomes of combined events using a tree diagram",
    code: "SP7.01",
    objective: "List outcomes of combined events using a tree diagram",
    group: "Year 9 • Foundation",
    nameLine: true,
    sides: [
      {
        instruction: "",
        columns: [
          {
            heading: "Reading a tree diagram",
            cards: [
              {
                title: "Look at the tree diagram",
                items: [
                  t("A coin is tossed twice. H means heads and T means tails."),
                  part("Write *first toss* and *second toss* above the correct groups of branches."),
                  part("HH has been written at the end of one path. Write the three missing outcomes at the ends of the other paths."),
                  tree([["H", "T"], ["H", "T"]], { endColumn: true, ends: ["HH"] }),
                ],
              },
              {
                title: "Use the same tree diagram",
                items: [
                  part("Trace the path for HT."),
                  part("Put a dot beside the path for TH."),
                  part("Why are HT and TH different outcomes?", space(16)),
                ],
              },
            ],
          },
          {
            heading: "Completing and drawing",
            cards: [
              {
                title: "Complete the missing branch",
                items: [
                  t("A spinner has two possible results: red (R) and blue (B). It is spun twice."),
                  part("Complete the missing label on the tree diagram."),
                  tree([["R", "B"], ["R", "B"]], { hideOutcome: ["B,B"] }),
                  part("List all the possible outcomes, using two letters for each outcome.", outcomes("RR", "RB", "BR", "BB")),
                ],
              },
              {
                title: "Draw a tree diagram",
                items: [
                  t("Spinner A has two possible results: A and B. Spinner B has two possible results: 1 and 2. Spinner A is spun first, followed by Spinner B."),
                  part("Draw a tree diagram to show all possible outcomes.", space(48, "drawing")),
                  part("List all the possible outcomes.", outcomes("A1", "A2", "B1", "B2")),
                ],
              },
            ],
          },
          {
            heading: "Changing the order",
            cards: [
              {
                title: "Coin first, then spinner",
                items: [
                  t("A coin lands heads (H) or tails (T). A spinner lands red (R), blue (B) or green (G). The coin is tossed first, then the spinner is spun."),
                  part("Complete the tree diagram."),
                  tree([["H", "T"], ["R", "B", "G"]], { hideOutcome: ["T,R", "T,B", "T,G"] }),
                  part("List all the possible outcomes.", outcomes("HR", "HB", "HG", "TR", "TB", "TG")),
                ],
              },
              {
                title: "Spinner first, then coin",
                items: [
                  t("The spinner is spun first, then the coin is tossed."),
                  part("Complete the tree diagram."),
                  tree([["R", "B", "G"], ["H", "T"]], { hideOutcome: ["B,H", "B,T", "G,H", "G,T"] }),
                  part("List all the possible outcomes.", outcomes("RH", "RT", "BH", "BT", "GH", "GT")),
                  part("Compare your answers to Questions 5 and 6. What has changed?", space(12)),
                ],
              },
            ],
          },
        ],
      },
      {
        instruction: "",
        columns: [
          {
            heading: "Constructing and checking",
            cards: [
              {
                title: "Make a two-character code",
                items: [
                  t("A two-character code is made using:"),
                  { type: "bullets", items: ["A or B for the first character.", "1, 2 or 3 for the second character."] },
                  part("Draw a tree diagram to show every possible code.", space(52, "drawing")),
                  part("List all the possible codes.", outcomes("A1", "A2", "A3", "B1", "B2", "B3")),
                ],
              },
              {
                title: "Find the missing outcome",
                items: [
                  t("A badge is made by choosing a shape and then a colour. The shape is a circle (C) or a star (S). The colour is red (R), blue (B) or green (G). A pupil has drawn an incomplete tree diagram and written this list of outcomes:"),
                  { type: "info", text: "CR, CB, CG, SR, SB" },
                  part("One label is missing from the tree diagram. Write it in the box."),
                  tree([["C", "S"], ["R", "B", "G"]], { hideOutcome: ["S,G"] }),
                  part("Write the missing outcome from the list.", line("", "SG")),
                ],
              },
            ],
          },
          {
            heading: "Independent practice",
            cards: [
              {
                title: "Ice creams",
                items: [
                  t("An ice cream is made by choosing:"),
                  { type: "bullets", items: ["A flavour: vanilla (V), chocolate (C) or strawberry (S).", "A container: cone (K) or tub (T)."] },
                  part("Draw a tree diagram to show all the possible ice creams.", space(52, "drawing")),
                  part("List all the possible outcomes.", outcomes("VK", "VT", "CK", "CT", "SK", "ST")),
                ],
              },
              {
                title: "Two switches",
                items: [
                  t("Two switches, A and B, can each be on or off. The setting of switch A is chosen first, followed by the setting of switch B."),
                  part("Draw a tree diagram showing all possible pairs of settings.", space(44, "drawing")),
                  part("List all the possible outcomes, stating the setting of switch A first.", outcomes("on on", "on off", "off on", "off off")),
                ],
              },
            ],
          },
          {
            heading: "Independent practice and extension",
            cards: [
              {
                title: "Meals",
                items: [
                  t("A meal is made by choosing:"),
                  { type: "bullets", items: ["A main: pasta (P) or rice (R).", "A drink: water (W), juice (J) or milk (M)."] },
                  part("Draw a tree diagram to show all the possible meals.", space(52, "drawing")),
                  part("List all the possible outcomes.", outcomes("PW", "PJ", "PM", "RW", "RJ", "RM")),
                ],
              },
              {
                title: "Extension: three stages",
                items: [
                  t("A coin is tossed three times."),
                  part("Draw a tree diagram to show all the possible sequences of heads (H) and tails (T).", space(56, "drawing")),
                  // Eight outcomes need two full answer lines: one short line would not hold the saved answer.
                  part("List every possible outcome.", outcomes("HHH", "HHT", "HTH", "HTT"), outcomes("THH", "THT", "TTH", "TTT")),
                ],
              },
            ],
          },
        ],
      },
    ],
  },
});
