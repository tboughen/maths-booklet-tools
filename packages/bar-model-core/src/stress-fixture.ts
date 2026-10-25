import * as v from "./v2";
/** An admissible dense combination, not a promise that every maximum can coexist. */
export function denseFixture(): v.Envelope {
  const e = v.fresh("equal-sections", 24),
    d = e.document;
  d.bars = [];
  d.annotations = [];
  d.presentation = {
    unitMm: 8,
    barHeightMm: 12,
    fontPt: 10,
    titlePt: 14,
    output: "colour",
  };
  for (let i = 0; i < 4; i++) {
    const bar: v.Bar = {
      id: `b${i + 1}`,
      name: v.label(`Quantity ${i + 1}`),
      offset: "0",
      parts: Array.from({ length: 24 }, (_, j) => ({
        id: `b${i + 1}p${j + 1}`,
        weight: "1",
        labels: {
          inside: v.label("1/2"),
          above: v.label("9"),
          below: v.label("x"),
        },
        fill: j % 2 ? "green" : "blue",
      })),
    };
    d.bars.push(bar);
    const groups = i === 0 ? 6 : 4,
      sections = 24 / groups;
    for (let k = 0; k < groups; k++)
      d.annotations.push({
        id: `a${i + 1}_${k + 1}`,
        scope: {
          kind: "range",
          from: {
            barId: bar.id,
            partId: bar.parts[k * sections].id,
            edge: "start",
          },
          to: {
            barId: bar.id,
            partId: bar.parts[(k + 1) * sections - 1].id,
            edge: "end",
          },
        },
        label: v.label("12"),
        decoration: k % 2 ? "dimension" : "brace",
        placement: k % 2 ? "below" : "above",
      });
  }
  d.title = v.label("Fraction comparison");
  d.captions = Array.from({ length: 3 }, (_, i) => ({
    id: `caption${i + 1}`,
    label: v.label(
      [
        "4/5 × 45 = 36",
        "6 ÷ 2 = 3",
        "Manual statements; no answers are calculated",
      ][i],
    ),
    alignment: "centre",
  }));
  return v.validate(e);
}
