// @vitest-environment node
// The bubble method as an item inside a worksheet question card (A7.08 Q5a, A7.09 Q1 and Q4):
// each line side and bubble is supplied, blank or a hidden answer, in the PDF/SVG pages and in Word.
import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { treeDiagrams } from "./fixtures";
import { writeWorksheetDocx, type DocxOptions } from "./docx";
import { renderResource, validate, type Resource } from "./index";
import { ANSWER_COLOUR } from "../../bubble-method-core/src/index";

/** Solve 2x + 6 = 0: the first bubble and its line are given, the rest blank or hidden answers. */
const spec = {
  start: "0 = 2x + 6",
  steps: [
    { bubble: "−6", line: "−6 = 2x" },
    { bubble: { text: "÷2", hidden: true }, line: { lhs: { text: "−3", hidden: true }, rel: "=", rhs: { text: "x", hidden: true } } },
    { bubble: "", line: "" },
  ],
};

function sheet(asPart: boolean): Resource {
  const r = structuredClone(treeDiagrams) as Resource;
  const diagram = { type: "diagram", diagram: { tool: "bubble-method", spec } };
  r.document.sides[0].columns[0].cards[0].items = asPart
    ? ([{ type: "part", text: "Solve 2x + 6 = 0 with the bubble method.", items: [diagram] }] as never)
    : ([{ type: "text", text: "Solve 2x + 6 = 0 with the bubble method." }, diagram] as never);
  return validate(r);
}
const pictures = async (doc: Resource, view: "pupil" | "answers") => {
  const drawn: string[] = [];
  const options: DocxOptions = {
    view,
    fonts: { regular: new Uint8Array(64), semiBold: new Uint8Array(64), italic: new Uint8Array(64) },
    picture: (svg) => (drawn.push(svg), { svg, png: new Uint8Array([137, 80, 78, 71]) }),
  };
  const { bytes, issues } = await writeWorksheetDocx(doc, options);
  expect(issues.filter((i) => !/too full|needs .* mm/.test(i.message))).toEqual([]);
  expect(strFromU8(unzipSync(bytes)["word/document.xml"])).toContain("diagram");
  return drawn.join("\n");
};
const texts = (svg: string) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

describe("bubble method inside a worksheet question card", () => {
  for (const asPart of [false, true])
    it(`prints given, blank and hidden lines and bubbles${asPart ? " in a question part" : ""}, on the page and in Word`, async () => {
      const doc = sheet(asPart);
      for (const view of ["pupil", "answers"] as const) {
        const page = renderResource(doc, { view });
        expect(page.issues.map((i) => i.message).filter((m) => !/too full|needs .* mm/.test(m))).toEqual([]);
        const word = await pictures(doc, view);
        for (const out of [page.pages[0], word]) {
          const shown = texts(out);
          // Given: the first line and the first step's bubbles and line, on both copies.
          expect(shown).toContain("−6");
          // A blank step prints its dashed handwriting lines and empty bubbles.
          expect(out).toContain("stroke-dasharray");
          // Hidden answers print only on the answers copy, in dark pink.
          expect(shown.includes("÷2"), view).toBe(view === "answers");
          expect(shown.includes("−3"), view).toBe(view === "answers");
          expect(out.includes(ANSWER_COLOUR), view).toBe(view === "answers");
        }
      }
    });
});
