import { describe, expect, it } from "vitest";
import {
  canonical,
  changeSets,
  create,
  exportIssue,
  expressionMasks,
  hasThirdData,
  layout,
  membership,
  parseFile,
  renderSvg,
  validate,
  warnings,
} from "./index";
import { examples } from "./examples";
describe("Venn mathematical and teaching states", () => {
  it("retains source givens in populated film and algebra scaffolds", () => {
    for (const id of ["films", "algebra"]) {
      const example = examples.find((x) => x.id === id)!;
      expect(example.make(false)).toEqual(example.make(true));
      expect(example.make(false).document.regions[3].text).not.toBe("");
    }
  });
  it("uses italic algebra letters with upright digits and operators", () => {
    const svg = renderSvg(
      examples.find((x) => x.id === "algebra")!.make(false),
    );
    expect(svg).toContain('>3<tspan font-style="italic">x</tspan> + 2</text>');
  });
  it("gives plain-language correction errors and rejects broken label text", () => {
    const e = create();
    e.document.labels[1].text = "A".repeat(25);
    expect(() => validate(e)).toThrow(
      "Use set labels of at most 24 characters",
    );
    e.document.labels[1].text = "A\u0001";
    expect(() => validate(e)).toThrow("ordinary text line");
  });
  it("supports empty two/three-set diagrams throughout the print width range", () => {
    for (const sets of [2, 3] as const)
      for (const width of [8, 10, 12, 14, 16]) {
        const e = create(sets);
        e.document.widthCm = width;
        expect(exportIssue(e)).toBe("");
      }
  });
  it("starts with four pupil regions, no invented zero or answers", () => {
    const e = create();
    expect(e.document.regions.every((r) => r.kind === "empty" && !r.text)).toBe(
      true,
    );
    expect(layout(e).anchors).toHaveLength(4);
    expect(renderSvg(e)).not.toContain(">0</text>");
  });
  it.each(examples.map((x) => [x.id, x] as const))(
    "keeps both %s reference outputs exportable and reopenable",
    (_, ex) => {
      for (const worked of [false, true]) {
        const e = ex.make(worked);
        expect(exportIssue(e)).toBe("");
        expect(parseFile(canonical(e))).toEqual(e);
      }
    },
  );
  it("preserves empty member lists, explicit zero, hidden answers and answer lines", () => {
    const e = create(3);
    e.document.regions[0] = {
      kind: "frequency",
      text: "0",
      visibility: "show",
      shade: "none",
    };
    e.document.regions[1] = {
      kind: "members",
      text: "",
      visibility: "show",
      shade: "none",
    };
    e.document.regions[3] = {
      kind: "number",
      text: "1/2",
      visibility: "hidden",
      shade: "grey",
    };
    e.document.regions[7].visibility = "line";
    const n = parseFile(canonical(e));
    expect(n).toEqual(e);
    expect(exportIssue(e)).toBe("");
    const svg = renderSvg(e);
    expect(svg).toContain(">0</text>");
    expect(svg).not.toContain(">1</text>");
    expect(svg).toContain('data-region="7"><path');
  });
  it("preserves a zero-valued member separately from frequency zero", () => {
    const e = create();
    e.document.regions[0] = {
      kind: "members",
      text: "0",
      visibility: "show",
      shade: "none",
    };
    expect(parseFile(canonical(e)).document.regions[0].kind).toBe("members");
  });
  it("defines three-set intersection, union and complement exactly", () => {
    expect(expressionMasks("A ∩ B", 3)).toEqual([3, 7]);
    expect(expressionMasks("(A ∪ B)'", 3)).toEqual([0, 4]);
    expect(expressionMasks("(A ∩ B)'", 3)).toEqual([0, 1, 2, 4, 5, 6]);
    expect(expressionMasks("A ∪ B ∩ C", 3)).toEqual([1, 3, 5, 6, 7]);
  });
  it("uses stable IDs when set labels change", () => {
    const e = create(3);
    e.document.labels[1].text = "French";
    expect(expressionMasks("A & B", 3)).toEqual([3, 7]);
    expect(() => expressionMasks("French", 3)).toThrow();
  });
  it.each(["", "C", "A + B", "(A", "A)", "A || B", "constructor", "A<script>"])(
    "rejects invalid two-set expression %s",
    (s) => expect(() => expressionMasks(s, 2)).toThrow(),
  );
  it("uses the same truth table for geometric anchors and shading", () => {
    for (const sets of [2, 3] as const)
      for (const shape of ["circles", "ovals"] as const) {
        const e = create(sets);
        e.document.shape = shape;
        const g = layout(e);
        g.anchors.forEach((a, i) => expect(membership(g, a.x, a.y)).toBe(i));
      }
  });
  it("adds and removes C without adding or merging content", () => {
    const e = examples[0].make(true);
    const n = changeSets(e, 3);
    expect(n.document.regions.slice(0, 4)).toEqual(
      e.document.regions.slice(0, 4),
    );
    expect(hasThirdData(n)).toBe(false);
    n.document.regions[7] = {
      kind: "frequency",
      text: "0",
      visibility: "hidden",
      shade: "grey",
    };
    expect(hasThirdData(n)).toBe(true);
    expect(changeSets(n, 2).document.regions.slice(0, 4)).toEqual(
      e.document.regions.slice(0, 4),
    );
  });
  it("rejects hidden third-set data in two sets", () => {
    const e = create();
    e.document.regions[7].shade = "grey";
    expect(() => validate(e)).toThrow(/third-set/);
  });
  it("retains meaningful disagreements as warnings", () => {
    const e = create();
    e.document.regions[0] = {
      kind: "frequency",
      text: "-1/2",
      visibility: "show",
      shade: "none",
    };
    e.document.regions[1] = {
      kind: "members",
      text: "3,3",
      visibility: "show",
      shade: "none",
    };
    expect(validate(e)).toEqual(e);
    expect(warnings(e)).toHaveLength(2);
    expect(renderSvg(e)).not.toContain("Teacher");
  });
  it.each(["1/0", "bogus", "1e999"])(
    "rejects invalid numerical input %s",
    (text) => {
      const e = create();
      e.document.regions[1] = {
        kind: "number",
        text,
        visibility: "show",
        shade: "none",
      };
      expect(() => validate(e)).toThrow();
    },
  );
  it("keeps fit problems saved while refusing misleading image exports", () => {
    const e = create(3);
    e.document.regions[7] = {
      kind: "text",
      text: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      visibility: "show",
      shade: "none",
    };
    expect(exportIssue(e)).toContain("does not fit");
    expect(parseFile(canonical(e))).toEqual(e);
  });
  it("keeps exact fractions and decimal formatting without evaluation", () => {
    const e = create();
    e.document.regions[1] = {
      kind: "number",
      text: "-2/4",
      visibility: "show",
      shade: "none",
    };
    e.document.regions[2] = {
      kind: "number",
      text: "0.50",
      visibility: "show",
      shade: "none",
    };
    const svg = renderSvg(e);
    expect(svg).toContain(">-2</text>");
    expect(svg).toContain(">4</text>");
    expect(svg).toContain(">0.50</text>");
  });
  it("exports physical sizes and keeps text size independent of geometry", () => {
    const e = create(3),
      a = layout(e);
    e.document.widthCm = 16;
    const b = layout(e);
    expect(b.font).toBe(a.font);
    expect(b.width).toBe(160);
    expect(b.height).toBe(140);
    expect(renderSvg(e)).toContain('width="16cm"');
  });
  it("qualifies 40 members in all eight regions at the largest print width", () => {
    const e = create(3);
    e.document.widthCm = 16;
    e.document.fontPt = 9;
    for (let i = 0; i < 8; i++)
      e.document.regions[i] = {
        kind: "members",
        text: i === 7 ? "0,-1,1/2,2,3" : "1,2,3,4,5",
        visibility: "show",
        shade: "none",
      };
    expect(exportIssue(e)).toBe("");
    e.document.regions[0].text += " ,6";
    expect(() => validate(e)).toThrow(/40/);
  });
  it("escapes text markup in the pupil SVG and bounds document imports", () => {
    const e = create();
    e.document.labels[1].text = "<script>";
    expect(renderSvg(e)).not.toContain("<script>");
    expect(renderSvg(e)).toContain("&lt;script&gt;");
    expect(() => parseFile(" ".repeat(40001))).toThrow(/large/);
    expect(() => validate({ ...e, rendererVersion: "venn-2" })).toThrow();
  });
});
