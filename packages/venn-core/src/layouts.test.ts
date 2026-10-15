import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  create,
  createExtended,
  upgrade,
  activeMasks,
  arrangement,
  changeArrangement,
  changeSets,
  hasRegionData,
  expressionMasks,
  forView,
  relationship,
  renderSvg,
  parseFile,
  canonical,
  layout,
  membership,
  exportIssue,
  validate,
} from "./index";
import { renderSvg as legacySvg } from "./legacy";
import { teachingExamples } from "./examples";

describe("Venn layout relationships", () => {
  const cases = [
    ["overlap", [0, 1, 2, 3]],
    ["separate", [0, 1, 2]],
    ["b-inside-a", [0, 1, 3]],
    ["a-inside-b", [0, 2, 3]],
  ] as const;
  it.each(cases)(
    "%s has only realizable editing and shading regions",
    (value, expected) => {
      for (const shape of ["circles", "ovals"] as const) {
        const e = changeArrangement(create(), value);
        e.document.shape = shape;
        expect(activeMasks(e)).toEqual(expected);
        const g = layout(e);
        for (const mask of activeMasks(e)) {
          const a = g.anchors[mask];
          expect(membership(g, a.x, a.y)).toBe(mask);
        }
        expect(exportIssue(e)).toBe("");
        for (const mask of [0, 1, 2, 3])
          expect(renderSvg(e).includes(`data-region="${mask}"`)).toBe(
            expected.some((m) => m === mask),
          );
        expect(parseFile(canonical(e))).toEqual(e);
      }
    },
  );
  it.each([1, 2, 3] as const)(
    "keeps blank %i-set diagrams printable throughout supported sizes",
    (sets) => {
      for (const widthCm of [8, 12, 16])
        for (const fontPt of [9, 11, 14])
          for (const shape of ["circles", "ovals"] as const) {
            const e = createExtended(sets);
            e.document.widthCm = widthCm;
            e.document.fontPt = fontPt;
            e.document.shape = shape;
            expect(exportIssue(e)).toBe("");
            expect(layout(e).circles).toHaveLength(sets);
          }
    },
  );
  it("one set has just inside/outside and accepts only A in expressions", () => {
    const e = createExtended(1);
    expect(activeMasks(e)).toEqual([0, 1]);
    expect(expressionMasks("A'", 1, activeMasks(e))).toEqual([0]);
    expect(() => expressionMasks("B", 1, activeMasks(e))).toThrow(/A/);
    e.document.regions[2].visibility = "hidden";
    expect(() => validate(e)).toThrow(/impossible/);
  });
  it("restricts union, intersection and complement to each relationship", () => {
    for (const [value] of cases) {
      const e = changeArrangement(create(), value),
        masks = activeMasks(e);
      const intersection = expressionMasks("A ∩ B", 2, masks),
        union = expressionMasks("A ∪ B", 2, masks);
      expect(intersection).toEqual(value === "separate" ? [] : [3]);
      expect(union).toEqual(masks.filter((m) => m !== 0));
      expect(expressionMasks("(A ∪ B)'", 2, masks)).toEqual([0]);
      if (value === "b-inside-a") {
        expect(expressionMasks("A ∩ B'", 2, masks)).toEqual([1]);
        expect(expressionMasks("B ∩ A'", 2, masks)).toEqual([]);
      }
      if (value === "a-inside-b")
        expect(expressionMasks("A ∩ B'", 2, masks)).toEqual([]);
    }
  });
  it("clears only incompatible regions and preserves exact compatible states", () => {
    const e = create();
    e.document.regions[1] = {
      kind: "number",
      text: "-2/4",
      visibility: "line",
      shade: "hatch",
    };
    e.document.regions[2] = {
      kind: "frequency",
      text: "0",
      visibility: "hidden",
      shade: "grey",
    };
    e.document.regions[3] = {
      kind: "algebra",
      text: "3x + 2",
      visibility: "hidden",
      shade: "grey",
    };
    const separate = changeArrangement(e, "separate"),
      nested = changeArrangement(e, "b-inside-a");
    expect(separate.document.regions[1]).toEqual(e.document.regions[1]);
    expect(separate.document.regions[2]).toEqual(e.document.regions[2]);
    expect(hasRegionData(separate.document.regions[3])).toBe(false);
    expect(nested.document.regions[3]).toEqual(e.document.regions[3]);
    expect(hasRegionData(nested.document.regions[2])).toBe(false);
    expect(e.document.regions[2].text).toBe("0");
  });
  it("new one-set transitions clear all region meanings without losing print settings or labels", () => {
    const e = upgrade(create());
    e.document.regions[1].text = "retained draft";
    e.document.widthCm = 16;
    e.document.definitions[1] = "A = {even numbers}";
    const one = changeSets(e, 1);
    expect(one.document.regions.some(hasRegionData)).toBe(false);
    expect(one.document.widthCm).toBe(16);
    expect(one.document.definitions[1]).toBe(e.document.definitions[1]);
    one.document.regions[1] = {
      kind: "members",
      text: "2,4",
      visibility: "hidden",
      shade: "hatch",
    };
    expect(changeSets(one, 2).document.regions.some(hasRegionData)).toBe(false);
    expect(one.document.regions[1].text).toBe("2,4");
  });
  it("rejects unsupported or contradictory version/relationship combinations", () => {
    const e = createExtended(1);
    e.document.arrangement = "separate";
    expect(() => validate(e)).toThrow(/two sets/);
    const n = createExtended();
    n.document.caption = "relationship";
    expect(() => validate(n)).toThrow(/captions/);
    expect(() =>
      validate({ ...create(), rendererVersion: "venn-2" }),
    ).toThrow();
    const nested = changeArrangement(create(), "b-inside-a");
    nested.document.regions[2].shade = "grey";
    expect(() => validate(nested)).toThrow(/impossible/);
  });
  it("captions express non-strict containment and print outside the universal rectangle", () => {
    const e = upgrade(changeArrangement(create(), "b-inside-a"));
    e.document.caption = "relationship";
    expect(relationship(e)).toBe("B ⊆ A");
    const g = layout(e);
    expect(g.height).toBe(97);
    expect(g.box.height).toBe(81);
    expect(renderSvg(e)).toContain("B ⊆ A");
    e.document.labels[1].text = "Evens";
    expect(relationship(e)).toBe("B ⊆ Evens");
    expect(relationship(changeArrangement(e, "separate"))).toBe(
      "Evens ∩ B = ∅",
    );
    expect(arrangement(changeSets(e, 3))).toBe("overlap");
    expect(exportIssue(changeArrangement(e, "overlap"))).toBe("");
  });
  it("answer view only reveals entered content and does not alter the saved pupil document", () => {
    const e = createExtended(1);
    e.document.regions[0] = {
      kind: "frequency",
      text: "0",
      visibility: "line",
      shade: "grey",
    };
    e.document.regions[1] = {
      kind: "empty",
      text: "retained",
      visibility: "hidden",
      shade: "none",
    };
    e.document.labels[1].visibility = "hidden";
    const before = canonical(e),
      answer = forView(e, "answer");
    expect(answer.document.regions[0].visibility).toBe("show");
    expect(answer.document.regions[1].visibility).toBe("hidden");
    expect(answer.document.labels[1].visibility).toBe("show");
    expect(canonical(e)).toBe(before);
    expect(forView(e, "pupil")).toBe(e);
    expect(renderSvg(e)).not.toContain(">0</text>");
    expect(renderSvg(answer)).toContain(">0</text>");
  });
  it.each(teachingExamples.map((ex) => [ex.id, ex] as const))(
    "%s teaching scaffold retains supplied answers and a complete finite universe",
    (_, ex) => {
      const scaffold = ex.make(false),
        answer = forView(scaffold, "answer"),
        worked = ex.make(true);
      expect(exportIssue(scaffold)).toBe("");
      expect(exportIssue(answer)).toBe("");
      expect(exportIssue(worked)).toBe("");
      expect(renderSvg(answer)).toBe(renderSvg(worked));
      const values = activeMasks(worked).flatMap((i) =>
        worked.document.regions[i].text.split(",").filter(Boolean),
      );
      expect(values.map(Number).sort((a, b) => a - b)).toEqual(
        Array.from({ length: 12 }, (_, i) => i + 1),
      );
    },
  );
  it("preserves every retained schema-1 file and exact legacy SVG bytes", () => {
    const dir = resolve("docs/venn-examples");
    for (const name of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
      const e = parseFile(readFileSync(resolve(dir, name), "utf8"));
      expect(e.schemaVersion).toBe(1);
      expect(renderSvg(e)).toBe(
        legacySvg(e as Parameters<typeof legacySvg>[0]),
      );
      expect(parseFile(canonical(e))).toEqual(e);
    }
  });
  it("rejects an inner label that would erase the outer boundary while preserving it for correction", () => {
    const e = upgrade(changeArrangement(create(), "b-inside-a"));
    e.document.labels[2].text = "ABCDEFGHIJKLMNOPQRSTUVWX";
    expect(exportIssue(e)).toContain("inner set label");
    expect(parseFile(canonical(e)).document.labels[2].text).toBe(
      e.document.labels[2].text,
    );
    e.document.labels[2].text = "Multiples of 4";
    expect(exportIssue(e)).toBe("");
    e.document.labels[2].visibility = "hidden";
    expect(layout(e).labelBoxes).toHaveLength(2);
    expect(layout(forView(e, "answer")).labelBoxes).toHaveLength(3);
  });
  it.each(["one", "separate", "b-inside-a", "a-inside-b"] as const)(
    "qualifies a 40-member %s diagram without shrinking text",
    (value) => {
      const e =
        value === "one"
          ? createExtended(1)
          : upgrade(changeArrangement(create(), value));
      e.document.widthCm = 16;
      e.document.fontPt = 9;
      const masks = activeMasks(e),
        counts = masks.length === 2 ? [20, 20] : [16, 14, 10];
      let n = 1;
      masks.forEach(
        (m, i) =>
          (e.document.regions[m] = {
            kind: "members",
            text: Array.from({ length: counts[i] }, () => String(n++)).join(
              ",",
            ),
            visibility: "show",
            shade: "none",
          }),
      );
      for (const shape of ["circles", "ovals"] as const) {
        e.document.shape = shape;
        expect(exportIssue(e)).toBe("");
      }
    },
  );
});
