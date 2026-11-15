import { describe, expect, it } from "vitest";
import { canonical, create, forView, hasHidden, layout, parseFile, renderSvg, setAllShown, type Envelope } from "./index";
import { pictogramLayout } from "./pictogram";
import { examples } from "./examples";
import * as io from "./interchange";

const PINK = "#b0125b";
function pictogram(values: [string, "show" | "hidden"][], symbol: "circle" | "square" = "square", key = "8", keyShow: "show" | "hidden" = "show"): Envelope {
  const e = create();
  e.document.kind = "pictogram";
  e.document.xTitle = "";
  e.document.yTitle = "";
  e.document.categories = values.map((_, i) => `c${i + 1}`);
  e.document.series = [{ name: "f", fill: "white", values: values.map(([value, show]) => ({ value, show })) }];
  e.document.pictogram = { symbol, symbolMm: 10, key: { value: key, show: keyShow }, unit: "pictures" };
  return e;
}

describe("pictograms", () => {
  it("draws value ÷ key symbols with exact parts", () => {
    const g = pictogramLayout(pictogram([["24", "show"], ["28", "show"], ["20", "show"], ["2", "show"]]));
    expect(g.issues).toEqual([]);
    expect(g.rows.map((r) => [r.whole, r.part])).toEqual([[3, 0], [3, 0.5], [2, 0.5], [0, 0.25]]);
  });

  it("part squares are open on the right; part circles are left sectors", () => {
    const sq = renderSvg(pictogram([["12", "show"]]));
    expect(sq).toMatch(/<path d="M[\d.]+,[\d.]+H[\d.]+V[\d.]+H[\d.]+" fill="none"/);
    const half = renderSvg(pictogram([["2", "show"]], "circle", "4"));
    // The half circle's arc ends at the bottom of the circle, left of 12 o'clock, sweeping anticlockwise.
    expect(half).toMatch(/A5,5 0 0 0 /);
  });

  it("blank is an empty row, zero draws nothing, hidden rows are answers drawn in pink", () => {
    const e = pictogram([["", "show"], ["0", "show"], ["16", "hidden"]]);
    const g = pictogramLayout(e);
    expect(g.rows.map((r) => r.category)).toEqual([1, 2]);
    expect(g.rows[1].drawn).toBe(false);
    expect(renderSvg(e)).not.toContain(PINK);
    const a = renderSvg(forView(e, "answer", true));
    expect((a.match(new RegExp(`stroke="${PINK}"`, "g")) ?? []).length).toBe(2);
    expect(layout(forView(e, "answer", true)).width).toBe(layout(e).width);
  });

  it("a hidden key value leaves an answer line and keeps its width on the answers copy", () => {
    const e = pictogram([["8", "show"]], "square", "8", "hidden");
    const pupil = renderSvg(e);
    expect(pupil).toContain("stroke-dasharray");
    expect(pupil).not.toContain(">8<");
    expect(hasHidden(e)).toBe(true);
    const answer = forView(e, "answer", true);
    expect(renderSvg(answer)).toContain(`fill="${PINK}">8<`);
    expect(layout(answer).width).toBe(layout(e).width);
    expect(layout(forView(e, "answer")).width).toBe(layout(e).width);
    expect(setAllShown(e, "show").document.pictogram?.key.show).toBe("show");
    expect(setAllShown(e, "hidden").document.pictogram?.key.show).toBe("hidden");
    expect(e.document.pictogram?.key.show).toBe("hidden");
  });

  it("names specific errors and notes hard-to-read parts", () => {
    expect(pictogramLayout(pictogram([["8", "show"]], "square", "")).issues[0]).toMatch(/Enter what one symbol represents/);
    expect(pictogramLayout(pictogram([["8", "show"]], "square", "0")).issues[0]).toMatch(/positive number/);
    expect(pictogramLayout(pictogram([["x", "show"]])).issues).toEqual(["c1: enter a number, or leave it blank."]);
    expect(pictogramLayout(pictogram([["-8", "show"]])).issues).toEqual(["c1: values cannot be negative."]);
    expect(pictogramLayout(pictogram([["200", "show"]])).issues[0]).toMatch(/needs 25 symbols/);
    expect(pictogramLayout(pictogram([["1", "show"]], "circle", "3")).notes.join(" ")).toMatch(/not a whole number of quarters/);
    // The bar-chart axis does not apply.
    const e = pictogram([["8", "show"]]);
    e.document.axis = { min: "4", max: "1", step: "x", minor: 1 };
    expect(layout(e).issues).toEqual([]);
  });

  it("puts the key under the table when side by side would be wider than 18 cm", () => {
    const e = pictogram([["152", "show"]]);
    e.document.pictogram!.symbolMm = 6;
    const g = pictogramLayout(e);
    expect(g.issues).toEqual([]);
    expect(g.width).toBeLessThanOrEqual(180);
    expect(g.key.y).toBeGreaterThan(g.y0 + g.rowH);
  });

  it("examples round-trip and the connector merges pictogram settings", async () => {
    for (const id of ["pictogram-pictures", "pictogram-cycles"]) {
      const e = examples.find((x) => x.id === id)!.make(false);
      expect(parseFile(canonical(e))).toEqual(e);
      expect(layout(e).issues).toEqual([]);
    }
    const e = io.create({ spec: { example: "pictogram-cycles" } });
    expect(e.document.pictogram?.key.show).toBe("hidden");
    const r = await io.revise({ envelope: e, baseHash: await io.hash(e), operations: [{ op: "set_presentation", presentation: { pictogram: { symbolMm: 8 } } }] });
    expect(r.document.pictogram).toEqual({ symbol: "circle", symbolMm: 8, key: { value: "4", show: "hidden" }, unit: "cycles" });
    expect(() => parseFile(canonical({ ...r, document: { ...r.document, pictogram: { ...r.document.pictogram!, symbolMm: 20 } } }))).toThrow(/circle or square symbol/);
  });
});
