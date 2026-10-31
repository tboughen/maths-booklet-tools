import { showExamples, galleryCard, chooseExample } from "./example-gallery";
import { test, expect } from "./release-fixtures";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  example,
  create,
  setCell,
  setSize,
  canonical,
  layout,
} from "../packages/algebra-grid-core/src";
import {
  printRasterSize,
  verifyPrintBytes,
} from "../packages/graph-core/src/png-bytes";
import { editorLink } from "../src/algebra-grid/links";
import { clickResourceAction } from "./resource-actions";

const KEY = "maths-booklet-tools:algebra-grid:v1";
const resource = (page: Page) =>
  page.locator(".site-page:not([hidden]) .ag-resource");
const cell = (page: Page, r: number, c: number) =>
  page.locator(`.site-page:not([hidden]) [data-ag-cell="${r}-${c}"]`);
async function edit(
  page: Page,
  r: number,
  c: number,
  text: string,
  hidden = false,
) {
  await cell(page, r, c).click();
  await page
    .getByRole("textbox", { name: "Cell entry", exact: true })
    .fill(text);
  if (hidden)
    await page
      .getByRole("checkbox", { name: "Hide saved answer from pupils" })
      .check();
  await page.getByRole("button", { name: "Apply cell", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Edit grid cell" }),
  ).toHaveCount(0);
}
async function saved(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) || "null"),
    KEY,
  );
}
async function load(page: Page, value = example()) {
  await page.addInitScript(
    ({ key, text }) => {
      localStorage.setItem(key, text);
    },
    { key: KEY, text: canonical(value) },
  );
  await page.goto("/tools/expanding-factorising");
  await expect(resource(page)).toBeVisible();
}
async function download(page: Page, name: string, destination: string) {
  const promise = page.waitForEvent("download");
  await clickResourceAction(
    page,
    name === "Save editable file" ? /^Save editable file/ : name,
  );
  const result = await promise;
  await result.saveAs(destination);
  return readFile(destination);
}
test("multiplication sign is larger than x in compact cells and in real SVG exports", async ({
  page,
}, info) => {
  await load(page, setSize(example(), 12));
  const sign = resource(page).locator("svg text").filter({ hasText: /^×$/ });
  const x = resource(page)
    .locator("svg text")
    .filter({ hasText: /^x$/ })
    .first();
  const signSize = Number(await sign.getAttribute("font-size"));
  const xSize = Number(await x.getAttribute("font-size"));
  expect(signSize / xSize).toBeCloseTo(1.5, 8);
  await expect(sign.locator("tspan")).toHaveAttribute("font-style", "normal");
  await expect(x.locator("tspan")).toHaveAttribute("font-style", "italic");
  const bounds = await sign.boundingBox(),
    corner = await cell(page, 0, 0).boundingBox();
  expect(bounds!.x).toBeGreaterThan(corner!.x);
  expect(bounds!.x + bounds!.width).toBeLessThan(corner!.x + corner!.width);
  const svg = (
    await download(page, "Download SVG", info.outputPath("larger-multiply.svg"))
  ).toString("utf8");
  expect(svg).toContain(`font-size="${signSize}"`);
  expect((await saved(page)).document.rows[0].cells[0].value).toBe("×");
  await page.screenshot({
    path: info.outputPath("larger-multiply.png"),
    fullPage: true,
  });
});

