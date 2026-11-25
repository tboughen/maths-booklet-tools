import { create, type Envelope, type Solution } from "./index";
const interval = (lower: string, upper: string, li: boolean, ui: boolean): Solution => ({ kind: "interval", id: "set", lower, upper, lowerIncluded: li, upperIncluded: ui });
const ray = (value: string, direction: "left" | "right", included = false): Solution => ({ kind: "ray", id: "set", value, direction, included, intentional: false, stop: null });
export const examples = [
    { id: "1MA1_MOCK_SET_05_3F_Q15", part: "15(c)", title: "Mock Set 5 · 3F · Q15(c)", min: "-4", max: "5", variable: "x", prompt: "Show −1 ≤ x < 4 on the number line.", answer: "−1 ≤ x < 4", solution: interval("-1", "4", true, false), shown: false },
    { id: "1MA1_JUN_2017_1F_Q19", part: "19(b)", title: "June 2017 · 1F · Q19(b)", min: "-4", max: "3", variable: "t", prompt: "−3 < t ≤ 2; t is an integer.", answer: "−2, −1, 0, 1, 2", solution: { kind: "points", id: "points", points: [-2, -1, 0, 1, 2].map((v, i) => ({ id: `point-${i}`, value: String(v) })) } as Solution, shown: false, adaptation: "Adapted integer-solution scaffold; the source has no number-line diagram." },
    { id: "1MA1_NOV_2018_3F_Q19", part: "19(a)", title: "November 2018 · 3F · Q19(a)", min: "-5", max: "5", variable: "x", prompt: "Show x < 4 on the number line.", answer: "x < 4", solution: ray("4", "left"), shown: false },
    { id: "1MA1_NOV_2021_2F_Q21", part: "21(a)", title: "November 2021 · 2F · Q21(a)", min: "-5", max: "5", variable: "x", prompt: "Write down the inequality shown.", answer: "x > −1", solution: ray("-1", "right"), shown: true },
    { id: "1MA1_NOV_2021_2F_Q21", part: "21(b)", title: "November 2021 · 2F · Q21(b)", min: "-5", max: "5", variable: "y", prompt: "Show −3 ≤ y < 4 on the number line.", answer: "−3 ≤ y < 4", solution: interval("-3", "4", true, false), shown: false },
    { id: "1MA1_JUN_2019_2F_Q20", part: "20(b)", title: "June 2019 · 2F · Q20(b)", min: "-6", max: "6", variable: "x", prompt: "Show the values for −2 < x + 3 ≤ 4.", answer: "−5 < x ≤ 1", solution: interval("-5", "1", false, true), shown: false },
    { id: "1MA1_NOV_2019_1F_Q19", part: "19", title: "November 2019 · 1F · Q19", min: "-4", max: "4", variable: "p", prompt: "Write down the inequality shown.", answer: "−3 ≤ p < 1", solution: interval("-3", "1", true, false), shown: true },
    { id: "1MA1_MOCK_SET_06_1H_Q3", part: "3(a)", title: "Mock set 06 · 1H · Q3(a)", min: "-4", max: "5", variable: "x", prompt: "Show −1 < x ≤ 4 on the number line.", answer: "−1 < x ≤ 4", solution: interval("-1", "4", false, true), shown: false },
    { id: "1MA1_MOCK_SET_08_2H_Q4", part: "4(a)", title: "Mock set 08 · 2H · Q4(a)", min: "-5", max: "5", variable: "x", prompt: "Nadia drew x > −3. Explain what she must change.", answer: "Add a right arrow or extend to the end of the scale.", solution: { ...ray("-3", "right"), intentional: true, stop: "2.5" } as Solution, shown: true, adaptation: "Source error preserved; the drawn stop is a visual approximation." },
];
export function example(index: number, worked = false): Envelope { const x = examples[index]; if (!x)
    throw Error("Example not found."); let solution = x.solution; if (worked && solution.kind === "ray" && solution.intentional)
    solution = { ...solution, intentional: false, stop: null }; return create({ axis: { minimum: x.min, maximum: x.max, variable: x.variable }, solution, teaching: { prompt: x.prompt, answer: x.answer, answerVisible: worked, solutionVisible: worked || x.shown, responseLines: x.shown && !worked ? 1 : 0 } }); }

const line = (axis: Record<string, unknown>, solution: Solution | null = null, widthCm = 14) => () => create({ axis: { variable: "", ...axis }, solution, widthCm });
/** Plain shapes: common number lines with every value given, before the exam-style examples. */
export const plainShapes: { id: string; title: string; note: string; make: () => Envelope }[] = [
    { id: "zero-to-ten", title: "0 to 10", note: "A number line from 0 to 10 in ones.", make: line({ minimum: "0", maximum: "10" }) },
    { id: "negative-ten-to-ten", title: "−10 to 10", note: "A number line from −10 to 10 in ones, for negative numbers.", make: line({ minimum: "-10", maximum: "10" }, null, 18) },
    { id: "tenths", title: "0 to 1 in tenths", note: "A number line from 0 to 1 in steps of 0.1, for decimals.", make: line({ minimum: "0", maximum: "1", step: "0.1" }) },
    { id: "quarters", title: "0 to 1 in quarters", note: "A number line from 0 to 1 in quarters, with stacked fractions.", make: line({ minimum: "0", maximum: "1", step: "1/4", numberFormat: "fraction" }) },
    { id: "inequality", title: "Inequality x > 2", note: "x > 2 shown with an open circle and an arrow.", make: line({ minimum: "-5", maximum: "5", variable: "x" }, ray("2", "right")) },
    { id: "interval", title: "Interval −1 ≤ x < 3", note: "−1 ≤ x < 3 shown with a closed and an open circle.", make: line({ minimum: "-5", maximum: "5", variable: "x" }, interval("-1", "3", true, false)) },
    { id: "error-interval", title: "Error interval (1 dp)", note: "3.7 to 1 decimal place: 3.65 ≤ x < 3.75 on a line in hundredths.", make: line({ minimum: "3.6", maximum: "3.8", step: "0.01", labelEvery: 5, variable: "x" }, interval("3.65", "3.75", true, false)) },
];
