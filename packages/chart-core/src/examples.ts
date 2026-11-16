import { create, validate, GROUPED_DEFAULTS, type Envelope, type Fill, type GroupedSettings, type Kind } from "./index";

type Data = { name: string; fill: Fill; values: string[]; hidden?: number[] };
function chart(
  kind: Kind,
  categories: string[],
  series: Data[],
  axis: Envelope["document"]["axis"],
  extra: Partial<Envelope["document"]>,
  worked: boolean,
): Envelope {
  const e = create();
  e.document = {
    ...e.document,
    ...extra,
    kind,
    categories,
    axis,
    series: series.map((s) => ({
      name: s.name,
      fill: s.fill,
      values: s.values.map((value, i) => ({
        value,
        show: !worked && s.hidden?.includes(i) ? "hidden" : "show",
      })),
    })),
  };
  return validate(e);
}

/** A grouped-data example: classes [lower, upper, frequency], with the parts saved as hidden answers. */
function grouped(
  kind: "histogram" | "polygon" | "cumulative",
  rows: [string, string, string][],
  settings: Omit<Partial<GroupedSettings>, "classes">,
  hide: { graph?: number[]; table?: number[] },
  worked: boolean,
): Envelope {
  const e = create();
  e.document.kind = kind;
  e.document.grouped = {
    ...structuredClone(GROUPED_DEFAULTS),
    ...settings,
    classes: rows.map(([lower, upper, frequency], i) => ({
      lower,
      upper,
      frequency,
      table: !worked && hide.table?.includes(i) ? "hidden" : "show",
      graph: !worked && hide.graph?.includes(i) ? "hidden" : "show",
    })),
  };
  return validate(e);
}

/** Editable starting points. Source examples name the question they adapt;
 * values read from a source graph are noted as readings. */
