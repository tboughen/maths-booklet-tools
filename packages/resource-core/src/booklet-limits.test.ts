import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { lessonWords, validateBooklet, type Booklet } from "./booklet";
import { BOOKLET_WIDTHS, placeRow, planBooklet, renderBooklet, renderLessonNotes } from "./booklet-render";
import { writeBookletDocx } from "./booklet-docx";
import { styles } from "./style";

// Accidental limits found while making lessons (Tim, 20 November 2026): a booklet names its own
// parts ("Mock revision 1"), the key idea prints stacked fractions, and a worked example can
// write on its own answer line in the pupil copy.

const q = (title: string, items: unknown[] = [{ type: "text", text: "Work it out." }]) => ({ title, items });
function booklet(doc: Record<string, unknown> = {}, lesson: Record<string, unknown> = {}, sections?: unknown[]): Booklet {
  return validateBooklet({
    tool: "resource",
    schemaVersion: 1,
    document: {
      kind: "booklet-a4",
      title: "Percentage change",
      code: "Y11",
      notation: "maths",
      lessons: [
        { title: "Percentage change", keyIdea: "", teacherNotes: "Go through it.", sections: sections ?? [{ kind: "practice", columns: 1, cards: [q("One"), q("Two")] }, { kind: "practice", columns: 1, startBanner: "Stage 2", cards: [q("Three")] }], ...lesson },
      ],
      ...doc,
    },
  });
}
const docxXml = async (b: Booklet, view: "pupil" | "answers" = "pupil") => {
  const { bytes } = await writeBookletDocx(b, { view, fonts: { regular: new Uint8Array(8), semiBold: new Uint8Array(8), italic: new Uint8Array(8) }, picture: (s) => ({ svg: s, png: new Uint8Array([137, 80, 78, 71]) }) });
  const files = unzipSync(bytes);
  return Object.keys(files)
    .filter((k) => k.endsWith(".xml"))
    .map((k) => strFromU8(files[k]))
    .join("\n");
};

describe("the booklet's own name for a lesson", () => {
  it("is Lesson unless the booklet names its parts", () => {
    expect(lessonWords({})).toEqual({ badge: "Lesson", name: "Lesson", end: "End of lesson", numbered: true });
    expect(lessonWords({ lessonName: "Mock revision" })).toEqual({ badge: "Revision", name: "Mock revision", end: "End of mock revision", numbered: true });
    expect(lessonWords({ lessonName: "SATs practice", lessonBadge: "SATs" })).toEqual({ badge: "SATs", name: "SATs practice", end: "End of SATs practice", numbered: true });
  });

  it("prints the name on the start tile, the corner badge, the end band, the contents and the notes, PDF and Word", async () => {
    const b = booklet({ lessonName: "Mock revision" });
    const r = renderBooklet(b);
    const all = r.pages.join("");
    expect(r.issues).toEqual([]);
    expect(all).toContain(">Revision<");
    expect(all).toContain("End of mock revision 1");
    expect(all).toContain("Mock revision 1");
    expect(all).not.toMatch(/>Lesson</);
    expect(all).not.toContain("End of lesson");
    expect(renderLessonNotes(b, 0).pages.join("")).toContain("Teaching notes · Mock revision 1");
    const xml = await docxXml(b);
    expect(xml).toContain(">Revision<");
    expect(xml).toContain("End of mock revision 1");
    expect(xml).not.toContain("End of lesson");
  });

  it("prints a cover lesson with no number anywhere, PDF and Word (Tim, 26 November 2026)", async () => {
    const b = booklet({ lessonName: "Cover lesson", lessonNumbered: false });
    const r = renderBooklet(b);
    const all = r.pages.join("");
    expect(r.issues).toEqual([]);
    expect(all).toContain(">Cover<");
    expect(all).toContain(">lesson<");
    expect(all).toContain("End of cover lesson<");
    expect(all).not.toContain("End of cover lesson 1");
    expect(all).not.toContain("Cover lesson 1");
    expect(all).not.toMatch(/>1<\/text>/);
    const xml = await docxXml(b);
    expect(xml).toContain("End of cover lesson<");
    expect(xml).not.toContain("End of cover lesson 1");
  });

  it("keeps Lesson for a booklet that does not name its parts", () => {
    const all = renderBooklet(booklet()).pages.join("");
    expect(all).toContain(">Lesson<");
    expect(all).toContain("End of lesson 1");
  });

  it("reports a name too long for the end band instead of running into the page number", () => {
    const r = renderBooklet(booklet({ lessonName: "Mock exam revision session" }));
    expect(r.issues.map((i) => i.message).join(" ")).toContain("too long for the end band");
  });

  it("reports a badge word too wide for the tile instead of squeezing it", () => {
    const r = renderBooklet(booklet({ lessonBadge: "Consolidate" }));
    expect(r.issues.map((i) => i.message).join(" ")).toContain('The badge word "Consolidate" is too wide');
  });
});

