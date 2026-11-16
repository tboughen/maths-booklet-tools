import { describe, expect, it } from "vitest";
import { createRatioTable } from "./interchange";
import { headingWidth, ratioMetrics, renderRatioSvg } from "./svg";

// Units in headings for real-context tables (A3 worksheets, 16 Nov 2026).
const table = (columns: string[]) =>
  createRatioTable({ columns, table: [["1", "2"], ["3", "[6]"]] }).document;

describe("ratio table unit headings", () => {
  it("accepts free-text units with brackets, slash, % and °, with or without arrows", () => {
    for (const heading of ["Time (min)", "Distance (km)", "Speed (m/s)", "°C", "Temperature (°C)", "Cost (£)", "Percent (%)"]) {
      for (const suffix of ["", " →", " ↑"]) {
        const d = table([heading + suffix, "y"]);
        expect(d.headings[0].text).toBe(heading);
        expect(d.headings[0].italic).toBe(false);
      }
    }
  });
  it("refuses headings over 16 characters or with other symbols", () => {
    expect(() => table(["Distance travelled (km)", "y"])).toThrow();
    expect(() => table(["Time [min]", "y"])).toThrow();
  });
  it("widens the columns to fit a long heading and keeps short tables exactly as before", () => {
    expect(ratioMetrics(table(["x", "y"])).cellWidth).toBe(150);
    expect(ratioMetrics(table(["Time", "Cost"])).cellWidth).toBe(150);
    const d = table(["Distance (km) ↑", "Time (min) ↑"]),
      m = ratioMetrics(d);
    expect(m.cellWidth).toBeGreaterThan(150);
    for (const h of d.headings) expect(headingWidth(h) + 38 + 40).toBeLessThanOrEqual(m.cellWidth);
    expect(m.tableWidth).toBe(2 * m.cellWidth);
    // Headings print at full size, centred in the widened column, never shrunk.
    const svg = renderRatioSvg(d);
    expect(svg).toContain(">Distance (km)</text>");
    expect(svg).toMatch(/font-size="42\.3\d*"[^>]*>Distance \(km\)/);
  });
});
