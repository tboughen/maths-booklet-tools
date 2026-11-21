import { describe, expect, it } from "vitest";
import { parseRuns, plainWidth, runWidth, SUP_SCALE, textSvg, wrap } from "./text";
import { typesetText } from "./typeset";
import { runs } from "./docx";

const sups = (s: string) => parseRuns(s, "regular", true).filter((r) => r.sup).map((r) => r.text);

describe("raised powers with maths notation", () => {
  it("raises ^5, ^-2, ^n and braced powers, and leaves the text round them", () => {
    expect(sups("x^5 × x^3")).toEqual(["5", "3"]);
    expect(sups("a^-2 and 3^0")).toEqual(["−2", "0"]);
    expect(sups("5^{2n} ÷ 5^n")).toEqual(["2", "n", "n"]);
    expect(parseRuns("5^{2n}", "regular", true).find((r) => r.text === "n")?.style).toBe("italic");
    expect(parseRuns("x^5 more", "regular", true).map((r) => r.text).join("")).toBe("x5 more");
  });
  it("keeps typeset italics and works after typesetting", () => {
    expect(sups(typesetText("x^n and 5^{2n}"))).toEqual(["n", "2", "n"]);
  });
  it("prints the caret as typed without maths notation", () => {
    expect(parseRuns("x^5", "regular", false)).toEqual([{ text: "x^5", style: "regular" }]);
  });
  it("measures a power smaller and draws it raised, then back on the baseline", () => {
    const [r] = parseRuns("x^5", "regular", true).filter((x) => x.sup);
    expect(runWidth(r, 4)).toBeCloseTo(plainWidth("5", 4) * SUP_SCALE);
    const svg = textSvg(wrap("x^5 = y", 4, 100, "regular", true)[0], 0, 5, 4, "#000");
    expect(svg).toMatch(/<tspan font-size="2.8" dy="-1.44">5<\/tspan><tspan dy="1.44">/);
  });
  it("is a Word superscript run", () => {
    expect(runs("x^5", {}, "regular", true)).toContain('<w:vertAlign w:val="superscript"/>');
  });
  it("keeps the bracket after a typed square or cube: (2a^3)^4", () => {
    expect(typesetText("(2a^3)^4")).toBe("(2*a*³)^4");
    expect(typesetText("x^(2)")).toBe("*x*²");
  });
});