test("question and answer placement buttons surround artwork and preserve pupil blanks", async ({
  page,
}, info) => {
  const original = example();
  await load(page, original);
  const above = page.getByRole("group", {
    name: "Question placement",
    exact: true,
  });
  const below = page.getByRole("group", {
    name: "Answer placement",
    exact: true,
  });
  const art = await resource(page).boundingBox();
  const top = await above.boundingBox(),
    bottom = await below.boundingBox();
  expect(top!.y + top!.height).toBeLessThanOrEqual(art!.y);
  expect(bottom!.y).toBeGreaterThanOrEqual(art!.y + art!.height);
  for (const control of [above, below]) {
    const button = await control.getByRole("button").boundingBox();
    expect(
      Math.abs(button!.x + button!.width / 2 - art!.x - art!.width / 2),
    ).toBeLessThan(1);
  }
  await above.getByRole("button").click();
  await expect(
    page.getByLabel("Include question", { exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("button", { name: "Edit printed question", exact: true }),
  ).toBeVisible();
  await below.getByRole("button").click();
  await expect(
    page.getByLabel("Show saved final answer", { exact: true }),
  ).toBeChecked();
  await expect
    .poll(async () => (await saved(page)).document.answer)
    .toBe("x^2+5x+6");
  expect((await saved(page)).document.rows).toEqual(original.document.rows);
  const withAnswer = await resource(page).boundingBox();
  for (const control of [above, below]) {
    const button = await control.getByRole("button").boundingBox();
    expect(
      Math.abs(
        button!.x + button!.width / 2 - withAnswer!.x - withAnswer!.width / 2,
      ),
    ).toBeLessThan(1);
  }
  const svg = (
    await download(
      page,
      "Download SVG",
      info.outputPath("question-and-answer.svg"),
    )
  ).toString("utf8");
  expect(svg).not.toContain("Question above");
  expect(svg).not.toContain("Answer below");
  expect(svg).toContain('y="59"');
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByLabel("Show saved final answer", { exact: true }),
  ).not.toBeChecked();
  await below.getByRole("button").click();
  await below.getByRole("button").click();
  expect((await saved(page)).document.answer).toBe("x^2+5x+6");
  await above.getByRole("button").click();
  await expect(
    page.getByLabel("Include question", { exact: true }),
  ).not.toBeChecked();
});

test("placement buttons handle an empty question and factorising blanks at 320px", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 780 });
  const original = example("factor");
  original.document.expression = "";
  await load(page, original);
  await page
    .getByRole("button", { name: "+ Question above", exact: true })
    .click();
  await page.getByLabel("Printed question expression").fill("x^2+5x+6");
  await expect(
    page.getByRole("button", { name: "+ Answer below", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Apply question", exact: true })
    .click();
  await page
    .getByRole("button", { name: "+ Answer below", exact: true })
    .click();
  await expect
    .poll(async () => (await saved(page)).document.answerVisible)
    .toBe(true);
  expect((await saved(page)).document.rows).toEqual(original.document.rows);
  const art = await resource(page).boundingBox();
  for (const name of ["Question placement", "Answer placement"]) {
    const button = await page
      .getByRole("group", { name, exact: true })
      .getByRole("button")
      .boundingBox();
    expect(
      Math.abs(button!.x + button!.width / 2 - art!.x - art!.width / 2),
    ).toBeLessThan(1);
  }
  await page.screenshot({
    path: info.outputPath("placement-mobile.png"),
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
});

test("Light, Standard and ratio-table Thick rules export at their labelled widths", async ({
  page,
}, info) => {
  await load(page);
  const lines = page.getByRole("combobox", { name: "Grid lines", exact: true });
  await expect(lines).toHaveValue("0.5");
  for (const [value, label] of [
    ["0.35", "Light · 0.35 mm"],
    ["0.5", "Standard · 0.5 mm"],
    ["0.79375", "Thick · 2.25 pt (ratio tables)"],
  ]) {
    await lines.selectOption({ label });
    const svg = (
      await download(
        page,
        "Download SVG",
        info.outputPath(`rules-${value}.svg`),
      )
    ).toString("utf8");
    expect(svg).toContain(`stroke-width="${value}" stroke-linecap="butt"`);
    expect((await saved(page)).document.gridLineMm).toBe(Number(value));
    expect(svg.match(/<line\b/g)).toHaveLength(4);
  }
  const file = JSON.parse(
    (
      await download(page, "Save editable file", info.outputPath("thick.json"))
    ).toString("utf8"),
  );
  expect(file.document.gridLineMm).toBe(0.79375);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(lines).toHaveValue("0.5");
});

test("printed question edits save, export and undo without changing grid entries", async ({
  page,
}, info) => {
  const original = example();
  original.document.questionVisible = true;
  await load(page, original);
  const question = page.getByRole("button", {
    name: "Edit printed question",
    exact: true,
  });
  await question.focus();
  await question.press("Enter");
  const input = page.getByRole("textbox", {
    name: "Printed question expression",
  });
  await expect(input).toBeFocused();
  await input.fill("(x+3)(x+2)");
  await input.press("Enter");
  await expect(question).toBeFocused();
  await expect(
    page.getByLabel("Question expression", { exact: true }),
  ).toHaveValue("(x+3)(x+2)");
  await expect
    .poll(async () => (await saved(page)).document.expression)
    .toBe("(x+3)(x+2)");
  expect((await saved(page)).document.rows).toEqual(original.document.rows);
  await expect(
    resource(page).locator("svg text").filter({ hasText: "Expand" }),
  ).toHaveText("Expand (x+3)(x+2)");
  const svg = (
    await download(page, "Download SVG", info.outputPath("edited-question.svg"))
  ).toString("utf8");
  const printed = svg.match(/<text x="3" y="6"[^>]*>([\s\S]*?)<\/text>/)?.[1];
  expect(printed?.replace(/<[^>]*>/g, "")).toBe("Expand (x+3)(x+2)");
  expect(svg).toContain(`width="${layout(await saved(page)).width}mm"`);
  expect(svg).not.toContain("Edit printed question");
  const file = JSON.parse(
    (
      await download(
        page,
        "Save editable file",
        info.outputPath("edited-question.json"),
      )
    ).toString("utf8"),
  );
  expect(file.document.expression).toBe("(x+3)(x+2)");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByLabel("Question expression", { exact: true }),
  ).toHaveValue(original.document.expression);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).document.expression)
    .toBe("(x+3)(x+2)");
  // Reload without the setup script replacing the saved edit.
  const next = await page.context().newPage();
  await next.goto("/tools/expanding-factorising");
  await expect(
    next.getByLabel("Question expression", { exact: true }),
  ).toHaveValue("(x+3)(x+2)");
  await next.close();
});

