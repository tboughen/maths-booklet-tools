import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { writeWorksheetDocx } from "./docx";
import { renderResource, validate, type Resource } from "./index";
import { SHORT_ANSWER_LINE } from "./text";

// A lone inline answer line is short and left-aligned (Tim, A7.05 marking; standard 0.3, rule P3).
const sheet = (line: { prefix?: string; suffix?: string; answer?: string; inline: boolean }): Resource =>
  validate({
    tool: "resource",
    schemaVersion: 1,
    document: {
      kind: "worksheet-a3",
      title: "Short lines",
      code: "TEST",
      objective: "Answer lines",
      notation: "maths",
      sides: [
        {
          columns: [
            { heading: "A", cards: [{ title: "One", items: [{ type: "text", text: "Find the gradient." }, { type: "answerLine", ...line }] }] },
            { heading: "B", cards: [] },
            { heading: "C", cards: [] },
          ],
        },
        { columns: [{ heading: "D", cards: [] }, { heading: "E", cards: [] }, { heading: "F", cards: [] }] },
      ],
    },
  } as never);

/** Lengths of the answer lines drawn on side 1 (mm). */
const lineLengths = (doc: Resource, view: "pupil" | "answers" = "pupil") =>
  [...renderResource(doc, { view }).pages[0].matchAll(/<line x1="([\d.]+)" y1="[\d.]+" x2="([\d.]+)" y2="[\d.]+" stroke="#[0-9a-f]+" stroke-width="0.4" stroke-linecap="round" stroke-dasharray="[^"]+"\/>/g)].map((m) => Number(m[2]) - Number(m[1]));

describe("a lone inline answer line is short", () => {
  it("prints a line of about 30 mm after its prefix, not the full width", () => {
    const short = lineLengths(sheet({ prefix: "Gradient =", inline: true })).at(-1)!;
    const full = lineLengths(sheet({ prefix: "Gradient =", inline: false })).at(-1)!;
    expect(short).toBeCloseTo(SHORT_ANSWER_LINE, 0);
    expect(full).toBeGreaterThan(80);
  });
  it("grows to hold a longer saved answer, the same in both copies", () => {
    const answer = "y = 3x + 1 and also y = 3x + 2";
    const pupil = lineLengths(sheet({ prefix: "Answer:", answer, inline: true }));
    const answers = lineLengths(sheet({ prefix: "Answer:", answer, inline: true }), "answers");
    expect(pupil.at(-1)!).toBeGreaterThan(SHORT_ANSWER_LINE + 10);
    expect(answers).toEqual(pupil);
  });
  it("gives Word the same short line", async () => {
    const font = (seed: number) => Uint8Array.from({ length: 64 }, (_, i) => (i * 7 + seed) % 256);
    const { bytes } = await writeWorksheetDocx(sheet({ prefix: "Gradient =", suffix: "cm", inline: true }), {
      view: "pupil",
      fonts: { regular: font(1), semiBold: font(2), italic: font(3) },
      picture: (svg) => ({ svg, png: new Uint8Array([137, 80, 78, 71]) }),
    });
    const xml = strFromU8(unzipSync(bytes)["word/document.xml"]);
    // The underlined cell (the line) is 30 mm: 1701 twentieths of a point.
    expect(xml).toMatch(/<w:tcW w:w="1701" w:type="dxa"\/>[^]*?<w:bottom w:val="dotted"/);
  });
});

describe("inline lines that share a group stay in their slots", () => {
  it("does not shorten an inline line that packing put on a row of its own", () => {
    const long = "a saved answer of thirty-odd letters";
    const doc = sheet({ prefix: "A:", answer: long, inline: true });
    const card = doc.document.sides[0].columns[0].cards[0];
    card.items.push({ type: "answerLine", prefix: "B:", suffix: "", answer: long, inline: true });
    const lengths = lineLengths(doc).slice(-2);
    // Each needs more than half the row, so each gets a row of its own at full width.
    expect(lengths[0]).toBeGreaterThan(100);
    expect(lengths[1]).toBeGreaterThan(100);
  });
});