describe("stacked fractions in the key idea", () => {
  it("prints {3/4} stacked with maths notation, at a fraction line height, in both files", async () => {
    const plain = renderBooklet(booklet({}, { keyIdea: "Multiplier = new ÷ original." })).pages.join("");
    const b = booklet({}, { keyIdea: "Multiplier = new ÷ original.\nA rise of {1/4} is a multiplier of 1.25." });
    const page = renderBooklet(b).pages.join("");
    expect(page).toContain('data-fraction="stacked"');
    expect(page).not.toContain("{1/4}");
    expect(plain).not.toContain('data-fraction="stacked"');
    const xml = await docxXml(b);
    expect(xml).toContain("<m:f>");
  });

  it("prints braces as typed without maths notation", () => {
    const page = renderBooklet(booklet({ notation: "plain" }, { keyIdea: "A rise of {1/4}." })).pages.join("");
    expect(page).not.toContain('data-fraction="stacked"');
  });
});

describe("a worked example writing on its own answer line", () => {
  const worked = (given: boolean) =>
    booklet({}, {}, [
      {
        kind: "worked",
        columns: 1,
        cards: [q("Worked example", [{ type: "text", text: "Increase 40 by 15%." }, { type: "answerLine", prefix: "Answer =", answer: "46", ...(given ? { given: true } : {}) }])],
      },
    ]);
  const ink = styles.mathsdock.ink;
  const pink = styles.mathsdock.answer;

  it("prints a given answer in ink on the pupil copy and the answers copy", async () => {
    for (const view of ["pupil", "answers"] as const) {
      const page = renderBooklet(worked(true), { view }).pages.join("");
      expect(page).toMatch(new RegExp(`fill="${ink}"[^>]*>(<tspan[^>]*>)?46<`));
      expect(page).not.toMatch(new RegExp(`fill="${pink}"[^>]*>(<tspan[^>]*>)?46<`));
    }
    expect(await docxXml(worked(true))).toContain(">46<");
  });

  it("keeps an ordinary saved answer off the pupil copy", async () => {
    expect(renderBooklet(worked(false), { view: "pupil" }).pages.join("")).not.toMatch(/>46</);
    expect(renderBooklet(worked(false), { view: "answers" }).pages.join("")).toMatch(/>46</);
    expect(await docxXml(worked(false))).not.toContain(">46<");
  });
});

describe("model working in a working space", () => {
  const withWorking = (answer: string, heightMm = 30) =>
    booklet({}, {}, [{ kind: "practice", columns: 1, cards: [q("Tree", [{ type: "text", text: "Find the probability." }, { type: "space", kind: "working", heightMm, answer }])] }]);
  const pink = styles.mathsdock.answer;

  it("prints the working on the answers copy only, in the answer colour", async () => {
    const b = withWorking("0.3 × 0.4 = 0.12\n0.12 + 0.42 = 0.54");
    const answers = renderBooklet(b, { view: "answers" });
    expect(answers.issues).toEqual([]);
    expect(answers.pages.join("")).toMatch(new RegExp(`fill="${pink}"[^>]*>(<tspan[^>]*>)?0\\.3`));
    expect(renderBooklet(b, { view: "pupil" }).pages.join("")).not.toContain("0.12");
    expect(await docxXml(b, "answers")).toContain("0.12");
    expect(await docxXml(b, "pupil")).not.toContain("0.12");
  });

  it("keeps the page plan the same in both copies and reports working taller than its space", () => {
    const b = withWorking("0.3 × 0.4 = 0.12");
    expect(renderBooklet(b, { view: "answers" }).lessonPages).toEqual(renderBooklet(b, { view: "pupil" }).lessonPages);
    const long = withWorking(Array.from({ length: 60 }, (_, i) => `L${i + 1}`).join("\n"), 10);
    expect(renderBooklet(long, { view: "answers" }).issues.map((i) => i.message).join(" ")).toContain("model working in a space needs");
  });
});

