import { describe, expect, it } from "vitest";
import { fracPieces, parseRuns, textSvg, wrap } from "./text";
import { didYouKnowMaths } from "./booklet-render";
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

describe("review fixes", () => {
  it("keeps a typed ² before a letter as the glyph, since ^2y is not a power", () => {
    expect(parseRuns("Simplify x²y", "bold", true).map((r) => r.text).join("")).toBe("Simplify x²y");
    expect(parseRuns("x²", "regular", true).some((r) => r.sup)).toBe(true);
  });
  it("raises powers in fraction parts by the inline rules", () => {
    const sup = (s: string) => fracPieces(s).filter((p) => p.sup).map((p) => p.c).join("");
    expect(sup("x^-2")).toBe("-2");
    expect(sup("x^1000")).toBe("");
    expect(sup("x^ab")).toBe("");
    expect(sup("m^6")).toBe("6");
  });
  it("reads powers in a Did you know only when it holds no fraction", () => {
    expect(didYouKnowMaths("1024 = 2^10", true)).toBe(true);
    expect(didYouKnowMaths("Bees store {1/3} of honey", true)).toBe(false);
    expect(didYouKnowMaths("1024 = 2^10", false)).toBe(false);
  });
});

describe("a number power followed by a letter", () => {
  it("raises the digits in x^6y, inline and in a fraction part", () => {
    const sup = (s: string) => fracPieces(s).filter((p) => p.sup).map((p) => p.c).join("");
    expect(sup("10x^6y^3")).toBe("63");
    expect(parseRuns("x^6y", "regular", true).filter((r) => r.sup).map((r) => r.text).join("")).toBe("6");
    expect(sup("x^ab")).toBe("");
  });
});
