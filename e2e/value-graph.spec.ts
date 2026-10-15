import { test, expect, type Page } from "./release-fixtures";
import { readFile } from "node:fs/promises";
import {
  defaultEnvelope,
  editorLink,
  rangeColumns,
} from "../packages/value-graph-core/src/interchange";
import {
  verifyPrintBytes,
  printRasterSize,
} from "../packages/graph-core/src/png-bytes";
const key = "mathsdock:value-table-graph:v1";

test("direct equation and axis editing retain snapshots and have one control location", async ({
  page,
}) => {
  await open(page);
  const initial = await stored(page);
  await page.getByRole("button", { name: "Curve", exact: true }).click();
  await page.getByRole("button", { name: "Close editor", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit equation", exact: true })
    .click();
  const equation = page.getByRole("textbox", { name: "Equation", exact: true });
  await equation.fill("y = 1/2x² − .25x + 3/2");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  expect((await stored(page)).document.equation).toEqual({
    a: "1/2",
    b: "-1/4",
    c: "3/2",
  });
  expect((await stored(page)).document.columns).toEqual(
    initial.document.columns,
  );
  expect((await stored(page)).document.graph.curves[0].equation).toEqual(
    initial.document.equation,
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await stored(page)).document.equation).toEqual(
    initial.document.equation,
  );
  await expect(
    page.getByRole("complementary", { name: "Table and graph settings" }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("textbox", { name: "Coefficient a", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Add column", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Plot a point", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Edit x axis scale", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "x units per cm", exact: true })
    .fill("1");
  await page
    .getByRole("textbox", { name: "x units per cm", exact: true })
    .press("Enter");
  expect((await stored(page)).document.graph.xUnitsPer10mm).toBe("1");
  const fontPx = await page
    .locator('[data-layer="axis-values"] text')
    .first()
    .evaluate(
      (t) => parseFloat(getComputedStyle(t).fontSize) * t.getScreenCTM()!.a,
    );
  expect(fontPx).toBeCloseTo(16, 2);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await stored(page)).document.graph.xUnitsPer10mm).toBe(
    initial.document.graph.xUnitsPer10mm,
  );
});

test("hidden objects open the same curve and point editors without filling pupil blanks", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Curve", exact: true }).click();
  const drawn = page.getByRole("textbox", {
    name: "Drawn curve equation",
    exact: true,
  });
  await drawn.fill("y = x² + 1");
  await drawn.press("Enter");
  await page.getByRole("button", { name: "Close editor", exact: true }).click();
  await page
    .getByRole("button", { name: "Graph options", exact: true })
    .click();
  await page.getByLabel("Smooth curve", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Close editor", exact: true }).click();
  await expect(page.locator("[data-curve]")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Select object", exact: true })
    .click();
  await page
    .getByLabel("Select an object", { exact: true })
    .selectOption("curve:quadratic");
  await expect(drawn).toHaveValue("y = x² + 1");
  await page
    .getByRole("textbox", { name: "Curve start x", exact: true })
    .fill("-2");
  await page
    .getByRole("textbox", { name: "Curve start x", exact: true })
    .press("Enter");
  expect((await stored(page)).document.graph.curves[0].min).toBe("-2");
  await page
    .getByRole("button", { name: "Use question equation", exact: true })
    .click();
  expect((await stored(page)).document.graph.curves[0].equation).toEqual(
    (await stored(page)).document.equation,
  );
  await page.getByRole("button", { name: "Close editor", exact: true }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page
    .getByRole("textbox", { name: "New point x", exact: true })
    .fill("10");
  await page
    .getByRole("textbox", { name: "New point x", exact: true })
    .press("Enter");
  await page.getByRole("button", { name: "Add point", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Point x", exact: true }),
  ).toHaveValue("10");
  await page.getByRole("button", { name: "Close editor", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Select point (10, 0)", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Select object", exact: true })
    .click();
  const options = page.getByLabel("Select an object", { exact: true });
  await options.selectOption({ label: "Point (10, 0) — Independent points 1" });
  await page.getByRole("button", { name: "Remove point", exact: true }).click();
  expect((await stored(page)).document.graph.series).toHaveLength(0);
  expect(
    (await stored(page)).document.columns.filter(
      (c: { y: { kind: string } }) => c.y.kind === "blank",
    ),
  ).toHaveLength(5);
});

test("local line and layout controls remain reachable on a 320px screen", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await open(page);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page
    .getByRole("textbox", { name: "New horizontal line y", exact: true })
    .fill("2");
  await page
    .getByRole("textbox", { name: "New horizontal line y", exact: true })
    .press("Enter");
  await page
    .getByRole("button", { name: "Add horizontal line", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Horizontal line y", exact: true }),
  ).toHaveValue("2");
  const box = await page.locator(".vg-inspector-editor").boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  await page
    .getByRole("button", { name: "Remove horizontal line", exact: true })
    .click();
  await page.getByRole("button", { name: "Layout", exact: true }).click();
  await page.getByLabel("Equation heading", { exact: true }).uncheck();
  await page
    .getByLabel("Resource layout", { exact: true })
    .selectOption("table");
  await page.getByRole("button", { name: "Close editor", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit equation", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Equation", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("local-equation-320.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});

const stored = (page: Page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key);
async function open(page: Page) {
  await page.goto("/?tool=value-table-graph");
  await expect(
    page.getByRole("heading", {
      name: "Plotting quadratics",
      exact: true,
    }),
  ).toBeVisible();
}
async function fillCell(page: Page, index: number, value: string) {
  await page
    .getByRole("button", { name: `Edit y for column ${index}`, exact: true })
    .click();
  await page
    .getByRole("textbox", { name: `Edit y for column ${index}`, exact: true })
    .fill(value);
  await page
    .getByRole("textbox", { name: `Edit y for column ${index}`, exact: true })
    .press("Enter");
}
test("source grid, exam-size axis values and actual SVG/PNG downloads", async ({
  page,
}, info) => {
  await open(page);
  expect(
    (await stored(page)).document.columns.filter(
      (c: { y: { kind: string } }) => c.y.kind === "blank",
    ),
  ).toHaveLength(5);
  await expect(page.locator("[data-grid-tier]")).toHaveCount(3);
  expect(
    await page
      .locator('[data-layer="axis-values"] text')
      .first()
      .getAttribute("font-size"),
  ).toBe(String((12 * 25.4) / 72));
  await page
    .getByRole("button", { name: "Download options", exact: true })
    .click();
  for (const format of ["SVG", "PNG (600 ppi)"]) {
    const waiting = page.waitForEvent("download");
    await page
      .getByRole("menuitem", { name: `Download ${format}`, exact: true })
      .click();
    const download = await waiting,
      path = info.outputPath(
        format.startsWith("SVG") ? "scaffold.svg" : "scaffold.png",
      );
    await download.saveAs(path);
    const data = await readFile(path);
    if (format === "SVG") {
      expect(data.toString()).toContain('width="141mm"');
      expect(data.toString()).toContain('data-font-points="12"');
      expect(data.toString()).toContain("data:font/otf;base64,");
    } else {
      const size = printRasterSize(14.1, 19.4);
      verifyPrintBytes(new Uint8Array(data), size.width, size.height);
    }
  }
  await page
    .locator(".vg-paper")
    .screenshot({ path: info.outputPath("scaffold-preview.png") });
});
test("zero and answer lines survive direct editing, undo, navigation and reload", async ({
  page,
}) => {
  await open(page);
  await fillCell(page, 2, "0");
  await page.getByRole("button", { name: "Answer line", exact: true }).click();
  expect((await stored(page)).document.columns[1].y.kind).toBe("answer-line");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await stored(page)).document.columns[1].y).toEqual({
    kind: "value",
    value: "0",
  });
  await page
    .getByRole("navigation", { name: "Booklet tools", exact: true })
    .getByRole("link", { name: "Graph tool", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Booklet tools", exact: true })
    .getByRole("link", { name: "Plotting quadratics", exact: true })
    .click();
  expect((await stored(page)).document.columns[1].y.value).toBe("0");
  await page.reload();
  expect((await stored(page)).document.columns[1].y.value).toBe("0");
});
test("invalid input survives navigation, blocks export and cancels without changing the equation", async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole("button", { name: "Edit equation", exact: true })
    .click();
  const field = page.getByRole("textbox", {
    name: "Equation",
    exact: true,
  });
  await field.fill("1/0");
  await field.press("Enter");
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByRole("button", { name: "Copy for Word", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("navigation", { name: "Booklet tools", exact: true })
    .getByRole("link", { name: "Graph tool", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Booklet tools", exact: true })
    .getByRole("link", { name: "Plotting quadratics", exact: true })
    .click();
  await expect(field).toHaveValue("1/0");
  await field.press("Escape");
  await expect(
    page.getByRole("button", { name: "Copy for Word", exact: true }),
  ).toBeEnabled();
  expect((await stored(page)).document.equation.a).toBe("1");
});
test("explicit calculations, true curve and straight-join error remain separate", async ({
  page,
}, info) => {
  await open(page);
  await page
    .getByRole("button", { name: "Table options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Calculate whole row", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await page.getByRole("button", { name: "Close editor", exact: true }).click();
  await page.getByRole("button", { name: "Plot", exact: true }).click();
  await page
    .getByRole("button", { name: "Plot entered table pairs", exact: true })
    .click();
  await page.getByRole("button", { name: "Close editor", exact: true }).click();
  await page.getByRole("button", { name: "Curve", exact: true }).click();
  await expect(page.locator("[data-curve]")).toHaveCount(1);
  await page
    .locator(".vg-paper")
    .screenshot({ path: info.outputPath("worked-preview.png") });
  await page.getByRole("button", { name: "Remove curve", exact: true }).click();
  await page
    .getByRole("button", { name: "Select object", exact: true })
    .click();
  await page
    .getByLabel("Select an object", { exact: true })
    .selectOption("series:points");
  await page
    .getByLabel("Join points", { exact: true })
    .selectOption("straight-joins");
  await expect(page.locator("polyline[data-series]")).toHaveCount(1);
  await expect(page.locator("[data-curve]")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("polyline[data-series]")).toHaveCount(1);
  await page
    .locator(".vg-paper")
    .screenshot({ path: info.outputPath("error-preview.png") });
});
test("point dragging is one reversible edit and does not overwrite the pupil table", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Add point", exact: true }).click();
  await page.getByRole("button", { name: "Close editor", exact: true }).click();
  const before = await stored(page),
    point = page.getByRole("button", {
      name: "Select point (0, 0)",
      exact: true,
    });
  const box = await point.boundingBox();
  await page.mouse.move(box!.x + 12, box!.y + 12);
  await page.mouse.down();
  await page.mouse.move(box!.x + 12 + 16, box!.y + 12 - 16, { steps: 5 });
  await page.mouse.up();
  expect((await stored(page)).document.graph.series[0].points[0].x).not.toBe(
    "0",
  );
  expect((await stored(page)).document.columns).toEqual(
    before.document.columns,
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await stored(page)).document.graph.series[0].points[0]).toEqual(
    before.document.graph.series[0].points[0],
  );
});
test("maximum fractional table and focused input fit narrow screens without page overflow", async ({
  page,
}, info) => {
  const e = defaultEnvelope();
  e.document.columns = rangeColumns("-3", "3", "1/2");
  e.document.print.tableWidthMm = 180;
  for (const width of [375, 320]) {
    await page.goto("about:blank");
    await page.setViewportSize({ width, height: 812 });
    await page.goto(editorLink(e, "http://127.0.0.1:5179/"));
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Edit y for column 1", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Edit y for column 1", exact: true })
      .fill("-1/2");
    await page
      .getByRole("textbox", { name: "Edit y for column 1", exact: true })
      .press("Enter");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: info.outputPath(`narrow-${width}.png`),
      fullPage: true,
    });
  }
});
test("corrupt recovery and newer-tab storage are preserved", async ({
  page,
}) => {
  await page.addInitScript(
    (k) => localStorage.setItem(k, "broken original"),
    key,
  );
  await open(page);
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(
    "broken original",
  );
  await expect(
    page.getByRole("button", { name: "Copy for Word", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", {
      name: "Start afresh after downloading",
      exact: true,
    })
    .click();
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(
    "broken original",
  );
});
test("newer valid draft is not overwritten and worked copies use separate storage", async ({
  page,
  context,
}) => {
  await open(page);
  await page.evaluate(
    (k) => localStorage.setItem(k, "newer external data"),
    key,
  );
  await page
    .getByRole("button", { name: "Edit equation", exact: true })
    .click();
  const a = page.getByRole("textbox", { name: "Equation", exact: true });
  await a.fill("y = 2x² − x − 6");
  await a.press("Enter");
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(
    "newer external data",
  );
  await expect(page.getByRole("status")).toContainText("newer resource");
  const pupil = await context.newPage();
  await open(pupil); // The preserved external draft is intentionally invalid.
  await pupil.close();
});
test("worked copy keeps the pupil's saved blank cells", async ({ page }) => {
  await open(page);
  await page
    .getByRole("button", { name: "Table options", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Create separate worked version",
      exact: true,
    })
    .click();
  const popupPromise = page.waitForEvent("popup");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  await popup
    .getByRole("dialog")
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  expect(
    (await stored(page)).document.columns.filter(
      (c: { y: { kind: string } }) => c.y.kind === "blank",
    ),
  ).toHaveLength(5);
  await expect(popup.locator("[data-curve]")).toHaveCount(1);
  await popup.close();
});
test("paired axis controls extend the grid without enlarging the exam numbers", async ({
  page,
}) => {
  await open(page);
  const before = await stored(page);
  await page
    .getByRole("button", { name: "Extend x left range", exact: true })
    .click();
  const next = await stored(page);
  expect(next.document.graph.bounds.xMin).toBe("-7/2");
  expect(next.document.columns).toEqual(before.document.columns);
  expect(
    await page
      .locator('[data-layer="axis-values"] text')
      .first()
      .getAttribute("font-size"),
  ).toBe(String((12 * 25.4) / 72));
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await stored(page)).document.graph.bounds).toEqual(
    before.document.graph.bounds,
  );
});
