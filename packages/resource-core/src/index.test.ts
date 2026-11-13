import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { comparativeBarCharts, treeDiagrams } from "./fixtures";
import { fileName, renderResource, styles, validate, type Resource, type StyleId } from "./index";
import { inlineFraction, wrap } from "./text";
import { planColumn, SPARSE_COLUMN } from "./render";

const fixtures: [string, Resource][] = [
  ["comparative bar charts", comparativeBarCharts],
  ["tree diagrams", treeDiagrams],
];
const ids = Object.keys(styles) as StyleId[];

describe("resource worksheet renderer", () => {
  for (const [name, doc] of fixtures) {
    it(`lays out ${name} on exactly two A3 landscape sides with no issues`, () => {
      for (const style of ids)
        for (const view of ["pupil", "answers"] as const) {
          const r = renderResource(doc, { style, view });
          expect(r.issues).toEqual([]);
          expect(r.pages).toHaveLength(2);
          for (const p of r.pages) expect(p).toMatch(/^<svg [^>]*width="420mm" height="297mm" viewBox="0 0 420 297"/);
        }
    });

    it(`keeps saved answers out of the pupil view of ${name}`, () => {
      const pupil = renderResource(doc).pages.join("");
      const answers = renderResource(doc, { view: "answers" }).pages.join("");
      expect(pupil).not.toContain(styles.mathsdock.answer);
      expect(answers).toContain(styles.mathsdock.answer);
    });

    it(`places ${name} identically in the pupil and answers views`, () => {
      // Card frames carry the layout: the same rectangles must appear in both views.
      const frames = (svg: string) => svg.match(/<rect x="0.15" y="0.15" width="[\d.]+" height="[\d.]+"/g);
      const a = renderResource(doc).pages.map(frames);
      const b = renderResource(doc, { view: "answers" }).pages.map(frames);
      expect(b).toEqual(a);
    });

    it(`round-trips ${name} through JSON`, () => {
      expect(validate(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
    });
  }

  it("numbers questions across both sides", () => {
    const svg = renderResource(comparativeBarCharts).pages[1];
    expect(svg).toContain(">7</tspan>");
    expect(svg).toContain(">12</tspan>");
  });

  it("reports overflow instead of shrinking text", () => {
    const doc = structuredClone(treeDiagrams);
    doc.document.sides[0].columns[0].cards[0].items.push({ type: "space", kind: "working", heightMm: 200 });
    const r = renderResource(doc);
    expect(r.issues.some((i) => i.side === 1 && i.column === 1 && /needs [\d.]+ mm more height/.test(i.message))).toBe(true);
    expect(r.pages[0]).toContain('font-size="3.88"');
  });

  it("refuses markup and unknown blocks", () => {
    const doc = structuredClone(treeDiagrams) as unknown as { document: { title: string } };
    doc.document.title = "<b>x</b>";
    expect(() => validate(doc)).toThrow(/ordinary text/);
    expect(() => validate({ ...treeDiagrams, document: { ...treeDiagrams.document, kind: "booklet" } })).toThrow();
  });

  it("wraps text by measured width and keeps bold and italic runs", () => {
    const lines = wrap("Write *first toss* and **second toss** above the branches.", 3.18, 40);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.flat().some((r) => r.style === "italic" && r.text === "first")).toBe(true);
    expect(lines.flat().some((r) => r.style === "bold" && r.text === "second")).toBe(true);
  });

  it("names files by the guide's convention", () => {
    expect(fileName(treeDiagrams)).toBe("SP7.01_List outcomes of combined events using a tree diagram_A3.pdf");
    expect(fileName(comparativeBarCharts, "answers")).toBe("SP2_Construct and interpret comparative bar charts_Answers_A3.pdf");
  });
});

describe("saved worksheets from before the diagram registry", () => {
  // SHA-256 prefixes of each printed page as rendered on main before wave 4 (commit 2fc5ff7).
  const before: Record<string, [string, string]> = {
    "comparativeBarCharts:pupil": ["73e47ecb06f61fd1", "aac8bb59a69b3fc5"],
    "comparativeBarCharts:answers": ["1ad2aee26c9010ad", "dcef0db837c0796d"],
    "treeDiagrams:pupil": ["982c991b21c41848", "2bb88445db745629"],
    "treeDiagrams:answers": ["73475fba4301c843", "0a271aeb8671efd9"],
  };
  it.each(Object.keys(before))("%s still opens and prints byte-identically", (key) => {
    const [name, view] = key.split(":") as ["comparativeBarCharts" | "treeDiagrams", "pupil" | "answers"];
    const saved = JSON.parse(JSON.stringify({ comparativeBarCharts, treeDiagrams }[name]));
    if (name === "treeDiagrams") {
      // The fixture's question 12 b) later gained a second answer line (its eight outcomes did not
      // fit one short line); the saved file from before had one line.
      const part = saved.document.sides[1].columns[2].cards[1].items[2];
      part.items = [{ type: "answerLine", prefix: "", suffix: "", answer: "HHH, HHT, HTH, HTT, THH, THT, TTH, TTT", inline: false }];
    }
    const pages = renderResource(validate(saved), { view }).pages.map((p) => createHash("sha256").update(p).digest("hex").slice(0, 16));
    expect(pages).toEqual(before[key]);
  });
});

describe("spare column height", () => {
  const ctx = { st: styles.mathsdock, view: "pupil" as const, diagrams: 0, issues: [], where: { side: 1, column: 1, question: 0 } };
  const cards: Resource["document"]["sides"][number]["columns"][number]["cards"] = [
    { title: "One", items: [{ type: "text", text: "Explain what fair means." }] },
    { title: "Two", items: [{ type: "text", text: "Explain what biased means." }] },
    { title: "Three", items: [{ type: "text", text: "Explain what random means." }] },
  ];
  it("shares spare height between all cards for share, and gives it to the last card otherwise", () => {
    const share = planColumn(cards, [1, 2, 3], 131.3, 250, ctx, true);
    const last = planColumn(cards, [1, 2, 3], 131.3, 250, ctx, false);
    expect(share.spare).toBeGreaterThan(100);
    expect([0, 1, 2].map(share.stretch)).toEqual([share.spare / 3, share.spare / 3, share.spare / 3]);
    expect([0, 1, 2].map(last.stretch)).toEqual([0, 0, last.spare]);
  });
  it("gives working spaces the spare height first, whatever the setting", () => {
    const withSpace = [...cards, { title: "Four", items: [{ type: "space" as const, kind: "working" as const, heightMm: 20 }] }];
    const r = planColumn(withSpace, [1, 2, 3, 4], 131.3, 250, ctx, true);
    expect(r.extra).toBeGreaterThan(0);
    expect([0, 1, 2, 3].map(r.stretch)).toEqual([0, 0, 0, 0]);
  });
  it("notes a column more than a third blank without making the sheet unready", () => {
    const sparse = structuredClone(treeDiagrams);
    sparse.document.spareSpace = "share";
    sparse.document.sides[1].columns[2].cards.splice(1);
    const r = renderResource(validate(sparse));
    expect(r.issues).toEqual([]);
    expect(r.notes.find((n) => n.side === 2 && n.column === 3)?.message).toMatch(/% blank/);
    expect(SPARSE_COLUMN).toBeCloseTo(1 / 3);
  });
});

describe("stacked fraction notes", () => {
  it("finds fractions that will not print stacked", () => {
    expect(inlineFraction("Find 3/4 of 20.", true)).toBe("3/4");
    expect(inlineFraction("Find ¾ of 20.", true)).toBe("¾");
    expect(inlineFraction("Find {3/4} of 20.", true)).toBeNull();
    expect(inlineFraction("Find {3/4} of 20.", false)).toBe("{3/4}");
    expect(inlineFraction("Speed in m/s and km/h, 0.5 kg, date 2/3/24", true)).toBeNull();
  });
  it("notes each question with an inline fraction and keeps the sheet print-ready", () => {
    const doc = structuredClone(treeDiagrams);
    const first = doc.document.sides[0].columns[0].cards[0];
    first.items.unshift({ type: "text", text: "P(red) = 1/2 and P(blue) = 1/4." });
    const plain = renderResource(validate(doc));
    expect(plain.issues).toEqual([]);
    const notes = plain.notes.filter((n) => n.question !== undefined);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ side: 1, column: 1, question: 1 });
    expect(notes[0].message).toContain("{1/2}");
    expect(notes[0].message).toContain('notation to "maths"');
    first.items[0] = { type: "text", text: "P(red) = {1/2} and P(blue) = {1/4}." };
    doc.document.notation = "maths";
    expect(renderResource(validate(doc)).notes.filter((n) => n.question !== undefined)).toEqual([]);
  });
});
