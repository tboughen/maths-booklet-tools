import * as v from "./v2";
export const lessonExampleNames = [
  "R1",
  "R2-P",
  "R2-C",
  "R3a",
  "R3b",
  "R3c",
  "R3d",
  "R4",
  "R5",
] as const;
export function lessonExample(
  name: (typeof lessonExampleNames)[number],
  worked = false,
): v.Envelope {
  let e = v.fresh("equal-sections", 5);
  const l = v.label;
  function range(
    id: string,
    start: number,
    end: number,
    text: string,
    placement: v.Annotation["placement"],
    known = true,
  ) {
    const b = e.document.bars[0];
    e.document.annotations.push({
      id,
      scope: {
        kind: "range",
        from: { barId: b.id, partId: b.parts[start].id, edge: "start" },
        to: { barId: b.id, partId: b.parts[end - 1].id, edge: "end" },
      },
      label: l(text, known || worked ? "value" : "line"),
      decoration: "brace",
      placement,
    });
  }
  function caption(text: string, known = false) {
    e.document.captions.push({
      id: `caption${e.document.captions.length + 1}`,
      label: l(text, known || worked ? "value" : "blank"),
      alignment: "centre",
    });
  }
  if (name === "R1") {
    e = v.fresh();
    const b = e.document.bars[0];
    b.parts[0].weight = "2";
    b.parts[1].weight = "3";
    b.parts[0].labels.inside = l("b");
    b.parts[1].labels.inside = l("c");
    b.parts[0].fill = "blue";
    b.parts[1].fill = "green";
    e.document.annotations[0].label = l("a");
    e.document.annotations[0].decoration = "dimension";
    caption("a = b + c", true);
    caption("a - b = c", true);
  } else if (name === "R2-P" || name === "R2-C") {
    e = v.fresh("comparison", 5, [3, 5], name === "R2-P");
    const [b, c] = e.document.bars;
    if (name === "R2-P") {
      b.parts = Array.from({ length: 7 }, (_, i) => ({
        id: `b1p${i + 1}`,
        weight: "1",
        labels: { inside: l() },
        fill: "blue",
      }));
      c.parts = Array.from({ length: 4 }, (_, i) => ({
        id: `b2p${i + 1}`,
        weight: "1",
        labels: { inside: l() },
        fill: "green",
      }));
    } else {
      b.parts[0].weight = "7";
      c.parts[0].weight = "4";
      b.parts[0].fill = "blue";
      c.parts[0].fill = "green";
    }
    b.name = l("Mia");
    c.name = l("Jack");
    e.document.annotations = [
      {
        id: "difference",
        scope: {
          kind: "range",
          from: { barId: c.id, partId: c.parts.at(-1)!.id, edge: "end" },
          to: { barId: b.id, partId: b.parts.at(-1)!.id, edge: "end" },
        },
        label: l("3", worked ? "value" : "line"),
        decoration: "dimension",
        placement: "between",
      },
      ...[b, c].map((bar, i) => ({
        id: `total${i + 1}`,
        scope: { kind: "whole" as const, barId: bar.id },
        label: l(i ? "4" : "7"),
        decoration: "none" as const,
        placement: name === "R2-P" ? ("above" as const) : ("inside" as const),
      })),
    ];
    caption("7 - 4 = 3");
  } else if (name === "R5") {
    e = v.fresh("inline-ratio");
    e.document.annotations = [];
    const b = e.document.bars[0];
    b.parts.forEach((p, i) => {
      p.labels.inside = l("3", worked ? "value" : "hidden");
      p.fill = i < 3 ? "blue" : "green";
    });
    range("eve", 0, 3, "Eve", "above");
    range("fred", 3, 8, "Fred", "above");
    range("share1", 0, 3, "9", "below", false);
    range("share2", 3, 8, "15", "below", false);
    range("difference", 6, 8, "6", "below");
    caption("6 ÷ 2 = 3");
  } else {
    const params: Record<string, [number, number, string, string, string]> = {
      R3a: [5, 4, "45", "36", "9"],
      R3b: [8, 3, "48", "18", "6"],
      R3c: [7, 6, "56", "48", "8"],
      R3d: [9, 5, "81", "45", "9"],
      R4: [5, 4, "45", "36", "9"],
    };
    const [n, selected, total, amount, unit] = params[name];
    e = v.fresh("equal-sections", n);
    const b = e.document.bars[0];
    b.parts.forEach((p, i) => {
      p.fill = i < selected ? "blue" : "none";
      p.labels.inside = l(
        name === "R4" ? "1/5" : unit,
        name === "R4" || worked ? "value" : "hidden",
      );
      if (name === "R4") p.labels.above = l(unit, worked ? "value" : "hidden");
    });
    e.document.annotations[0].label = l(total);
    range("selected", 0, selected, amount, "below", name === "R4");
    caption(
      name === "R4" && !worked
        ? "n/5 of 45 = 36"
        : `${selected}/${n} × ${total} = ${amount}`,
      name === "R4" && !worked,
    );
  }
  e.document.presentation.unitMm = 12;
  e.document.sourceId = `lesson-v2-${name}`;
  return v.validate(e);
}
