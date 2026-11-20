import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { lessonWords, validateBooklet, type Booklet } from "./booklet";
import { renderBooklet, renderLessonNotes } from "./booklet-render";
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
    expect(lessonWords({})).toEqual({ badge: "Lesson", name: "Lesson", end: "End of lesson" });
    expect(lessonWords({ lessonName: "Mock revision" })).toEqual({ badge: "Revision", name: "Mock revision", end: "End of mock revision" });
    expect(lessonWords({ lessonName: "SATs practice", lessonBadge: "SATs" })).toEqual({ badge: "SATs", name: "SATs practice", end: "End of SATs practice" });
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
