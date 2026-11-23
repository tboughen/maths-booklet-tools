/** Plain shapes: common bar models with the given values, every other label left for pupils. */
import { validate, type Annotation, type Bar, type Envelope } from "./v3";

type Part = [weight: string, inside: string, fill?: "none" | "blue" | "green"];
const lab = (text = "") => ({ text, state: text ? ("value" as const) : ("blank" as const) });
function bar(id: string, name: string, parts: Part[]): Bar {
  return {
    id,
    name: lab(name),
    offset: "0",
    parts: parts.map(([weight, inside, fill = "none"], i) => ({ id: `${id}p${i + 1}`, weight, labels: { inside: lab(inside) }, fill })),
  };
}
const whole = (id: string, barId: string, text: string, placement: "above" | "below" = "above"): Annotation => ({
  id,
  scope: { kind: "whole", barId },
  label: lab(text),
  decoration: "brace",
  placement,
});
function doc(bars: Bar[], annotations: Annotation[], sourceId: string, caption = ""): Envelope {
  return validate({
    kind: "bar-model",
    schemaVersion: 3,
    rendererVersion: "bar-model-3",
    styleProfile: "lesson-v3",
    document: { bars, annotations, presentation: { unitMm: 12, barHeightMm: 12, fontPt: 12, titlePt: 14, output: "grey" }, captions: caption ? [{ id: "caption1", label: lab(caption), alignment: "left", format: "plain" }] : [], sourceId },
  });
}
const equal = (n: number, fill: "none" | "blue" | "green" = "none"): Part[] => Array.from({ length: n }, () => ["1", "", fill] as Part);

export const plainShapes: { id: string; title: string; note: string; make: () => Envelope }[] = [
  { id: "equal-parts", title: "One bar in equal parts", note: "A bar of 40 split into five equal parts, for a fraction of an amount.", make: () => doc([bar("b1", "", equal(5))], [whole("whole", "b1", "40")], "plain-equal-parts") },
  {
    id: "sharing",
    title: "Two bars sharing in a ratio",
    note: "Amy and Ben share £30 in the ratio 2 : 3: two bars of equal parts with the total below them.",
    make: () => doc([bar("b1", "Amy", equal(2, "blue")), bar("b2", "Ben", equal(3, "green"))], [], "plain-sharing", "Total: £30"),
  },
  {
    id: "compare",
    title: "Two bars compared",
    note: "Ben has 12 more than Amy: the longer bar has an extra part labelled 12.",
    make: () => doc([bar("b1", "Amy", [["2", ""]]), bar("b2", "Ben", [["2", ""], ["1", "12"]])], [], "plain-compare"),
  },
  {
    id: "part-whole",
    title: "Part–whole bar",
    note: "A whole of 45 above a bar in two parts, one of them 28.",
    make: () => doc([bar("b1", "", [["3", "28"], ["2", ""]])], [whole("whole", "b1", "45")], "plain-part-whole"),
  },
  { id: "percentage", title: "Percentage bar", note: "A bar of £80 in ten equal parts, with 100% below it.", make: () => doc([bar("b1", "", equal(10))], [whole("whole", "b1", "£80"), whole("percent", "b1", "100%", "below")], "plain-percentage") },
];