describe("a maths letter keeps its movement arrow", () => {
  it("never breaks between x and →", async () => {
    const { keepTogether, typesetText } = await import("./typeset");
    expect(keepTogether(typesetText("Read the movements: x → and y ↑."))).toBe("Read the movements: *x* → and *y* ↑.");
  });
});

describe("tall and wide cards", () => {
  const card = (title: string, h = 10, extra: Record<string, unknown> = {}) => ({ title, items: [{ type: "text", text: "Work it out." }, { type: "space", kind: "working", heightMm: h }], ...extra });
  const spanBooklet = (cards: unknown[]) => booklet({}, {}, [{ kind: "practice", columns: 2, cards }]);
  const rows = (b: Booklet) =>
    planBooklet(b).pages.flatMap((p) => p.blocks.filter((x): x is Extract<typeof x, { kind: "row" }> => x.kind === "row"));

  it("groups a tall card with the cards stacked beside it, then pairs again", () => {
    const b = spanBooklet([card("Tall", 80, { tall: 3 }), card("A"), card("B"), card("C"), card("D"), card("E")]);
    expect(renderBooklet(b).issues).toEqual([]);
    const r = rows(b);
    expect(r.map((x) => [x.shape.kind, x.cards.map((c) => c.index)])).toEqual([
      ["tall", [0, 1, 2, 3]],
      ["pair", [4, 5]],
    ]);
    // Placed: the tall card left and the full row high, the stack on the right, top to bottom, filling the row.
    const sec = b.document.lessons[0].sections[0];
    const places = placeRow(sec, r[0], 100, () => 20);
    expect(places[0]).toMatchObject({ x: 0, dy: 0, h: 100 });
    expect(places.slice(1).every((p) => p.x > 0)).toBe(true);
    expect(places[2].dy).toBeGreaterThan(places[1].dy);
    const lastP = places[3];
    expect(lastP.dy + lastP.h).toBeCloseTo(100, 5);
  });

  it("puts a tall card on the right when asked", () => {
    const b = spanBooklet([card("Tall", 80, { tall: 2, tallSide: "right" }), card("A"), card("B")]);
    const r = rows(b)[0];
    const places = placeRow(b.document.lessons[0].sections[0], r, 60, () => 20);
    expect(places[0].x).toBeGreaterThan(places[1].x);
  });

  it("runs a wide card across both columns in a row of its own", () => {
    const b = spanBooklet([card("A"), card("Wide", 10, { wide: true }), card("B"), card("C")]);
    const r = rows(b);
    expect(r.map((x) => [x.shape.kind, x.cards.map((c) => c.index)])).toEqual([
      ["pair", [0]],
      ["wide", [1]],
      ["pair", [2, 3]],
    ]);
    expect(placeRow(b.document.lessons[0].sections[0], r[1], 30, () => 20)[0]).toMatchObject({ x: 0, w: BOOKLET_WIDTHS.full });
  });

  it("reports a tall card with too few cards after it", () => {
    const r = renderBooklet(spanBooklet([card("Tall", 40, { tall: 3 }), card("A")]));
    expect(r.issues.map((i) => i.message).join(" ")).toContain("stands beside 3 cards, but only 1 follows it");
  });

  it("writes a tall card in Word as one cell merged down the stacked rows", async () => {
    const xml = await docxXml(spanBooklet([card("Tall", 80, { tall: 3 }), card("A"), card("B"), card("C")]));
    expect(xml).toContain('<w:vMerge w:val="restart"/>');
    expect((xml.match(/<w:vMerge\/>/g) ?? []).length).toBe(4);
    expect(xml).toContain("<w:pPr><w:keepNext/>");
  });

  it("prints a tall card with only one card after it as an ordinary pair", () => {
    const b = spanBooklet([card("Tall", 40, { tall: 2 }), card("A")]);
    expect(rows(b).map((x) => x.shape.kind)).toEqual(["pair"]);
  });
});