test("invalid printed question drafts survive navigation and cancel without a saved change", async ({
  page,
}) => {
  const original = example();
  original.document.questionVisible = true;
  await load(page, original);
  const question = page.getByRole("button", {
    name: "Edit printed question",
    exact: true,
  });
  await question.click();
  const input = page.getByRole("textbox", {
    name: "Printed question expression",
  });
  await input.fill("1/");
  await page.getByRole("button", { name: "Apply question" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy for Word", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();
  const nav = page.getByRole("navigation", {
    name: "Booklet tools",
    exact: true,
  });
  await nav.getByRole("link", { name: "Graph tool", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Edit printed question" }),
  ).toBeHidden();
  await nav
    .getByRole("link", { name: "Expanding and factorising", exact: true })
    .click();
  await expect(input).toHaveValue("1/");
  await input.press("Escape");
  await expect(question).toBeFocused();
  expect((await saved(page)).document).toEqual(original.document);
  await question.click();
  await input.fill("3(x+4)");
  await page.getByRole("button", { name: "Cancel question" }).click();
  expect((await saved(page)).document).toEqual(original.document);
});

test("printed factorising question remains editable without a visible grid on a narrow screen", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const original = example("factor");
  original.document.questionVisible = true;
  original.document.gridVisible = false;
  await load(page, original);
  await page
    .getByRole("button", { name: "Edit printed question", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Edit printed question" });
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  await page.getByLabel("Printed question expression").fill("x^2+4x+3");
  await page.screenshot({
    path: info.outputPath("question-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Apply question" }).click();
  await expect
    .poll(async () => (await saved(page)).document.expression)
    .toBe("x^2+4x+3");
  expect((await saved(page)).document.rows).toEqual(original.document.rows);
  await page.getByLabel("Include question", { exact: true }).uncheck();
  await expect(
    page.getByRole("button", { name: "Edit printed question", exact: true }),
  ).toHaveCount(0);
});

test("clearing a printed question returns focus to its settings field", async ({
  page,
}) => {
  const original = example();
  original.document.questionVisible = true;
  await load(page, original);
  await page
    .getByRole("button", { name: "Edit printed question", exact: true })
    .click();
  await page.getByLabel("Printed question expression").fill("");
  await page.getByRole("button", { name: "Apply question" }).click();
  await expect(
    page.getByLabel("Question expression", { exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Edit printed question", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit printed question", exact: true }),
  ).toBeVisible();
});

test("opens through the real overview card with renderer artwork and a preserved scaffold", async ({
  page,
}, info) => {
  await page.goto("/tools");
  const link = page.getByRole("link", {
    name: /Open Expanding and factorising/,
  });
  await expect(link.locator("img")).toBeVisible();
  await expect(link.locator("img")).toHaveJSProperty("naturalWidth", 147);
  await link.click();
  await expect(page).toHaveTitle("Expanding and factorising · Maths Dock");
  await expect(resource(page).locator("svg line")).toHaveCount(4);
  await expect(cell(page, 1, 1)).toHaveAccessibleName(/blank/);
  const white = await resource(page).boundingBox(),
    rowControls = await page
      .getByRole("group", { name: "Grid rows", exact: true })
      .boundingBox(),
    columns = await page
      .getByRole("group", { name: "Grid columns", exact: true })
      .boundingBox();
  expect(rowControls!.y).toBeGreaterThanOrEqual(white!.y + white!.height);
  expect(columns!.x).toBeGreaterThanOrEqual(white!.x + white!.width);
  expect(columns!.x - white!.x - white!.width).toBeLessThan(30);
  await page.screenshot({
    path: info.outputPath("desktop.png"),
    fullPage: true,
  });
});
for (const size of [12, 15, 18])
  for (const [name, rows, cols] of [
    ["single", 2, 3],
    ["double", 3, 3],
    ["cubic", 3, 4],
  ] as const) {
    test(`${name}, ${size} mm: exact writing footprint in actual SVG/JSON and unchanged paper/zoom`, async ({
      page,
    }, info) => {
      const equal = setSize(example(name), size);
      equal.document.compactHeadings = false;
      await load(page, equal);
      await page
        .getByRole("combobox", { name: "Paper", exact: true })
        .selectOption("A3");
      await page
        .getByRole("combobox", { name: "Preview zoom", exact: true })
        .selectOption("2");
      await expect(resource(page).locator("svg")).toHaveAttribute(
        "width",
        `${cols * size}mm`,
      );
      const bytes = await download(
        page,
        "Download SVG",
        info.outputPath(`${name}-${size}.svg`),
      );
      const svg = bytes.toString("utf8");
      expect(svg).toContain(
        `width="${cols * size}mm" height="${rows * size}mm"`,
      );
      expect(svg.match(/<line /g)).toHaveLength(rows + cols - 2);
      expect(svg).toContain("data:font/otf;base64,");
      expect(svg).not.toMatch(/ag-cell|ag-selected|<image|<script/);
      const file = await download(
        page,
        "Save editable file",
        info.outputPath(`${name}-${size}.json`),
      );
      const actual = JSON.parse(file.toString("utf8"));
      expect(
        actual.document.rows
          .slice(1)
          .every((row: { cells: { value: string | null }[] }) =>
            row.cells.slice(1).every((c) => c.value === null),
          ),
      ).toBe(true);
      expect(layout(actual).gridWidth).toBe(cols * size);
      expect(layout(actual).gridHeight).toBe(rows * size);
    });
  }
test("edits blank/zero/hidden states, exports pupil visibility and preserves exact editable round trips", async ({
  page,
}, info) => {
  await page.goto("/tools/expanding-factorising");
  await edit(page, 1, 1, "x^2", true);
  const before = await saved(page);
  expect(before.document.rows[1].cells[1]).toEqual({
    value: "x^2",
    hidden: true,
  });
  await expect(resource(page).locator("svg text")).toHaveCount(5);
  await page.getByLabel("Preview saved hidden answers").check();
  await expect(resource(page).locator("svg text")).toHaveCount(6);
  const svg = (
    await download(page, "Download SVG", info.outputPath("hidden-pupil.svg"))
  ).toString("utf8");
  expect((svg.match(/<text /g) || []).length).toBe(5);
  await edit(page, 1, 2, "0");
  const original = await saved(page),
    raw = await download(
      page,
      "Save editable file",
      info.outputPath("hidden-zero.json"),
    );
  expect(JSON.parse(raw.toString("utf8"))).toEqual(original);
  await page.getByRole("button", { name: "+ Row", exact: true }).click();
  expect(
    (await saved(page)).document.rows[3].cells.every(
      (c: { value: unknown }) => c.value === null,
    ),
  ).toBe(true);
  await clickResourceAction(page, "Open editable file");
  await page
    .locator('input[type="file"][aria-label="Open algebra grid file"]')
    .setInputFiles({
      name: "saved.json",
      mimeType: "application/json",
      buffer: raw,
    });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await saved(page)).document.rows).toHaveLength(4);
  await page
    .locator('input[type="file"][aria-label="Open algebra grid file"]')
    .setInputFiles({
      name: "saved.json",
      mimeType: "application/json",
      buffer: raw,
    });
  await page.getByRole("button", { name: "Apply replacement" }).click();
  expect(await saved(page)).toEqual(original);
  await cell(page, 1, 1).click();
  await page.getByRole("button", { name: "Clear cell", exact: true }).click();
  await page.getByRole("button", { name: "Apply cell", exact: true }).click();
  expect((await saved(page)).document.rows[1].cells[1]).toEqual({
    value: null,
    hidden: false,
  });
});
test("invalid drafts guard exports/history, survive navigation, and cancel without committing", async ({
  page,
}) => {
  await page.goto("/tools/expanding-factorising");
  // The editor's code loads after the page, then it saves its first draft.
  await expect.poll(() => saved(page)).not.toBeNull();
  const original = await saved(page);
  await cell(page, 0, 2).click();
  await page.getByLabel("Cell entry", { exact: true }).fill("1/");
  await page.getByRole("button", { name: "Apply cell" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy for Word", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("navigation", { name: "Booklet tools", exact: true })
    .getByRole("link", { name: "Graph tool", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Edit grid cell" }),
  ).toBeHidden();
  await page
    .getByRole("navigation", { name: "Booklet tools", exact: true })
    .getByRole("link", { name: "Expanding and factorising", exact: true })
    .click();
  await expect(page.getByLabel("Cell entry", { exact: true })).toHaveValue(
    "1/",
  );
  await page.getByRole("button", { name: "Cancel cell" }).click();
  expect(await saved(page)).toEqual(original);
  await page.getByLabel("Cell size (mm)", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Apply setting" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Cell size (mm)", { exact: true })).toHaveValue(
    "0",
  );
  await page.getByRole("button", { name: "Cancel setting" }).click();
  await expect(page.getByLabel("Cell size (mm)", { exact: true })).toHaveValue(
    "15",
  );
});
test("explicit products/answers use undo and heading edits preserve products with visible warnings", async ({
  page,
}) => {
  await page.goto("/tools/expanding-factorising");
  await page
    .getByRole("button", { name: "Fill products", exact: true })
    .click();
  await expect(cell(page, 1, 1)).toHaveAccessibleName(/x²/);
  await page
    .getByRole("button", { name: "Collect like terms", exact: true })
    .click();
  expect((await saved(page)).document.answer).toBe("x^2+5x+6");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await saved(page)).document.answer).toBe("");
  await edit(page, 0, 2, "+4");
  expect((await saved(page)).document.rows[1].cells[2].value).toBe("+3x");
  await expect(
    page.getByRole("button", { name: "Copy for Word", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("This is an intentional error-spotting task").check();
  await expect(
    page.getByRole("button", { name: "Copy for Word", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Fill products", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await saved(page)).document.rows[1].cells[2].value).toBe("+3x");
});
test("factorising accepts reverse trials only when the entire expression matches and replaces with an undoable solved version", async ({
  page,
}) => {
  await load(page, example("factor"));
  const original = await saved(page);
  await page
    .getByRole("button", { name: "Use worked version", exact: true })
    .click();
  expect((await saved(page)).document.answer).toMatch(
    /\(x\+2\)\(x\+3\)|\(x\+3\)\(x\+2\)/,
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await saved(page)).toEqual(original);
  await edit(page, 0, 2, "+1");
  await edit(page, 2, 0, "+6");
  await expect(
    page.getByRole("listitem").filter({
      hasText: "These headings do not reproduce the whole target expression.",
    }),
  ).toBeVisible();
  await edit(page, 0, 2, "+2");
  await edit(page, 2, 0, "+3");
  await page
    .getByRole("button", { name: "Fill products", exact: true })
    .click();
  await page.getByRole("button", { name: "Apply replacement" }).click();
  await page.getByRole("button", { name: "Read factors", exact: true }).click();
  expect((await saved(page)).document.answer).toBe("(x+3)(x+2)");
});
test("imports linked resources with cancel/undo guards and discloses hidden answers", async ({
  page,
}) => {
  const e = setCell(example("single"), 1, 1, "3x", true);
  await page.goto(editorLink(e, test.info().project.use.baseURL!));
  await expect(page.getByRole("dialog")).toContainText("hidden answers");
  await page.getByRole("button", { name: "Apply replacement" }).click();
  expect(await saved(page)).toEqual(e);
  await expect(resource(page).locator("svg")).toHaveAttribute("width", "39mm");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(resource(page).locator("svg")).toHaveAttribute("height", "39mm");
});
test("real PNG exports preserve 600 ppi dimensions, including maximum blank writing space", async ({
  page,
}, info) => {
  await load(page, create(7, 7));
  const bytes = await download(
    page,
    "Download PNG (600 ppi)",
    info.outputPath("maximum.png"),
  );
  const size = printRasterSize(10.5, 10.5);
  verifyPrintBytes(new Uint8Array(bytes), size.width, size.height);
  await expect(
    page.getByRole("button", { name: "+ Row", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "+ Column", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Show grid (turn off for working space only)")
    .uncheck();
  const blank = (
    await download(page, "Download SVG", info.outputPath("working-space.svg"))
  ).toString("utf8");
  expect(blank).toContain('width="105mm" height="105mm"');
  expect(blank).not.toContain("<text");
  expect(blank).not.toContain("<line");
});
test("image clipboard and Word HTML use the same physical export with recoverable refusal", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "algebraCopy", {
      value: { image: null, html: "" },
      writable: true,
    });
    document.execCommand = () => {
      (
        window as unknown as { algebraCopy: { html: string } }
      ).algebraCopy.html =
        document.querySelector('[contenteditable="true"]')?.innerHTML || "";
      return true;
    };
    Object.defineProperty(navigator, "clipboard", {
      value: {
        write: async (items: ClipboardItem[]) => {
          const blob = await items[0].getType("image/png");
          (
            window as unknown as { algebraCopy: { image: number[] } }
          ).algebraCopy.image = Array.from(
            new Uint8Array(await blob.arrayBuffer()),
          );
        },
      },
      configurable: true,
    });
  });
  await page.goto("/tools/expanding-factorising");
  await page.getByRole("button", { name: "Copy image", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Image copied");
  const data = await page.evaluate(
    () =>
      (window as unknown as { algebraCopy: { image: number[] } }).algebraCopy
        .image,
  );
  verifyPrintBytes(Uint8Array.from(data), 921, 921);
  await page
    .getByRole("button", { name: "Copy for Word", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Copied for Word");
  const html = await page.evaluate(
    () =>
      (window as unknown as { algebraCopy: { html: string } }).algebraCopy.html,
  );
  expect(html).toContain("width:3.9cm;height:3.9cm");
  expect(html).toContain("data:image/png;base64,");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: {
        write: async () => {
          throw Error("Denied");
        },
      },
      configurable: true,
    }),
  );
  await page.getByRole("button", { name: "Copy image", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Download PNG");
});
for (const width of [1440, 768, 375, 320])
  test(`focused edge cells and maximum grids fit a ${width}px viewport`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 900 });
    await load(page, create(7, 7));
    await page
      .getByRole("combobox", { name: "Preview zoom", exact: true })
      .selectOption("1");
    await cell(page, 6, 6).click();
    await page.getByLabel("Cell entry", { exact: true }).fill("-12x^2");
    const dialog = page.getByRole("dialog", { name: "Edit grid cell" });
    await expect(dialog).toBeVisible();
    await expect
      .poll(async () => {
        const b = await dialog.boundingBox();
        return (
          b!.x >= 0 &&
          b!.x + b!.width <= width &&
          b!.y >= 0 &&
          b!.y + b!.height <= 900
        );
      })
      .toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: info.outputPath(`focused-${width}.png`),
      fullPage: true,
    });
    await page.getByLabel("Cell entry", { exact: true }).press("Escape");
    await expect(dialog).toHaveCount(0);
    expect(errors).toEqual([]);
  });
test("newer-tab storage and corrupt recovery data are protected", async ({
  page,
}) => {
  await page.addInitScript(
    (key) => localStorage.setItem(key, "{corrupt original"),
    KEY,
  );
  await page.goto("/tools/expanding-factorising");
  await expect(
    page.getByRole("heading", { name: "Protect saved work" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "+ Row", exact: true }),
  ).toBeDisabled();
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(
    "{corrupt original",
  );
  const second = await page.context().newPage();
  await second.goto("/tools/graph");
  await second.evaluate(({ key, text }) => localStorage.setItem(key, text), {
    key: KEY,
    text: canonical(example("single")),
  });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Start fresh", exact: true }).click();
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(
    canonical(example("single")),
  );
  await second.close();
});
test("column widths, intermediate cells and paper-fit warnings keep exact dimensions", async ({
  page,
}) => {
  await load(page, create(7, 7));
  await page.getByLabel("Cell size (mm)", { exact: true }).fill("13.5");
  await page.getByLabel("Cell size (mm)", { exact: true }).press("Enter");
  await expect(resource(page).locator("svg")).toHaveAttribute(
    "width",
    "94.5mm",
  );
  await page.getByText("Individual column widths", { exact: true }).click();
  for (let i = 1; i <= 7; i++) {
    const input = page.getByLabel(`Column ${i} width (mm)`, { exact: true });
    await input.fill("45");
    await input.press("Enter");
  }
  await expect(resource(page).locator("svg")).toHaveAttribute("width", "315mm");
  await expect(
    page.getByRole("button", { name: "Copy for Word", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("combobox", { name: "Paper", exact: true })
    .selectOption("A3");
  await page
    .getByRole("combobox", { name: "Orientation", exact: true })
    .selectOption("landscape");
  await expect(
    page.getByRole("button", { name: "Copy for Word", exact: true }),
  ).toBeEnabled();
  await expect(resource(page).locator("svg")).toHaveAttribute("width", "315mm");
  await expect(resource(page).locator("svg")).toHaveAttribute(
    "height",
    "94.5mm",
  );
});
test("keyboard cell editing restores focus and makes one undoable edit", async ({
  page,
}) => {
  await page.goto("/tools/expanding-factorising");
  await cell(page, 0, 2).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Cell entry", { exact: true })).toBeFocused();
  await page.getByLabel("Cell entry", { exact: true }).fill("+4");
  await page.keyboard.press("Enter");
  await expect(cell(page, 0, 2)).toBeFocused();
  await page.keyboard.press("Control+z");
  await expect(cell(page, 0, 2)).toHaveAccessibleName(/\+3/);
  await page.keyboard.press("Enter");
  await page.getByLabel("Cell entry", { exact: true }).fill("+5");
  await page.keyboard.press("Escape");
  await expect(cell(page, 0, 2)).toBeFocused();
  await expect(cell(page, 0, 2)).toHaveAccessibleName(/\+3/);
});
test("touch gestures commit once and leave undo/redo usable", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto("/tools/expanding-factorising");
  await page.getByRole("button", { name: "+ Row", exact: true }).tap();
  expect((await saved(page)).document.rows).toHaveLength(4);
  await page.getByRole("button", { name: "Undo", exact: true }).tap();
  expect((await saved(page)).document.rows).toHaveLength(3);
  await page.getByRole("button", { name: "Redo", exact: true }).tap();
  expect((await saved(page)).document.rows).toHaveLength(4);
  await cell(page, 1, 1).tap();
  await page.getByLabel("Cell entry", { exact: true }).fill("x^2");
  await page.getByRole("button", { name: "Apply cell" }).tap();
  expect((await saved(page)).document.rows[1].cells[1].value).toBe("x^2");
  await context.close();
});
test("past-paper presets use the inspected source and actual question-bank link", async ({
  page,
}) => {
  await page.goto("/tools/expanding-factorising");
  await showExamples(page);
  const popup = page.waitForEvent("popup");
  await galleryCard(page, "Q26(a): expand")
    .getByRole("link", { name: "View source question", exact: true })
    .click();
  const source = await popup;
  await expect(source.locator(".qb-source-heading")).toContainText(
    "November 2018 2F Q26",
  );
  await source.close();
  await chooseExample(page, "Q26(a): expand");
  await page.getByRole("button", { name: "Apply replacement" }).click();
  expect((await saved(page)).document.expression).toBe("(5x+2)(2x-3)");
  await chooseExample(page, "Q26(b): factorise");
  await page.getByRole("button", { name: "Apply replacement" }).click();
  expect((await saved(page)).document.expression).toBe("x^2+4x+3");
});
test("automatic compact headings preserve product dimensions in the real SVG/PNG and editor", async ({
  page,
}, info) => {
  await page.goto("/tools/expanding-factorising");
  await page
    .getByRole("combobox", { name: "Preview zoom", exact: true })
    .selectOption("1");
  await expect(resource(page).locator("svg")).toHaveAttribute("width", "39mm");
  await expect(resource(page).locator("svg")).toHaveAttribute("height", "39mm");
  const product = await cell(page, 1, 1).boundingBox(),
    heading = await cell(page, 0, 0).boundingBox();
  expect(product!.width).toBeCloseTo((15 * 96) / 25.4, 1);
  expect(product!.height).toBeCloseTo((15 * 96) / 25.4, 1);
  expect(heading!.width).toBeCloseTo((9 * 96) / 25.4, 1);
  expect(heading!.height).toBeCloseTo((9 * 96) / 25.4, 1);
  const originalRows = (await saved(page)).document.rows;
  const svg = (
    await download(page, "Download SVG", info.outputPath("automatic.svg"))
  ).toString("utf8");
  expect(svg).toContain('stroke-width="0.5" stroke-linecap="butt"');
  expect(svg).toContain('y1="9" y2="9"');
  expect(svg).toContain('x1="9" x2="9"');
  const png = await download(
    page,
    "Download PNG (600 ppi)",
    info.outputPath("automatic.png"),
  );
  verifyPrintBytes(new Uint8Array(png), 921, 921);
  await page
    .getByLabel("Automatically compact filled headings", { exact: true })
    .uncheck();
  await expect(resource(page).locator("svg")).toHaveAttribute("width", "45mm");
  await expect(resource(page).locator("svg")).toHaveAttribute("height", "45mm");
  expect((await saved(page)).document.rows).toEqual(originalRows);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(resource(page).locator("svg")).toHaveAttribute("width", "39mm");
  await page.getByText("Individual column widths", { exact: true }).click();
  await page.getByLabel("Column 1 width (mm)", { exact: true }).fill("15.0");
  await page.getByLabel("Column 1 width (mm)", { exact: true }).press("Enter");
  await expect(resource(page).locator("svg")).toHaveAttribute("width", "45mm");
  await expect(resource(page).locator("svg")).toHaveAttribute("height", "39mm");
  await page
    .getByRole("button", { name: "Default 15 mm", exact: true })
    .click();
  await expect(resource(page).locator("svg")).toHaveAttribute("width", "39mm");
});
test("hidden/blank headings keep writing space and compact again only after an explicit visible entry", async ({
  page,
}) => {
  await page.goto("/tools/expanding-factorising");
  await edit(page, 0, 2, "+3", true);
  await expect(resource(page).locator("svg")).toHaveAttribute("height", "45mm");
  await expect(resource(page).locator("svg")).toHaveAttribute("width", "39mm");
  await page
    .getByLabel("Preview saved hidden answers", { exact: true })
    .check();
  await expect(resource(page).locator("svg")).toHaveAttribute("height", "45mm");
  await edit(page, 2, 0, "");
  await expect(resource(page).locator("svg")).toHaveAttribute("width", "45mm");
  await edit(page, 2, 0, "0");
  await expect(resource(page).locator("svg")).toHaveAttribute("width", "39mm");
  await cell(page, 0, 2).click();
  await page.getByLabel("Hide saved answer from pupils").uncheck();
  await page.getByRole("button", { name: "Apply cell", exact: true }).click();
  await expect(resource(page).locator("svg")).toHaveAttribute("height", "39mm");
});
test("factorising blanks and automatic resizing survive exports and explicit line choices", async ({
  page,
}, info) => {
  await load(page, example("factor"));
  await expect(resource(page).locator("svg")).toHaveAttribute("width", "45mm");
  await expect(resource(page).locator("svg")).toHaveAttribute("height", "45mm");
  const rows = (await saved(page)).document.rows;
  await page
    .getByRole("combobox", { name: "Grid lines", exact: true })
    .selectOption("0.79375");
  const svg = (
    await download(
      page,
      "Download SVG",
      info.outputPath("factorising-thick.svg"),
    )
  ).toString("utf8");
  expect(svg).toContain('stroke-width="0.79375" stroke-linecap="butt"');
  expect((await saved(page)).document.rows).toEqual(rows);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Grid lines", exact: true }),
  ).toHaveValue("0.5");
  await edit(page, 0, 2, "+3");
  await edit(page, 2, 0, "+2");
  await expect(resource(page).locator("svg")).toHaveAttribute("width", "39mm");
  await expect(resource(page).locator("svg")).toHaveAttribute("height", "39mm");
  await page.getByRole("button", { name: "+ Row", exact: true }).click();
  await expect(resource(page).locator("svg")).toHaveAttribute("width", "45mm");
  await expect(resource(page).locator("svg")).toHaveAttribute("height", "54mm");
});
test("upgrades an existing device draft once with Undo, while importing its old file keeps the original layout", async ({
  page,
}) => {
  const raw = await readFile(
    "packages/algebra-grid-core/fixtures/first-draft-double.json",
    "utf8",
  );
  await page.addInitScript(
    ({ key, raw }) => {
      if (!sessionStorage.getItem("fixture-set")) {
        localStorage.setItem(key, raw);
        sessionStorage.setItem("fixture-set", "yes");
      }
    },
    { key: KEY, raw },
  );
  await page.goto("/tools/expanding-factorising");
  await expect(resource(page).locator("svg")).toHaveAttribute("width", "39mm");
  await expect(page.getByRole("status")).toContainText("Updated this draft");
  expect((await saved(page)).document.rows).toEqual(
    JSON.parse(raw).document.rows,
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(resource(page).locator("svg")).toHaveAttribute("width", "45mm");
  await expect(
    page.getByRole("combobox", { name: "Grid lines", exact: true }),
  ).toHaveValue("0.2");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(resource(page).locator("svg")).toHaveAttribute("width", "39mm");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();
  await page
    .locator('input[type="file"][aria-label="Open algebra grid file"]')
    .setInputFiles({
      name: "first-draft.json",
      mimeType: "application/json",
      buffer: Buffer.from(raw),
    });
  await page
    .getByRole("button", { name: "Apply replacement", exact: true })
    .click();
  await expect(resource(page).locator("svg")).toHaveAttribute("width", "45mm");
  await expect(
    page.getByRole("combobox", { name: "Grid lines", exact: true }),
  ).toHaveValue("0.2");
});
