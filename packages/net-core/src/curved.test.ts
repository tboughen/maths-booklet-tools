import { describe, expect, it } from "vitest";
import { create, outline, renderSvg, validate, warnings, coneNet, cylinderNet } from "./index";

describe("cylinder and cone nets", () => {
  it("draws a cylinder as a rectangle 2πr wide with two circles as true arcs", () => {
    const e = create({ type: "cylinder", radius: 1, height: 4 });
    const [side, top, bottom] = e.document.nets[0].faces;
    const xs = side.points.map((p) => p[0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(2 * Math.PI, 2);
    expect(top.arcs).toHaveLength(3);
    expect(bottom.arcs).toHaveLength(3);
    expect(renderSvg(e).match(/A1?0 10 0 0 1 /g)?.length).toBeGreaterThanOrEqual(6);
    expect(warnings(e).join(" ")).not.toMatch(/faces; a cylinder/);
  });
  it("draws a cone's sector with angle 360° × r ÷ l, the long way round past a half turn", () => {
    for (const [r, l] of [
      [2, 5],
      [3, 4],
    ]) {
      const [sector] = coneNet(r, l);
      const [c, a, b] = sector.points;
      const turn = Math.abs(Math.atan2(b[1] - c[1], b[0] - c[0]) - Math.atan2(a[1] - c[1], a[0] - c[0]));
      const angle = (2 * Math.PI * r) / l;
      expect(sector.arcs![0].large).toBe(angle > Math.PI);
      expect(angle > Math.PI ? 2 * Math.PI - turn : turn).toBeCloseTo(angle, 2);
    }
    expect(() => coneNet(5, 5)).toThrow(/slant height must be longer/);
  });
  it("keeps every net inside its panel, with one square to spare", () => {
    for (const faces of [cylinderNet(1.5, 3), coneNet(3, 4), coneNet(1, 6)]) {
      const pts = faces.flatMap((f) => outline(f));
      expect(Math.min(...pts.map((p) => p[0]))).toBeCloseTo(1, 2);
      expect(Math.min(...pts.map((p) => p[1]))).toBeCloseTo(1, 2);
    }
  });
  it("refuses a curved edge whose corners are different distances from its centre", () => {
    const e = create({ type: "cone", radius: 2, slant: 5 });
    e.document.nets[0].faces[0].arcs![0].centre = [3, 3];
    expect(() => validate(e)).toThrow(/same distance from its centre/);
  });
  it("prints straight faces exactly as before (no curved edges, closed by Z)", () => {
    expect(renderSvg(create())).not.toMatch(/ A\d/);
  });
});