export const examples: {
  id: string;
  title: string;
  note: string;
  sourceId?: string;
  worked: boolean;
  make: (worked: boolean) => Envelope;
}[] = [
  {
    id: "dual-transport",
    title: "June 2017 2F Q3: complete a dual bar chart",
    note: "Adapted from the transport question. The girls' Walk bar is left for pupils to draw; its value 3 is chosen for this example and saved as a hidden answer.",
    sourceId: "1MA1_JUN_2017_2F_Q3",
    worked: true,
    make: (worked) =>
      chart(
        "dual",
        ["Car", "Bus", "Walk", "Cycle", "Other"],
        [
          { name: "boys", fill: "grey", values: ["5", "6", "9", "4", "2"] },
          { name: "girls", fill: "hatch", values: ["9", "4", "3", "1", "1"], hidden: [2] },
        ],
        { min: "0", max: "10", step: "1", minor: 1 },
        { yTitle: "Frequency", xTitle: "", grid: "major", key: true, heightMm: 70, barMm: 7 },
        worked,
      ),
  },
  {
    id: "composite-sales",
    title: "June 2018 1F Q12: composite bar chart",
    note: "Sales of desktop computers, laptops and tablets over three years, on fine graph paper with five small squares per 100.",
    sourceId: "1MA1_JUN_2018_1F_Q12",
    worked: false,
    make: (worked) =>
      chart(
        "composite",
        ["2015", "2016", "2017"],
        [
          { name: "desktop computers", fill: "black", values: ["100", "120", "160"] },
          { name: "laptops", fill: "hatch", values: ["160", "220", "280"] },
          { name: "tablets", fill: "grey", values: ["60", "160", "340"] },
        ],
        { min: "0", max: "900", step: "100", minor: 5 },
        { yTitle: "Number sold", xTitle: "", grid: "fine", key: true, heightMm: 90, barMm: 10 },
        worked,
      ),
  },
  {
    id: "vline-cars",
    title: "Mock set 8 3F Q8: vertical line chart",
    note: "Blue, grey and white cars are shown. Part (b) gives 7 red cars to show on the graph, so the red line is saved as a hidden answer.",
    sourceId: "1MA1_MOCK_SET_08_3F_Q8",
    worked: true,
    make: (worked) =>
      chart(
        "vline",
        ["blue", "grey", "white", "red"],
        [{ name: "cars", fill: "black", values: ["6", "10", "8", "7"], hidden: [3] }],
        { min: "0", max: "12", step: "2", minor: 1 },
        { yTitle: "Number of cars", xTitle: "Colour of car", grid: "major", key: false, heightMm: 60, barMm: 12 },
        worked,
      ),
  },
  {
    id: "bar-draw",
    title: "Draw a bar chart from a table",
    note: "Teaching example: blank axes and grid for pupils to draw every bar. The table values are saved as hidden answers.",
    worked: true,
    make: (worked) =>
      chart(
        "bar",
        ["Apple", "Banana", "Orange", "Pear"],
        [{ name: "pupils", fill: "grey", values: ["7", "4", "9", "2"], hidden: [0, 1, 2, 3] }],
        { min: "0", max: "10", step: "2", minor: 2 },
        { yTitle: "Frequency", xTitle: "Favourite fruit", grid: "fine", key: false, heightMm: 60, barMm: 10 },
        worked,
      ),
  },
  {
    id: "pie-snacks",
    title: "June 2018 2F Q12: draw a pie chart",
    note: "Half-time snacks of 36 football fans. Pupils draw every sector from the starting radius; the frequencies are saved as hidden answers (110°, 170° and 80°).",
    sourceId: "1MA1_JUN_2018_2F_Q12",
    worked: true,
    make: (worked) =>
      chart(
        "pie",
        ["burger", "pie", "hot dog"],
        [{ name: "number of fans", fill: "white", values: ["11", "17", "8"], hidden: [0, 1, 2] }],
        { min: "0", max: "20", step: "2", minor: 1 },
        { yTitle: "Number of fans", xTitle: "Snack", grid: "none", key: false, heightMm: 60, barMm: 7, pie: { radiusMm: 50, labels: "name" } },
        worked,
      ),
  },
  {
    id: "pie-complete",
    title: "Complete a pie chart",
    note: "Teaching example: 60 pupils' favourite sports with football and tennis drawn. Pupils draw and label the rugby and swimming sectors, saved as hidden answers.",
    worked: true,
    make: (worked) =>
      chart(
        "pie",
        ["football", "tennis", "rugby", "swimming"],
        [{ name: "pupils", fill: "white", values: ["24", "15", "12", "9"], hidden: [2, 3] }],
        { min: "0", max: "30", step: "5", minor: 1 },
        { yTitle: "Frequency", xTitle: "Sport", grid: "none", key: false, heightMm: 60, barMm: 7, pie: { radiusMm: 40, labels: "name" } },
        worked,
      ),
  },
  {
    id: "pictogram-pictures",
    title: "November 2019 1F Q6: read and complete a pictogram",
    note: "Pictures sold in an art shop, with squares for 8 pictures. Part (b) gives 12 pictures in April, so the April row is saved as a hidden answer.",
    sourceId: "1MA1_NOV_2019_1F_Q6",
    worked: true,
    make: (worked) =>
      chart(
        "pictogram",
        ["January", "February", "March", "April"],
        [{ name: "pictures", fill: "white", values: ["24", "28", "20", "12"], hidden: [3] }],
        { min: "0", max: "30", step: "5", minor: 1 },
        { yTitle: "", xTitle: "", grid: "major", key: false, heightMm: 60, barMm: 7, pictogram: { symbol: "square", symbolMm: 10, key: { value: "8", show: "show" }, unit: "pictures" } },
        worked,
      ),
  },
  {
    id: "pictogram-cycles",
    title: "November 2017 3F Q6: complete a pictogram and its key",
    note: "Cycles sold, with 20 sold on Tuesday to Thursday. The key (one circle for 4 cycles) and the Friday (8) and Saturday (15) rows are saved as hidden answers.",
    sourceId: "1MA1_NOV_2017_3F_Q6",
    worked: true,
    make: (worked) =>
      chart(
        "pictogram",
        ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        [{ name: "cycles", fill: "white", values: ["4", "10", "6", "8", "15"], hidden: [3, 4] }],
        { min: "0", max: "16", step: "2", minor: 1 },
        { yTitle: "", xTitle: "", grid: "major", key: false, heightMm: 60, barMm: 7, pictogram: { symbol: "circle", symbolMm: 10, key: { value: "4", show: worked ? "show" : "hidden" }, unit: "cycles" } },
        worked,
      ),
  },
  {
    id: "scatter-judges",
    title: "Mock set 8 3F Q21: plot a point and estimate from a scatter graph",
    note: "Scores two judges gave eleven skaters, on 2 mm graph paper. Part (a)'s point (4.6, 3.8), a line of best fit and the reading at 3.7 for part (c) are saved as hidden answers; the line is chosen for this example.",
    sourceId: "1MA1_MOCK_SET_08_3F_Q21",
    worked: true,
    make: (worked) => {
      const e = create();
      e.document.kind = "scatter";
      const hide = worked ? "show" : "hidden";
      e.document.scatter = {
        points: [
          ["2", "1"], ["2", "2"], ["3", "3"], ["3.5", "2.5"], ["3.5", "4"], ["4", "3"],
          ["4.5", "3.5"], ["5", "4"], ["5", "4.5"], ["5", "5"], ["5.5", "4.5"], ["4.6", "3.8"],
        ].map(([x, y], i) => ({ x, y, show: i === 11 ? hide : "show", ring: false })),
        xAxis: { min: "0", max: "6", step: "1", title: "Score from judge A", mm: 120, broken: false },
        yAxis: { min: "0", max: "6", step: "1", title: "Score from judge B", mm: 120, broken: false },
        grid: "fine",
        minor: 10,
        bestFit: { from: { x: "2", y: "1.5" }, to: { x: "5.5", y: "4.8" }, show: hide },
        readings: [{ axis: "x", value: "3.7", show: hide }],
        table: "none",
      };
      return validate(e);
    },
  },
  {
    id: "scatter-plot",
    title: "Plot a scatter graph from a table",
    note: "Teaching example: hours of revision and test marks for ten pupils, printed in a table above the graph. Every point is saved as a hidden answer for pupils to plot, with one outlier ringed on the answers copy. The test-mark axis starts at 20 with a zig-zag.",
    worked: true,
    make: (worked) => {
      const e = create();
      e.document.kind = "scatter";
      e.document.scatter = {
        points: [
          ["1", "22"], ["2", "30"], ["3", "34"], ["4", "45"], ["5", "48"],
          ["6", "56"], ["7", "60"], ["8", "70"], ["2", "64"], ["9", "76"],
        ].map(([x, y], i) => ({ x, y, show: worked ? "show" : "hidden", ring: i === 8 })),
        xAxis: { min: "0", max: "10", step: "1", title: "Hours of revision", mm: 100, broken: false },
        yAxis: { min: "20", max: "80", step: "10", title: "Test mark", mm: 90, broken: true },
        grid: "fine",
        minor: 5,
        readings: [],
        table: "all",
      };
      return validate(e);
    },
  },
  {
    id: "histogram-puzzle",
    title: "June 2018 2H Q17: complete a frequency table from a histogram",
    note: "Times taken to finish a puzzle, on 2 mm graph paper. The first frequency (4) is given; the other four are saved as hidden answers in the table.",
    sourceId: "1MA1_JUN_2018_2H_Q17",
    worked: true,
    make: (worked) =>
      grouped(
        "histogram",
        [["0", "5", "4"], ["5", "15", "4"], ["15", "25", "6"], ["25", "30", "5"], ["30", "50", "4"]],
        {
          variable: "t",
          xAxis: { min: "0", max: "60", step: "10", stepMm: 20, title: "Time taken (t minutes)" },
          table: "frequency",
          histogram: { yAxis: { min: "0", max: "1", step: "0.2", stepMm: 20, title: "Frequency density" }, fill: "grey" },
        },
        { table: [1, 2, 3, 4] },
        worked,
      ),
  },
  {
    id: "histogram-complete",
    title: "November 2019 2H Q18: complete a histogram",
    note: "Heights of the trees in a park. 20% of the 40 trees are between 10 and 12.5 metres, so that bar (frequency 8) is saved as a hidden answer; the total of 40 is worked out from the other bars for this example.",
    sourceId: "1MA1_NOV_2019_2H_Q18",
    worked: true,
    make: (worked) =>
      grouped(
        "histogram",
        [["0", "2.5", "3"], ["2.5", "5", "5"], ["5", "10", "14"], ["10", "12.5", "8"], ["12.5", "25", "10"]],
        {
          variable: "",
          xAxis: { min: "0", max: "25", step: "5", stepMm: 20, title: "Height (metres)" },
          histogram: { yAxis: { min: "0", max: "4", step: "1", stepMm: 20, title: "Frequency density" }, fill: "grey" },
        },
        { graph: [3] },
        worked,
      ),
  },
  {
    id: "polygon-plants",
    title: "June 2019 3H Q3: draw a frequency polygon",
    note: "Heights of 80 plants from the table. Every point of the frequency polygon is saved as a hidden answer for pupils to plot at the class midpoints.",
    sourceId: "1MA1_JUN_2019_3H_Q3",
    worked: true,
    make: (worked) =>
      grouped(
        "polygon",
        [["10", "20", "7"], ["20", "30", "13"], ["30", "40", "14"], ["40", "50", "12"], ["50", "60", "16"], ["60", "70", "18"]],
        {
          variable: "h",
          xAxis: { min: "0", max: "70", step: "10", stepMm: 20, title: "Height (h cm)" },
          table: "frequency",
          polygon: { yAxis: { min: "0", max: "20", step: "5", stepMm: 20, title: "Frequency" } },
        },
        { graph: [0, 1, 2, 3, 4, 5] },
        worked,
      ),
  },
  {
    id: "cumulative-office",
    title: "June 2019 2H Q11: complete a cumulative frequency table, draw the graph and estimate",
    note: "Times 80 office workers take to get to work. The cumulative frequencies, the curve and the reading at 90 minutes for part (c) are saved as hidden answers. The paper's grid runs on past 80 without a number; here the vertical axis is numbered to 90.",
    sourceId: "1MA1_JUN_2019_2H_Q11",
    worked: true,
    make: (worked) =>
      grouped(
        "cumulative",
        [["0", "20", "5"], ["20", "40", "30"], ["40", "60", "20"], ["60", "80", "15"], ["80", "100", "8"], ["100", "120", "2"]],
        {
          variable: "t",
          xAxis: { min: "0", max: "140", step: "20", stepMm: 20, title: "Time (t minutes)" },
          table: "cumulative",
          cumulative: {
            yAxis: { min: "0", max: "90", step: "10", stepMm: 10, title: "Cumulative frequency" },
            curve: "smooth",
            fromZero: true,
            crosses: true,
            readings: [{ axis: "x", value: "90", show: worked ? "show" : "hidden" }],
          },
        },
        { graph: [0, 1, 2, 3, 4, 5], table: [0, 1, 2, 3, 4, 5] },
        worked,
      ),
  },
];
