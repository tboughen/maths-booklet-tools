import { describe, expect, it } from "vitest";
import { year8Run, year9Run } from "./starter-fixtures";
import { defaultSlots, renderStarterRun, starterFileName, validateStarterRun, YEAR_7_8_SLOTS, STARTER, type StarterRun } from "./index";

const clone = (r: StarterRun) => structuredClone(r);
const count = (svg: string, needle: string) => svg.split(needle).length - 1;
// A tiny valid PNG (1 × 1 pixel).
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("starter run file", () => {
  it("accepts Tim's Year 9 and Year 8 runs", () => {
    expect(validateStarterRun(clone(year9Run)).document.starters).toHaveLength(6);
    expect(validateStarterRun(clone(year8Run)).document.template).toBe("four");
  });

  it("needs one slot per question in the template and one question per slot in every starter", () => {
    const fewer = clone(year9Run);
    fewer.document.slots.pop();
    expect(() => validateStarterRun(fewer)).toThrow(/core-extension template has 6 slots, not 5/);
    const short = clone(year9Run);
    short.document.starters[2].cards.pop();
    expect(() => validateStarterRun(short)).toThrow(/Starter 3 has 5 questions/);
  });

  it("holds at most six starters", () => {
    const seven = clone(year9Run);
    seven.document.starters.push(structuredClone(seven.document.starters[0]));
    expect(() => validateStarterRun(seven)).toThrow(/starters/);
  });

  it("takes only a PNG or JPEG logo, kept in the file", () => {
    const run = clone(year8Run);
    run.document.logo = PNG;
    expect(validateStarterRun(run).document.logo).toBe(PNG);
    run.document.logo = "data:image/svg+xml;base64,PHN2Zy8+";
    expect(() => validateStarterRun(run)).toThrow(/PNG or JPEG/);
  });

  it("starts Year 7 and 8 runs with the four icons and type names left for Tim", () => {
    expect(defaultSlots("four").map((s) => s.icon)).toEqual(["pencil", "talk", "book", "puzzle"]);
    expect(YEAR_7_8_SLOTS.every((s) => s.name === "")).toBe(true);
    expect(defaultSlots("six")).toHaveLength(6);
  });
});

describe("silent starter layout", () => {
  it("draws one A5 card and one A4 sheet of two per starter, with no problems", () => {
    const r = renderStarterRun(validateStarterRun(clone(year9Run)));
    expect(r.issues).toEqual([]);
    expect(r.cards).toHaveLength(6);
    expect(r.sheets).toHaveLength(6);
    expect(r.cards[0]).toContain('width="210mm" height="148mm" viewBox="0 0 210 148"');
    expect(r.sheets[0]).toContain('width="210mm" height="297mm" viewBox="0 0 210 297"');
    expect(count(r.cards[0], ">Silent starter<")).toBe(1);
    expect(count(r.sheets[0], ">Silent starter<")).toBe(2);
    expect(r.sheets[0]).toContain('stroke-dasharray="2 1.5"');
    expect(renderStarterRun(validateStarterRun(clone(year8Run))).issues).toEqual([]);
  });

  it("boxes today's number in the run tracker", () => {
    const r = renderStarterRun(validateStarterRun(clone(year9Run)));
    r.cards.forEach((svg, i) => {
      expect(count(svg, 'stroke="#000" stroke-width="0.5"/>')).toBe(1);
      expect(svg).toMatch(new RegExp(`fill="#000" text-anchor="middle" xml:space="preserve"><tspan font-weight="600">${i + 1}</tspan>`));
    });
  });

  it("marks the extension column with a thick bar, a label band and a grey tint (option C)", () => {
    const ext = renderStarterRun(validateStarterRun(clone(year9Run))).cards[0];
    expect(ext).toContain(">EXTENSION</text>");
    expect(ext).toContain(`stroke-width="${STARTER.extensionRule}"`);
    expect(ext).toContain(`fill="${STARTER.colours.tint}"`);
    const plain = clone(year9Run);
    plain.document.template = "six";
    const six = renderStarterRun(validateStarterRun(plain)).cards[0];
    expect(six).not.toContain("EXTENSION");
    expect(six).not.toContain(`fill="${STARTER.colours.tint}"`);
  });

  it("prints each slot's icon in its corner, and none where the slot has none", () => {
    const four = renderStarterRun(validateStarterRun(clone(year8Run))).cards[0];
    for (const icon of ["pencil", "talk", "book", "puzzle"]) expect(count(four, `data-icon="${icon}"`)).toBe(1);
    const nine = renderStarterRun(validateStarterRun(clone(year9Run))).cards[0];
    expect(count(nine, "data-icon=")).toBe(0);
  });

  it("puts the logo in the header when the run has one", () => {
    const run = clone(year8Run);
    run.document.logo = PNG;
    const svg = renderStarterRun(validateStarterRun(run)).cards[0];
    expect(svg).toContain(`href="${PNG}"`);
    expect(renderStarterRun(validateStarterRun(clone(year8Run))).cards[0]).not.toContain("<image");
  });

  it("reports a question too tall for its slot instead of shrinking it", () => {
    const run = clone(year9Run);
    run.document.starters[1].cards[2].items.push({ type: "space", kind: "working", heightMm: 60 });
    const r = renderStarterRun(validateStarterRun(run));
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0]).toMatchObject({ starter: 2, question: 3 });
    expect(r.issues[0].message).toMatch(/^Starter 2, question 3 needs [\d.]+ mm more height\. .*text is never shrunk\.$/);
  });

  it("names the slot when a diagram is wider than it, with advice that fits a starter", () => {
    const run = clone(year9Run);
    const diagram = run.document.starters[0].cards[4].items[0];
    if (diagram.type !== "diagram" || !diagram.diagram.envelope) throw Error("fixture changed");
    const env = diagram.diagram.envelope as { document: { shape: { corners: { x: number; y: number }[] } } };
    env.document.shape.corners = env.document.shape.corners.map((c) => ({ x: c.x * 3, y: c.y }));
    const r = renderStarterRun(validateStarterRun(run));
    const wide = r.issues.find((i) => /wide/.test(i.message));
    expect(wide?.message).toMatch(/^Starter 1, question 5: the area and perimeter diagram is [\d.]+ mm wide and the slot has [\d.]+ mm\. Draw it smaller in its tool/);
    expect(wide?.message).not.toMatch(/column layout/);
  });

  it("flags a question with an instruction wider than its slot", () => {
    const run = clone(year9Run);
    run.document.starters[0].cards[0].title = "Multiply these two fractions together:";
    expect(renderStarterRun(validateStarterRun(run)).issues[0].message).toMatch(/instruction is wider than its slot/);
  });

  it("prints saved answers only in the answers copy", () => {
    const run = clone(year8Run);
    const choice = run.document.starters[0].cards[0].items[1];
    if (choice.type !== "choice") throw Error("fixture changed");
    choice.answer = 3;
    const answer = "#b0125b";
    expect(renderStarterRun(validateStarterRun(run)).cards[0]).not.toContain(answer);
    expect(renderStarterRun(validateStarterRun(run), { view: "answers" }).cards[0]).toContain(answer);
  });

  it("names its files from the run's title", () => {
    const run = validateStarterRun(clone(year9Run));
    expect(starterFileName(run)).toBe("Year-9-fractions-perimeter-and-expanding_Silent-starters.pdf");
    expect(starterFileName(run, "answers", 3, "docx")).toBe("Year-9-fractions-perimeter-and-expanding_Silent-starters_3_Answers.docx");
  });

});
