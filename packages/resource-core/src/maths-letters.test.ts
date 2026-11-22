import { describe, expect, it } from "vitest";
import { parseRuns, plainWidth, runWidth, textSvg, titleRuns } from "./text";
import { typesetText } from "./typeset";
import { runs, titleWordRuns } from "./docx";
import { MATHS_SCALE, STIX_ITALIC } from "./metrics";

// Tim, 22 Nov 2026 (option B): every maths letter prints in the exam paper's serif italic (STIX Two
// Text Italic), so x never looks like the multiplication sign.
const typeset = (s: string) => parseRuns(typesetText(s), "regular", true);

describe("maths letters in the exam-style serif italic", () => {
  it("marks typeset letters and letters in a power as maths, and leaves prose and digits alone", () => {
    const r = typeset("Simplify 3x^2 × x^n");
    expect(r.filter((p) => p.style === "maths").map((p) => p.text)).toEqual(["x", "x", "n"]);
    expect(r.find((p) => p.text === "2")?.style).toBe("regular");
    expect(parseRuns("*Note* the answer", "regular", true)[0].style).toBe("italic");
    expect(parseRuns("*x* = 3", "regular", false)[0].style).toBe("italic");
    const emphasis = parseRuns(typesetText("Do *not* use a calculator. Name *one* way, *mx* + *c*."), "regular", true);
    expect(emphasis.find((p) => p.text === "not")?.style).toBe("italic");
    expect(emphasis.find((p) => p.text === "one")?.style).toBe("italic");
    expect(emphasis.find((p) => p.text === "mx")?.style).toBe("maths");
  });
  it("draws a maths letter in STIX Two Text italic, larger, and measures it with STIX widths", () => {
    const line = typeset("2x + 1");
    const svg = textSvg(line, 0, 10, 4, "#000");
    expect(svg).toMatch(/<tspan font-family="'STIX Two Text'" font-style="italic" font-size="4.6">x<\/tspan>/);
    const x = line.find((p) => p.text === "x")!;
    expect(runWidth(x, 4)).toBeCloseTo(STIX_ITALIC.x * MATHS_SCALE * 4, 3);
    expect(plainWidth("× x", 4)).toBeGreaterThan(0);
  });
  it("draws fraction letters in STIX too", () => {
    expect(textSvg(parseRuns("{x/2}", "regular", true), 0, 10, 4, "#000")).toContain(`font-family="'STIX Two Text'" font-style="italic"`);
  });
  it("is a STIX Two Text italic run in Word, at the same larger size", () => {
    const xml = runs(typesetText("2x"), { sizeMm: 4 }, "regular", true);
    expect(xml).toContain('<w:rFonts w:ascii="STIX Two Text" w:hAnsi="STIX Two Text" w:cs="STIX Two Text" w:eastAsia="STIX Two Text"/><w:i/>');
  });
  it("prints a typeset letter in a heading or card title in the serif too, and leaves title words alone", () => {
    const t = titleRuns("Make *x* the subject", true);
    expect(t.map((r) => [r.text, r.style])).toEqual([["Make ", "bold"], ["x", "maths"], [" the subject", "bold"]]);
    expect(titleRuns("Do *not* round", true).find((r) => r.text === "not")?.style).toBe("italic");
    expect(titleRuns("Make *x* the subject", false)[1].style).toBe("italic");
    expect(textSvg(t, 0, 0, 4, "#000")).toContain("font-family=\"'STIX Two Text'\" font-style=\"italic\"");
    expect(titleWordRuns("Make *x* the subject", { bold: true }, true)).toContain('w:ascii="STIX Two Text"');
  });
  it("keeps the words naming an event inside P( ) upright", () => {
    for (const s of ["P(not red) =", "P(red or blue) =", "P(red)=0.2", "P(red) = 0.2. Work out P(not red)."]) expect(typeset(s).some((r) => r.style === "maths")).toBe(false);
    expect(typeset("2ab = 6").find((r) => r.text === "ab")?.style).toBe("maths");
  });
});
