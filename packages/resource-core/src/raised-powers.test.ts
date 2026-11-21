import { describe, expect, it } from "vitest";
import { parseRuns, textSvg, wrap } from "./text";
import { typesetText } from "./typeset";
import { runs } from "./docx";

// Year 8 A4.04 to A4.06 (laws of indices): a³ and a⁴ side by side must look alike, and powers sit inside fractions.
describe("raised powers: squares, cubes and fraction parts", () => {
  it("prints a typed ² or ³ as a raised run like any other power", () => {
    const r = parseRuns(typesetText("a^3 × a^4"), "regular", true);
    expect(r.filter((x) => x.sup).map((x) => x.text)).toEqual(["3", "4"]);
    expect(r.map((x) => x.text).join("")).toBe("a3 × a4");
  });
  it("raises a power inside a stacked fraction part with dy, keeping the part one centred text", () => {
    const [line] = wrap(typesetText("{x^7/x^3}"), 4, 200, "regular", true);
    const svg = textSvg(line, 0, 10, 4, "#000");
    expect(svg).toMatch(/dy="-[\d.]+">7<\/tspan>/);
    expect(svg).toMatch(/dy="-[\d.]+">3<\/tspan>/);
    expect(svg).not.toMatch(/<tspan[^>]* y=/);
  });
  it("prints a fraction part's power as Word superscript", () => {
    expect(runs(typesetText("{x^7/x^4}"), {}, "regular", true).match(/w:vertAlign w:val="superscript"/g)?.length).toBe(2);
  });
});
