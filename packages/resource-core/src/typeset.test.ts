import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { typesetForPrint, typesetText } from "./typeset";
import { comparativeBarCharts } from "./fixtures";
import { a7Booklet } from "./booklet-fixtures";
import { renderBooklet, renderResource, validate, validateBooklet, type Resource } from "./index";
import { writeWorksheetDocx } from "./docx";

describe("typesetting typed maths", () => {
  const cases: [string, string][] = [
    ["Solve 3x + 2 = 11.", "Solve 3*x* + 2 = 11."],
    ["Find the value of x.", "Find the value of *x*."],
    ["Work out -3 - 5", "Work out −3 − 5"],
    ["x^2 - 4x + 3 = 0", "*x*² − 4*x* + 3 = 0"],
    ["y = 2x-1", "*y* = 2*x*−1"],
    ["x >= -2 and y != 0", "*x* ≥ −2 and *y* ≠ 0"],
    ["sqrt 16 and sqrt(x)", "√16 and √(*x*)"],
    ["Area = pi r^2", "Area = π *r*²"],
    ["f(x) = x^3", "*f*(*x*) = *x*³"],
    ["A 2 x 3 grid", "A 2 × 3 grid"],
    ["a = 3 and b = -2", "*a* = 3 and *b* = −2"],
    ["Simplify 5m + 2m", "Simplify 5*m* + 2*m*"],
    ["Point A(2, -1) on the x-axis", "Point A(2, −1) on the *x*-axis"],
    ["Find a number n such that n <= 7", "Find a number *n* such that *n* ≤ 7"],
    ["the form y = mx ± c", "the form *y* = *mx* ± *c*"],
    ["x = 3 or y = 4", "*x* = 3 or *y* = 4"],
  ];
  it.each(cases)("%s", (typed, printed) => expect(typesetText(typed)).toBe(printed));

  it("leaves prose, labels, units, ordinals, ranges and other powers as typed", () => {
    for (const s of ["A length of 5 m and 3 cm", "Questions 3-5 are well-known", "(a) Write 3D shapes", "the 2nd term", "Use sin 30", "Total for Question 3 is 4 marks", "e-mail", "Q3a"]) {
      expect(typesetText(s)).toBe(s);
    }
    expect(typesetText("x^4")).toBe("*x*^4");
  });

  it("keeps bold, italic and fractions whole, and gives them symbols only", () => {
    expect(typesetText("**Bold x + 1** and {-3/4} of *y*")).toBe("**Bold x + 1** and {−3/4} of *y*");
    expect(typesetText("x <= 2", false)).toBe("x ≤ 2");
    // Typesetting printed text again changes nothing.
    const once = typesetText("Solve x^2 - 3x = -2");
    expect(typesetText(once)).toBe(once);
  });
});

const sheet = (notation: "plain" | "maths"): Resource => {
  const r = structuredClone(comparativeBarCharts);
  r.document.notation = notation;
  r.document.sides[0].columns[0].cards[0].items.unshift({ type: "text", text: "Solve 3x - 2 <= x^2." });
  return validate(r);
};

describe("maths notation typesets printed text", () => {
  it("prints a plain sheet exactly as typed", () => {
    const r = sheet("plain");
    expect(typesetForPrint(r)).toBe(r);
    expect(renderResource(r).pages.join("")).toContain("Solve 3x - 2 &lt;= x^2.");
  });

  it("prints true minus, ≤, x² and italic letters, and leaves the saved file alone", () => {
    const r = sheet("maths");
    const before = JSON.stringify(r);
    const svg = renderResource(r).pages.join("");
    expect(svg).toContain('Solve 3<tspan font-style="italic">x</tspan> − 2 ≤ <tspan font-style="italic">x</tspan>².');
    expect(JSON.stringify(r)).toBe(before);
    // A printed copy is never typeset a second time.
    const printed = typesetForPrint(r);
    expect(typesetForPrint(printed)).toBe(printed);
  });

  it("prints the same typesetting in Word", async () => {
    const font = (seed: number) => Uint8Array.from({ length: 64 }, (_, i) => (i * 7 + seed) % 256);
    const { bytes } = await writeWorksheetDocx(sheet("maths"), {
      view: "pupil",
      fonts: { regular: font(1), semiBold: font(2), italic: font(3) },
      picture: (svg) => ({ svg, png: new Uint8Array([137, 80, 78, 71]) }),
    });
    const xml = strFromU8(unzipSync(bytes)["word/document.xml"]);
    expect(xml).toContain("− 2 ≤ ");
    expect(xml).toMatch(/<w:i\/>[^]*?<w:t xml:space="preserve">x<\/w:t>/);
    expect(xml).not.toContain("&lt;=");
  });

  it("typesets booklets too, and only their printed text", () => {
    const b = structuredClone(a7Booklet);
    b.document.notation = "maths";
    b.document.lessons[0].keyIdea = "The gradient of y = 2x - 1 is 2.";
    b.document.lessons[0].teacherNotes = "x^2 stays as typed in notes";
    const booklet = validateBooklet(b);
    const printed = typesetForPrint(booklet);
    expect(printed.document.lessons[0].keyIdea).toBe("The gradient of *y* = 2*x* − 1 is 2.");
    expect(printed.document.lessons[0].teacherNotes).toBe("x^2 stays as typed in notes");
    expect(renderBooklet(booklet).pages.join("")).toContain("2<tspan font-style=\"italic\">x</tspan> − 1");
  });
});
