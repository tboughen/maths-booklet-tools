import { describe, it, expect } from "vitest";
import {
  create,
  newShape,
  validate,
  layout,
  renderSvg,
  exportIssue,
  setDimension,
  setUnit,
  setCubeSide,
  decomposition,
  calculations,
  canonical,
  parseFile,
  encode,
  decode,
  labelText,
  grow,
} from "./index";
import { examples } from "./examples";
describe("Cuboid mathematics and teaching intent", () => {
  it("counts exact spatial cubes rather than visible squares", () => {
    const s = newShape();
    expect(decomposition(s)).toMatchObject({
      width: 4,
      depth: 3,
      height: 2,
      total: 24,
    });
    s.dimensions.height = "3";
    expect(decomposition(s).total).toBe(36);
  });
  it("uses exact rational divisibility and never rounds", () => {
    let s = setDimension(newShape(), "width", "5/2");
    expect(() => decomposition(s)).toThrow(/whole number/);
    s = setCubeSide(s, "1/2");
    expect(decomposition(s).total).toBe(120);
    s.dimensions.width = "2.500001";
    expect(() => decomposition(s)).toThrow(/whole number/);
  });
  it("distinguishes 2 and 4 cm cubes from cubic centimetres", () => {
    const two = examples.find((x) => x.id.includes("06"))!.create(true);
    expect(decomposition(two.document.shapes[1]).total).toBe(12);
    expect(calculations(two.document.shapes[0]).volume).toBe("8");
    const four = examples.find((x) => x.id.includes("08"))!.create(true);
    expect(decomposition(four.document.shapes[0]).total).toBe(80);
    expect(calculations(four.document.shapes[1]).volume).toBe("64");
  });
  it("preserves physical dimensions during exact unit conversion", () => {
    const s = newShape(),
      mm = setUnit(s, "mm"),
      metres = setUnit(mm, "m");
    expect(mm.dimensions).toEqual({ width: "40", depth: "30", height: "20" });
    expect(metres.dimensions).toEqual({
      width: "1/25",
      depth: "3/100",
      height: "1/50",
    });
    expect(
      decomposition(
        validate({ ...create(), document: { widthCm: 10, shapes: [metres] } })
          .document.shapes[0],
      ).total,
    ).toBe(24);
  });
  it("enforces equal cube edges and grows them as one action", () => {
    const s = {
      ...newShape(),
      cube: true,
      dimensions: { width: "2", depth: "2", height: "2" },
    };
    expect(setDimension(s, "height", "3").dimensions).toEqual({
      width: "3",
      depth: "3",
      height: "3",
    });
    expect(grow(s, "depth", 1).dimensions.width).toBe("3");
    expect(() =>
      validate({
        ...create(),
        document: {
          widthCm: 10,
          shapes: [{ ...s, dimensions: { ...s.dimensions, height: "4" } }],
        },
      }),
    ).toThrow(/equal/);
  });
  it("preserves deliberate blanks and zero text without computing answers", () => {
    const e = examples.find((x) => x.id === "missing-height")!.create(false);
    for (const view of ["plain", "cubes", "layers"] as const) {
      e.document.shapes[0].view = view;
      const back = decode(encode(parseFile(canonical(e))));
      expect(back.document.shapes[0].labels.height.mode).toBe("blank");
      expect(renderSvg(back)).not.toContain("Volume =");
    }
    e.document.shapes[0].labels.front = { mode: "text", text: "0", x: 0, y: 0 };
    expect(labelText(e.document.shapes[0], "front")).toBe("0");
  });
  it("renders every layer and excludes artificial gaps from height arrows", () => {
    const e = create();
    e.document.shapes[0].view = "layers";
    e.document.shapes[0].arrows = true;
    e.document.shapes[0].dimensions.height = "3";
    const svg = renderSvg(e);
    expect(svg.match(/<g data-layer=/g)).toHaveLength(3);
    expect(svg).toContain('data-cube-count="36"');
    expect(svg).not.toContain('marker-start="url(#arrow)"');
    expect(svg).toContain("Full height: 3 cm");
  });
  it("mirrors the geometry without changing counts or labels", () => {
    const e = create();
    e.document.shapes[0].view = "cubes";
    const right = layout(e);
    e.document.shapes[0].direction = "left";
    const left = layout(e);
    expect(left.svg).not.toEqual(right.svg);
    expect(left.svg).toContain('data-cube-count="24"');
    expect(left.targets.every((t) => t.x >= 0 && t.x <= left.width)).toBe(true);
  });
  it("draws exactly the three hidden edges in either direction", () => {
    const e = create();
    e.document.shapes[0].hiddenEdges = true;
    for (const dir of ["left", "right"] as const) {
      e.document.shapes[0].direction = dir;
      expect(renderSvg(e).match(/stroke-dasharray=/g)).toHaveLength(3);
    }
  });
  it("enforces division and layer limits without losing plain resources", () => {
    const e = create();
    e.document.shapes[0].dimensions.height = "21";
    expect(() =>
      validate({
        ...e,
        document: {
          ...e.document,
          shapes: [{ ...e.document.shapes[0], view: "layers" }],
        },
      }),
    ).toThrow(/20 layers/);
    expect(validate(e).document.shapes[0].view).toBe("plain");
    e.document.shapes[0].dimensions.width = "41";
    expect(() => decomposition(e.document.shapes[0])).toThrow(/40 cubes/);
  });
  it("blocks misleading or unreadable print output", () => {
    const e = create();
    e.document.shapes[0].view = "cubes";
    e.document.shapes[0].dimensions = { width: "40", depth: "20", height: "2" };
    expect(exportIssue(e)).toMatch(/2 mm/);
    expect(() => renderSvg(e)).toThrow(/2 mm/);
    e.document.shapes[0].view = "plain";
    expect(exportIssue(e)).toBeNull();
  });
  it("supports 8000 cubes and all 20 full separated layers", () => {
    const e = create();
    e.document.widthCm = 16;
    const s = e.document.shapes[0];
    s.dimensions = { width: "20", depth: "20", height: "20" };
    s.view = "layers";
    expect(exportIssue(e)).toBeNull();
    const svg = renderSvg(e);
    expect(svg).toContain('data-cube-count="8000"');
    expect(svg.match(/<g data-layer=/g)).toHaveLength(20);
  });
  it("creates correct face areas without disclosing unknown lengths", () => {
    const e = examples.find((x) => x.id.endsWith("3H_Q8"))!.create(false),
      s = e.document.shapes[0];
    expect(labelText(s, "front")).toBe("45 cm²");
    expect(labelText(s, "top")).toBe("27 cm²");
    expect(labelText(s, "side")).toBe("15 cm²");
    expect(labelText(s, "width")).toBe("");
    expect(calculations(s).volume).toBe("135");
  });
  it("escapes teacher text and rejects malformed or incompatible saved data", () => {
    const e = create();
    e.document.shapes[0].caption = '<script>alert("x")</script>';
    expect(renderSvg(e)).not.toContain("<script>");
    expect(() => parseFile('{"tool":"graph"}')).toThrow();
    expect(() =>
      validate({
        ...e,
        document: {
          ...e.document,
          shapes: [e.document.shapes[0], e.document.shapes[0]],
        },
      }),
    ).toThrow(/distinct/);
    expect(() => setDimension(newShape(), "depth", "0")).toThrow(/positive/);
  });
  it("round-trips every scaffold and explicit worked source example", () => {
    for (const example of examples)
      for (const worked of [false, true]) {
        const e = example.create(worked);
        expect(canonical(parseFile(canonical(e)))).toBe(canonical(e));
        expect(exportIssue(e), `${example.id}/${worked}`).toBeNull();
        expect(renderSvg(e)).toContain('fill="white"');
      }
  });
  it("uses a common physical scale for numeric comparison diagrams", () => {
    const e = examples.find((x) => x.id.includes("06"))!.create(false),
      svg = renderSvg(e);
    const widths = [...svg.matchAll(/data-width-mm="([\d.]+)"/g)].map((m) =>
      Number(m[1]),
    );
    expect(widths[1] / widths[0]).toBeCloseTo(4);
    const heights = [...svg.matchAll(/data-height-mm="([\d.]+)"/g)].map((m) =>
      Number(m[1]),
    );
    expect(heights[1] / heights[0]).toBeCloseTo(3);
  });
});
