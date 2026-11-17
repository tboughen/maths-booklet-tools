import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { lessonLabels, questionLetter, validateBooklet, type Booklet } from "./booklet";
import { renderBooklet } from "./booklet-render";
import { writeBookletDocx } from "./booklet-docx";
import { plainWidth } from "./text";
import { SIZE } from "./style";

const plainLabel = plainWidth("Key idea", SIZE.body, "bold");

// Booklet standard 0.2, section 4b (Tim's marking of the A7.03 pilot, 17 November 2026):
// N1 one label per question, N2 one title line, N3 a two-cell key idea box.

const q = (title: string, ...parts: string[]) => ({
  title,
  items: parts.length ? parts.map((p) => ({ type: "part", text: p, items: [{ type: "answerLine", prefix: "", suffix: "", answer: "4", inline: true }] })) : [{ type: "text", text: "Work it out." }],
});
const section = (kind: string, cards: number, extra: Record<string, unknown> = {}) => ({ kind, columns: 2, cards: Array.from({ length: cards }, (_, i) => q(`Card ${i + 1}`)), ...extra });

function booklet(sections: unknown[], lesson: Record<string, unknown> = {}): Booklet {
  return validateBooklet({
    tool: "resource",
    schemaVersion: 1,
    document: {
      kind: "booklet-a4",
      title: "Straight line graphs",
      code: "A7",
      notation: "maths",
      lessons: [{ title: "Find the gradient of a straight line (positive)", code: "A7.03", objective: "Find the gradient of a straight line (positive)", keyIdea: "", sections, ...lesson }],
    },
  });
}

/** The labels printed in the question cards' navy tiles on every page, in reading order (not the lesson tile). */
const tiles = (pages: string[]) => pages.flatMap((p) => [...p.matchAll(/font-size="3.88" fill="white" text-anchor="middle" xml:space="preserve"><tspan font-weight="600">([^<]+)</g)].map((m) => m[1]));

