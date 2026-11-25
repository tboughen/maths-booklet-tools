// @vitest-environment node
// The bubble method in a booklet (25 Nov 2026, revision page cards 8 and 9 and A4.08/A4.09): navy house-style
// bubbles under both sides, one line per step, a stacked fraction result, on the PDF pages and in Word.
import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { validateBooklet, type Booklet } from "./booklet";
import { renderBooklet } from "./booklet-render";
import { writeBookletDocx } from "./booklet-docx";
import { ANSWER_COLOUR, HOUSE_NAVY } from "../../bubble-method-core/src/index";

/** Card 9: make x the subject of y = 3x + 5, the first step given, the rest hidden answers. */
const twoSteps = {
  bubbles: "house",
  start: "y = 3x + 5",
  steps: [
    { bubble: "−5", line: "y − 5 = 3x" },
    { bubble: { text: "÷3", hidden: true }, line: { text: "(y − 5)/3 = x", hidden: true } },
  ],
};

function booklet(spec: unknown): Booklet {
  return validateBooklet({
    tool: "resource",
    schemaVersion: 1,
    document: {
      kind: "booklet-a4",
      title: "Algebraic proficiency",
      code: "A4",
      lessons: [
        {
          title: "Change the subject: two steps",
          code: "A4.09",
          keyIdea: "",
          sections: [{ kind: "worked", columns: 2, cards: [{ title: "Change the subject", items: [{ type: "diagram", diagram: { tool: "bubble-method", spec } }] }] }],
        },
      ],
    },
  });
}
const texts = (svg: string) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
const fonts = { regular: new Uint8Array(8), semiBold: new Uint8Array(8), italic: new Uint8Array(8) };

describe("bubble method in a booklet", () => {
  it("draws navy rounded bubbles with navy operations on the page, answers only on the answers copy", () => {
    for (const view of ["pupil", "answers"] as const) {
      const page = renderBooklet(booklet(twoSteps), { view }).pages[1];
      expect(page).toMatch(new RegExp(`<rect[^>]*rx="[\\d.]+"[^>]*stroke="${HOUSE_NAVY}"`));
      expect(page).toMatch(new RegExp(`fill="${HOUSE_NAVY}"[^>]*>−5<`));
      expect(texts(page)).toEqual(expect.arrayContaining(["y", "3", "x", " + 5"]));
      expect(new RegExp(`fill="${ANSWER_COLOUR}"[^>]*>÷3<`).test(page), view).toBe(view === "answers");
    }
  });

  it("keeps plain black ovals unless asked, and the same size either way", async () => {
    const plain = { ...twoSteps, bubbles: undefined };
    const page = renderBooklet(booklet(plain)).pages[1];
    expect(page).not.toContain(`stroke="${HOUSE_NAVY}" stroke-width="0.3"`);
    expect(page).toContain("<ellipse");
    const size = (svg: string) => svg.match(/width="([\d.]+)mm" height="([\d.]+)mm"[^>]*aria-label="Bubble method/)?.slice(1);
    const drawnFor = async (spec: unknown) => {
      const drawn: string[] = [];
      await writeBookletDocx(booklet(spec), { view: "pupil", fonts, picture: (s) => (drawn.push(s), { svg: s, png: new Uint8Array([137, 80, 78, 71]) }) });
      return drawn.find((s) => s.includes("Bubble method"))!;
    };
    const house = await drawnFor(twoSteps),
      black = await drawnFor(plain);
    expect(house).toContain(`stroke="${HOUSE_NAVY}"`);
    expect(black).not.toContain(HOUSE_NAVY);
    expect(size(house)).toBeTruthy();
    expect(size(house)).toEqual(size(black));
  });

  it("puts the house-style working in the Word file on both copies", async () => {
    for (const view of ["pupil", "answers"] as const) {
      const drawn: string[] = [];
      const { bytes } = await writeBookletDocx(booklet(twoSteps), { view, fonts, picture: (s) => (drawn.push(s), { svg: s, png: new Uint8Array([137, 80, 78, 71]) }) });
      expect(strFromU8(unzipSync(bytes)["word/document.xml"])).toContain("<w:drawing>");
      const svg = drawn.find((s) => s.includes("Bubble method"))!;
      expect(svg).toMatch(new RegExp(`fill="${HOUSE_NAVY}"[^>]*>−5<`));
      expect(texts(svg).includes("÷3"), view).toBe(view === "answers");
    }
  });
});
