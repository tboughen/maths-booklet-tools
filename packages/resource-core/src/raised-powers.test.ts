import { describe, expect, test } from "vitest";
import { parseRuns, runWidth, textSvg, wrap, SUP_SCALE } from "./text";
import { typesetText } from "./typeset";
import { runs } from "./docx";

// Index laws (Year 8 A4.04 to A4.06) need powers above 3, which Inter has no superscript digits for.
describe("raised powers", () => {
  test("typesetting keeps a bracket's power apart from the power inside it", () => {
    expect(typesetText("(2a^3)^2")).toBe("(2*a*³)²");
    expect(typesetText("x^(2)")).toBe("*x*²");
    expect(typesetText("a^4 × a^3")).toBe("*a*^4 × *a*³");
  });
  test("a caret power becomes a raised, upright, smaller run", () => {
    const r = parseRuns(typesetText("a^4 × a^10"), "regular", true);
    expect(r.filter((x) => x.sup).map((x) => x.text)).toEqual(["4", "10"]);
    expect(r.every((x) => !x.text.includes("^"))).toBe(true);
    const four = r.find((x) => x.sup)!;
    expect(four.style).toBe("regular");
    expect(runWidth(four, 10)).toBeCloseTo(runWidth({ text: "4", style: "regular" }, 10) * SUP_SCALE);
  });
  test("plain text (maths off) keeps its caret", () => {
    expect(parseRuns("a^4", "regular", false)[0].text).toBe("a^4");
  });
  test("wrapping keeps the raised run, and the SVG drops back to the baseline after it", () => {
    const [line] = wrap(typesetText("Simplify a^5 × a"), 4, 200, "regular", true);
    expect(line.some((x) => x.sup && x.text === "5")).toBe(true);
    const svg = textSvg(line, 0, 10, 4, "#000");
    expect(svg).toContain('y="8.56" font-size="2.8">5</tspan>');
    expect(svg).toMatch(/y="10">[^<]*×/);
  });
  test("a power inside a stacked fraction is raised in the SVG and in Word", () => {
    const [line] = wrap(typesetText("{x^7/x^4}"), 4, 200, "regular", true);
    expect(textSvg(line, 0, 10, 4, "#000")).toContain('font-size="2.8">7</tspan>');
    const xml = runs(typesetText("{x^7/x^4}"), {}, "regular", true);
    expect(xml.match(/w:vertAlign w:val="superscript"/g)?.length).toBe(2);
  });
  test("Word prints a raised power as superscript", () => {
    expect(runs(typesetText("a^6"), {}, "regular", true)).toMatch(/<w:vertAlign w:val="superscript"\/><\/w:rPr><w:t xml:space="preserve">6</);
  });
});
