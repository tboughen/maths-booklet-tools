import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
  canonical,
  example,
  layout,
  parseFile,
  renderSvg,
  resize,
  setCell,
  setSize,
  textWidth,
} from "./index";
import { renderRatioSvg, ratioMetrics } from "../../ratio-table-core/src/svg";
import { normalizeDocument } from "../../ratio-table-core/src/schema";

it("matches Thick rules to the actual standard ratio-table print width", () => {
  const ratio = normalizeDocument(
    JSON.parse(
      readFileSync("packages/ratio-table-core/fixtures/legacy-v1.json", "utf8"),
    )[0].envelope.document,
  );
  ratio.size = "standard";
  const metrics = ratioMetrics(ratio);
  const rule = Number(
    renderRatioSvg(ratio).match(
      /class="ratio-rules"[^>]*stroke-width="([^"]+)"/,
    )?.[1],
  );
  const mm = (rule * metrics.widthCm * 10) / metrics.width;
  const e = example();
  e.document.gridLineMm = 0.79375;
  expect(e.document.gridLineMm).toBeCloseTo(mm, 12);
  expect(parseFile(canonical(e)).document.gridLineMm).toBe(0.79375);
  expect(renderSvg(e)).toContain(
    'stroke-width="0.79375" stroke-linecap="butt"',
  );
});

for (const size of [12, 15, 18])
  for (const [name, rows, cols] of [
    ["single", 2, 3],
    ["double", 3, 3],
    ["cubic", 3, 4],
  ] as const) {
    it(`compacts filled ${name} headings at ${size} mm without changing product writing cells`, () => {
      const e = setSize(example(name), size),
        g = layout(e);
      expect([g.gridWidth, g.gridHeight]).toEqual([
        (cols - 1) * size + 9,
        (rows - 1) * size + 9,
      ]);
      expect(
        g.cells
          .filter((c) => c.r && c.c)
          .every((c) => c.w === size && c.h === size),
      ).toBe(true);
      expect(g.cells[0]).toMatchObject({ w: 9, h: 9 });
      expect(g.y).toEqual([
        0,
        9,
        ...Array.from({ length: rows - 1 }, (_, i) => 9 + (i + 1) * size),
      ]);
      expect(g.issues).toEqual([]);
      expect(renderSvg(e)).toContain(
        'stroke-width="0.5" stroke-linecap="butt"',
      );
      expect(parseFile(canonical(e))).toEqual(e);
    });
  }
it("keeps factorising scaffold headings large enough to complete in pencil", () => {
  for (const name of ["factor", "negative", "common"]) {
    const e = example(name),
      g = layout(e);
    expect(g.headingHeight).toBe(15);
    expect(g.headingWidth).toBe(15);
    expect(
      g.cells
        .filter((c) => c.cell.value === null)
        .every((c) => c.w >= 15 && c.h >= 15),
    ).toBe(true);
  }
});
it("re-evaluates the top row and left column independently without guessing hidden entries", () => {
  let e = setCell(example(), 0, 2, "+3", true);
  expect(layout(e)).toMatchObject({ gridWidth: 39, gridHeight: 45 });
  expect(layout(e).cells.find((c) => !c.r && c.c === 2)).toMatchObject({
    w: 15,
    h: 15,
  });
  expect(renderSvg(e, true)).toContain('width="39mm" height="45mm"');
  e = setCell(e, 2, 0, null);
  expect(layout(e)).toMatchObject({ gridWidth: 45, gridHeight: 45 });
  e = setCell(setCell(e, 2, 0, "0"), 0, 2, "0");
  expect(layout(e)).toMatchObject({ gridWidth: 39, gridHeight: 39 });
  e = setCell(e, 0, 0, null);
  expect(layout(e)).toMatchObject({ gridWidth: 45, gridHeight: 45 });
});
it("returns full writing space when adding blank heading rows/columns, without changing existing entries", () => {
  const e = example(),
    before = canonical(e),
    row = resize(e, "row", true),
    col = resize(e, "column", true);
  expect(layout(row)).toMatchObject({ gridWidth: 45, gridHeight: 54 });
  expect(layout(col)).toMatchObject({ gridWidth: 54, gridHeight: 45 });
  expect(canonical(e)).toBe(before);
  expect(layout(resize(row, "row", false))).toMatchObject({
    gridWidth: 39,
    gridHeight: 39,
  });
  expect(layout(resize(col, "column", false))).toMatchObject({
    gridWidth: 39,
    gridHeight: 39,
  });
});
it("sizes a filled first column from its actual content and honours explicit widths", () => {
  const e = setCell(example(), 2, 0, "-12x"),
    g = layout(e);
  expect(g.headingWidth).toBeGreaterThanOrEqual(textWidth("-12x") + 2.5);
  expect(g.headingWidth).toBeLessThanOrEqual(15);
  expect(g.issues).toEqual([]);
  e.document.columns[0].widthMm = 25;
  expect(layout(e).headingWidth).toBe(25);
  e.document.columns[0].widthMm = 15;
  e.document.columns[0].fixed = true;
  expect(layout(e).headingWidth).toBe(15);
  expect(layout(setSize(e, 15)).headingWidth).toBeGreaterThanOrEqual(
    textWidth("-12x") + 2.5,
  );
  expect(e.document.columns.slice(1).every((c) => c.widthMm === 15)).toBe(true);
});
it("does not shrink type or writing cells when a heading needs more room", () => {
  const e = setCell(example(), 2, 0, "999999999999x^6");
  expect(layout(e).headingWidth).toBe(15);
  expect(layout(e).issues[0]).toMatch(/column 1.*crowded/);
  e.document.columns[0].widthMm = 45;
  expect(layout(e).issues).toEqual([]);
  expect(
    layout(e)
      .cells.filter((c) => c.r && c.c)
      .every((c) => c.w === 15 && c.h === 15),
  ).toBe(true);
});
it("offers equal headings as a reversible presentation setting, independent of mathematics", () => {
  const e = example(),
    content = JSON.stringify(e.document.rows);
  e.document.compactHeadings = false;
  e.document.gridLineMm = 0.5;
  expect(layout(e)).toMatchObject({ gridWidth: 45, gridHeight: 45 });
  expect(renderSvg(e)).toContain('stroke-width="0.5" stroke-linecap="butt"');
  expect(JSON.stringify(e.document.rows)).toBe(content);
  e.document.compactHeadings = true;
  expect(layout(e)).toMatchObject({ gridWidth: 39, gridHeight: 39 });
});
for (const name of ["double", "factor", "common"])
  it(`reopens first-draft ${name} files with only the multiplication sign enlarged`, () => {
    const base = `packages/algebra-grid-core/fixtures/first-draft-${name}`;
    const e = parseFile(readFileSync(base + ".json", "utf8"));
    expect(e.document.compactHeadings).toBe(false);
    expect(e.document.gridLineMm).toBe(0.2);
    const withoutSign = (svg: string) => {
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      for (const text of doc.querySelectorAll("text"))
        if (text.textContent === "×") text.remove();
      return doc.documentElement.outerHTML;
    };
    expect(withoutSign(renderSvg(e))).toBe(
      withoutSign(readFileSync(base + ".svg", "utf8")),
    );
  });