describe("booklet question labels (N1)", () => {
  // The pilot's shape: check in A-F, From earlier G-H, then one run of numbers through three cycles.
  const pilot = [
    section("check-in", 6, { numbering: "letters" }),
    section("practice", 2, { title: "From earlier", numbering: "letters" }),
    section("worked", 2),
    section("practice", 6, { title: "Your turn" }),
    section("diagnostic", 2),
    section("worked", 2),
    section("practice", 6, { title: "Your turn" }),
    section("diagnostic", 2),
  ];

  it("letters the opening and runs one set of numbers through the cycles, mini whiteboard questions included", () => {
    const b = booklet(pilot);
    expect(lessonLabels(b.document.lessons[0])).toEqual([["A", "B", "C", "D", "E", "F"], ["G", "H"], [null, null], [1, 2, 3, 4, 5, 6], [7, 8], [null, null], [9, 10, 11, 12, 13, 14], [15, 16]]);
    expect(tiles(renderBooklet(b).pages)).toEqual(["A", "B", "C", "D", "E", "F", "G", "H", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16"]);
  });

  it("continues by default, restarts at 1 only when asked, and keeps each lesson's run its own", () => {
    const b = booklet([section("practice", 2), section("worked", 2), section("diagnostic", 2), section("practice", 2, { numbering: "restart" })]);
    expect(lessonLabels(b.document.lessons[0])).toEqual([[1, 2], [null, null], [3, 4], [1, 2]]);
    const two = structuredClone(b);
    two.document.lessons.push(structuredClone(b.document.lessons[0]));
    expect(tiles(renderBooklet(two).pages)).toEqual(["1", "2", "3", "4", "1", "2", "1", "2", "3", "4", "1", "2"]);
  });

  it("letters run past Z as AA, AB", () => {
    expect([0, 25, 26, 27].map(questionLetter)).toEqual(["A", "Z", "AA", "AB"]);
  });

  it("prints parts i), ii) in a lettered question and a), b) in a numbered one, in the PDF and in Word", async () => {
    const b = booklet([
      { kind: "check-in", numbering: "letters", columns: 1, cards: [q("Coordinates", "What is the x value?", "What is the y value?")] },
      { kind: "practice", columns: 1, cards: [q("Gradients", "Find the gradient.", "Find another.")] },
    ]);
    const svg = renderBooklet(b).pages.join("");
    for (const label of ["i)", "ii)", "a)", "b)"]) expect(svg).toContain(`>${label}</text>`);
    const { bytes } = await writeBookletDocx(b, { view: "pupil", fonts: { regular: new Uint8Array(8), semiBold: new Uint8Array(8), italic: new Uint8Array(8) }, picture: (s) => ({ svg: s, png: new Uint8Array([137, 80, 78, 71]) }) });
    const xml = strFromU8(unzipSync(bytes)["word/document.xml"]);
    // In reading order: tile A, its parts i) ii), then tile 1 and its parts a) b).
    let from = 0;
    for (const t of ["A", "i)", "ii)", "1", "a)", "b)"]) {
      const at = xml.indexOf(`>${t}</w:t>`, from);
      expect(at, t).toBeGreaterThan(from);
      from = at;
    }
    expect(xml).not.toContain(">c)</w:t>");
  });

  it("names a lettered question by its letter in an issue", () => {
    const b = booklet([{ kind: "check-in", numbering: "letters", columns: 1, cards: [{ title: "Wide", items: [{ type: "text", text: "A third ⅓" }] }] }]);
    expect(renderBooklet(b).issues.some((i) => i.question === "A" && i.message.startsWith("Lesson 1, Check in, question A uses"))).toBe(true);
  });
});

describe("lesson title and key idea (N2, N3)", () => {
  it("prints the title once: no code and objective line under it", () => {
    const page = renderBooklet(booklet([section("practice", 1)], { objective: "A wholly different objective line" })).pages[1];
    expect(page).toContain(">gradient<");
    expect(page).not.toContain("wholly");
    expect(page).not.toContain("A7.03");
  });

  it("puts Key idea in its own cell and starts each idea on its own line", () => {
    const keyIdea = "The **gradient** tells us how far up a line goes for every 1 unit it goes right.\n**Perfect points** are where the line passes exactly through a grid corner.";
    const page = renderBooklet(booklet([section("practice", 1)], { keyIdea })).pages[1];
    const label = page.match(/<text x="([\d.]+)" y="([\d.]+)"[^>]*><tspan font-weight="600">Key idea<\/tspan>/);
    expect(label).not.toBeNull();
    // Each idea is its own line, drawn at (x, local y) inside a group moved down to that line.
    const ideas = [...page.matchAll(/translate\(0,([\d.]+)\)"><text x="([\d.]+)" y="([\d.]+)"[^>]*>(?:<tspan>)?(The|<tspan font-weight="600">Perfect)/g)];
    expect(ideas.length).toBe(2);
    const [first, second] = ideas.map((m) => ({ top: Number(m[1]), x: Number(m[2]) }));
    // Right of the label with a clear gap, both ideas starting at the same x, the second a line lower.
    expect(first.x).toBeGreaterThan(Number(label![1]) + plainLabel + 5);
    expect(second.x).toBe(first.x);
    expect(second.top).toBeGreaterThan(first.top + 5);
  });

  it("refuses control characters in a key idea other than a line break", () => {
    expect(() => booklet([section("practice", 1)], { keyIdea: "One\ttwo" })).toThrow(/control characters/);
    expect(() => booklet([section("practice", 1)], { keyIdea: "One\ntwo" })).not.toThrow();
  });

  it("holds up to 20 sections in a lesson", () => {
    expect(() => booklet(Array.from({ length: 20 }, () => section("practice", 1)))).not.toThrow();
    expect(() => booklet(Array.from({ length: 21 }, () => section("practice", 1)))).toThrow();
  });
});
