import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { comparativeBarCharts, treeDiagrams } from "./fixtures";
import { writeWorksheetDocx, type DocxOptions } from "./docx";
import { columnBoxes, STAGE_BAND } from "./render";
import { renderResource, resourceSchema, SIZE, stageLetters, validate, type Resource } from "./index";
import { layoutSample } from "./layout-sample";
import { moveCard } from "../../../src/worksheet/edit";

const options = (view: "pupil" | "answers" = "pupil"): DocxOptions => ({
  view,
  fonts: { regular: new Uint8Array(64), semiBold: new Uint8Array(64), italic: new Uint8Array(64) },
  picture: (svg) => ({ svg, png: new Uint8Array([137, 80, 78, 71]) }),
});
async function word(doc: Resource, view: "pupil" | "answers" = "pupil") {
  const { bytes, issues } = await writeWorksheetDocx(doc, options(view));
  const files = unzipSync(bytes);
  return { issues, document: strFromU8(files["word/document.xml"]), files };
}
const twips = (mm: number) => Math.round((mm * 1440) / 25.4);
const edit = (doc: Resource, change: (d: Resource["document"]) => void) => {
  const next = structuredClone(doc);
  change(next.document);
  return validate(next);
};

describe("worksheet layouts", () => {
  it("keeps saved sheets on three columns with no score box", () => {
    for (const doc of [comparativeBarCharts, treeDiagrams]) {
      for (const side of doc.document.sides) {
        expect(side.layout).toBe("three");
        expect(side.score).toBeNull();
      }
      expect(stageLetters(doc).columns).toEqual([
        ["A", "B", "C"],
        ["D", "E", "F"],
      ]);
    }
  });

  it("places columns in thirds of the page, so three columns are the original grid", () => {
    const content = SIZE.page.width - 2 * SIZE.margin;
    const third = (content - 2 * SIZE.gutter) / 3;
    expect(columnBoxes({ layout: "three" }).map((b) => b.w)).toEqual([third, third, third]);
    expect(columnBoxes({ layout: "three" }).map((b) => b.x)).toEqual([0, 1, 2].map((c) => SIZE.margin + c * (third + SIZE.gutter)));
    for (const layout of ["two", "wide-narrow", "narrow-wide", "one"] as const) {
      const boxes = columnBoxes({ layout });
      const last = boxes[boxes.length - 1];
      expect(last.x + last.w, layout).toBeCloseTo(SIZE.page.width - SIZE.margin, 9);
      boxes.slice(1).forEach((b, i) => expect(b.x - (boxes[i].x + boxes[i].w), layout).toBeCloseTo(SIZE.gutter, 9));
    }
    expect(columnBoxes({ layout: "wide-narrow" }).map((b) => b.w)).toEqual([2 * third + SIZE.gutter, third]);
    expect(columnBoxes({ layout: "two" })[0].w).toBeCloseTo((content - SIZE.gutter) / 2, 9);
  });

  it("refuses a side whose columns do not match its layout", () => {
    const bad = structuredClone(layoutSample) as { document: { sides: { layout: string }[] } };
    bad.document.sides[1].layout = "three";
    const result = resourceSchema.safeParse(bad);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("The three layout has 3 columns; this side has 2.");
  });

  it("letters stage bands in reading order and draws each band in the SVG and in Word", async () => {
    expect(stageLetters(layoutSample)).toEqual({
      columns: [
        ["A", "B", "C"],
        ["D", "F"],
      ],
      cards: [
        [[null, null], [null, null], [null]],
        [[null, "E"], [null, null]],
      ],
    });
    const [, side2] = renderResource(layoutSample).pages;
    expect(side2).toContain(">E</tspan></text>");
    expect(side2).toContain("Use your graph");
    const { document } = await word(layoutSample);
    expect(document).toContain("Use your graph");
    // Side 2's grid: a wide column, the gutter, a narrow column.
    const third = (SIZE.page.width - 2 * SIZE.margin - 2 * SIZE.gutter) / 3;
    expect(document).toContain(`<w:tblGrid><w:gridCol w:w="${twips(2 * third + SIZE.gutter)}"/><w:gridCol w:w="${twips(SIZE.gutter)}"/><w:gridCol w:w="${twips(third)}"/></w:tblGrid>`);
  });

  it("counts a stage band in the column height and reports a stage on a column's first card", () => {
    const full = edit(layoutSample, (d) => void (d.sides[1].columns[0].cards[1].items = [{ type: "space", kind: "working", heightMm: 8 }]));
    expect(renderResource(full).issues).toEqual([]);
    // An overfull column: its band adds exactly one band height to the height it needs.
    const tall = edit(full, (d) => {
      const col = d.sides[1].columns[0];
      col.cards.push({ title: "Extra", stage: "Next stage", items: [{ type: "space", kind: "working", heightMm: 200 }] });
    });
    const plain = edit(tall, (d) => void delete d.sides[1].columns[0].cards[2].stage);
    const need = (doc: Resource) => Number(renderResource(doc).issues.find((i) => i.side === 2)?.message.match(/needs ([\d.]+) mm/)?.[1] ?? 0);
    expect(need(tall) - need(plain)).toBeCloseTo(STAGE_BAND, 1);
    const first = edit(layoutSample, (d) => void (d.sides[0].columns[0].cards[0].stage = "Ignored"));
    expect(renderResource(first).issues.map((i) => i.message)).toContain(
      "The first card in a column sits under the column heading, so its stage is not printed. Put the stage in the column heading.",
    );
  });

  it("prints the score box only on a side that asks for it, in both copies", async () => {
    for (const view of ["pupil", "answers"] as const) {
      const [side1, side2] = renderResource(layoutSample, { view }).pages;
      expect(side1).toContain(">Score</text>");
      expect(side1).toContain(">/ 12</text>");
      expect(side2).not.toContain("Score");
      const { document } = await word(layoutSample, view);
      expect(document.match(/>Score</g)).toHaveLength(1);
      expect(document).toContain(" / 12");
    }
  });

  it("draws grid paper at its printed size, with blank axes and no numbers", async () => {
    const [side1] = renderResource(layoutSample).pages;
    expect(side1).toContain('<rect x="0" y="0" width="100" height="100" fill="none"');
    // Unnumbered axes: the only axis text is x, y and O.
    const paper = side1.slice(side1.indexOf('width="100" height="100"'));
    expect(paper.match(/<text[^>]*>(.*?)<\/text>/g)?.slice(0, 3).map((t) => t.replace(/<[^>]+>/g, ""))).toEqual(["x", "y", "O"]);
    const { document, files } = await word(layoutSample);
    expect(document).toContain('descr="Blank graph paper with blank axes"');
    expect(document).toContain('descr="Blank squared paper with blank axes"');
    expect(document).toContain('descr="Blank dotted paper"');
    expect(Object.keys(files).filter((f) => f.startsWith("word/media/") && f.endsWith(".svg"))).toHaveLength(3);
    const wide = edit(layoutSample, (d) => {
      const it = d.sides[0].columns[2].cards[0].items[1];
      if (it.type === "paper") it.widthMm = 140;
    });
    expect(renderResource(wide).issues.map((i) => i.message)).toContain("The grid paper is 140 mm wide; the card has 125.33 mm. Grids are never shrunk to fit.");
  });

  it("stores hidden working and never prints it, in either copy", async () => {
    const workings = ["2 × 3 + 1 = 7", "3 − (−1) = 4", "Add 2 to each x value", "3x − 2 = 4 so x = 2", "Gradient 2 and y-intercept 1"];
    for (const view of ["pupil", "answers"] as const) {
      const svg = renderResource(layoutSample, { view }).pages.join("");
      const { document } = await word(layoutSample, view);
      for (const w of workings) {
        expect(svg).not.toContain(w);
        expect(document).not.toContain(w);
      }
    }
    expect(JSON.stringify(layoutSample)).toContain("2 × 3 + 1 = 7");
    expect(resourceSchema.safeParse(edit(layoutSample, () => {})).success).toBe(true);
    const markup = structuredClone(layoutSample) as unknown as { document: { sides: { columns: { cards: { working?: string }[] }[] }[] } };
    markup.document.sides[0].columns[0].cards[0].working = "<b>7</b>";
    expect(resourceSchema.safeParse(markup).success).toBe(false);
  });

  it("fits every layout on two sides in the SVG and in Word", async () => {
    for (const layout of ["two", "narrow-wide", "one"] as const) {
      const doc = edit(layoutSample, (d) => {
        const cols = d.sides[1].columns;
        d.sides[1].layout = layout;
        d.sides[1].columns = layout === "one" ? [{ heading: cols[0].heading, cards: cols[0].cards }] : layout === "two" ? cols : [cols[1], cols[0]];
      });
      expect(renderResource(doc).issues, layout).toEqual([]);
      const { issues, document } = await word(doc);
      expect(issues, layout).toEqual([]);
      expect(document.match(/<w:br w:type="page"\/>/g), layout).toHaveLength(1);
    }
  });

  it("moves cards across columns on sides with fewer columns", () => {
    const moved = moveCard(layoutSample, 1, 0, 0, "next");
    expect(moved?.document.sides[1].columns[1].cards[0].title).toBe("Draw y = 3x − 2");
    const back = moveCard(layoutSample, 1, 0, 0, "previous");
    expect(back?.document.sides[0].columns[2].cards.at(-1)?.title).toBe("Draw y = 3x − 2");
    expect(moveCard(layoutSample, 1, 1, 0, "next")).toBeNull();
  });
});
