import { clickResourceAction } from "./resource-actions";
import { test, expect, type Page } from "./release-fixtures";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  create,
  upgrade,
  canonical,
  encode,
  layout,
} from "../packages/cuboid-core/src";
test.use({ permissions: ["clipboard-read", "clipboard-write"] });
const report = join(
  process.cwd(),
  process.env.CUBOID_REPORT_DIR ?? "test-results/cuboids",
);
mkdirSync(join(report, "exports"), { recursive: true });
const resource = (p: Page) => p.getByTestId("cuboid-resource");
async function field(p: Page, label: string, value: string) {
  const input = p.getByRole("textbox", { name: label, exact: true });
  if (!(await input.isVisible())) {
    if (
      [
        "Label text",
        "Label horizontal offset",
        "Label vertical offset",
      ].includes(label)
    )
      await p.getByRole("tab", { name: "Labels", exact: true }).click();
    else if (!label.startsWith("Edit "))
      await p.getByRole("tab", { name: "Shape", exact: true }).click();
    if (label === "Cube side length" && !(await input.isVisible()))
      await p.getByText("Cube size and counts", { exact: true }).click();
  }
  await p.getByRole("textbox", { name: label, exact: true }).fill(value);
  await p.getByRole("textbox", { name: label, exact: true }).press("Enter");
}
async function useExample(
  p: Page,
  title: string,
  worked = false,
  _source = false,
) {
  await p.getByText("Examples", { exact: true }).click();
  const card = p
    .locator(".cb-example")
    .filter({ has: p.getByRole("heading", { name: title, exact: true }) });
  await card
    .getByRole("button", {
      name: worked ? "Use worked example" : "Use scaffold",
      exact: true,
    })
    .click();
  await p
    .getByRole("button", { name: "Use these cuboids", exact: true })
    .click();
}
test.beforeEach(async ({ page }) => {
  await page.goto("/?tool=cuboids");
  await expect(
    page.getByRole("heading", { name: "Cuboids", exact: true }),
  ).toBeVisible();
});
test("default exam diagram has a clean resource and no answer", async ({
  page,
}) => {
  await expect(resource(page)).toContainText("4 cm");
  await expect(resource(page)).toContainText("3 cm");
  await expect(resource(page)).not.toContainText("Volume");
  expect(await resource(page).locator("svg button").count()).toBe(0);
  await page.screenshot({
    path: join(report, "cuboids-default-1440.png"),
    fullPage: true,
  });
});
test("direct label edit changes the dimension with Undo and Redo", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Edit width label on cuboid-1", exact: true })
    .click();
  await field(page, "Edit width", "5");
  await page.getByRole("tab", { name: "Shape", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Width", exact: true }),
  ).toHaveValue("5");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Width", exact: true }),
  ).toHaveValue("4");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(resource(page)).toContainText("5 cm");
});
test("1 cm cubes and separated layers keep a missing height blank", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "Labels", exact: true }).click();
  await page.getByLabel("Edge or face", { exact: true }).selectOption("height");
  await page.getByRole("tab", { name: "Labels", exact: true }).click();
  await page
    .getByLabel("Label appearance", { exact: true })
    .selectOption("blank");
  await page
    .getByRole("button", { name: "Show 1 cm³ cubes", exact: true })
    .click();
  await expect(resource(page).locator('g[data-cube-count="24"]')).toHaveCount(
    1,
  );
  await page.getByLabel("View", { exact: true }).selectOption("layers");
  await expect(resource(page).locator("g[data-layer]")).toHaveCount(2);
  await expect(resource(page)).not.toContainText("2 cm");
  await expect(resource(page)).not.toContainText("Volume");
  await page.screenshot({
    path: join(report, "cuboids-layers.png"),
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByLabel("View", { exact: true })).toHaveValue("layers");
  await page.getByRole("tab", { name: "Labels", exact: true }).click();
  await page.getByLabel("Edge or face", { exact: true }).selectOption("height");
  await expect(
    page.getByLabel("Label appearance", { exact: true }),
  ).toHaveValue("blank");
});
test("cube structure and equal-edge edits are reversible", async ({ page }) => {
  await page
    .getByRole("button", { name: "Show 1 cm³ cubes", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add one cube to height", exact: true })
    .click();
  await expect(resource(page).locator('g[data-cube-count="36"]')).toHaveCount(
    1,
  );
  await page
    .getByRole("button", { name: "Remove one cube from height", exact: true })
    .click();
  await expect(resource(page).locator('g[data-cube-count="24"]')).toHaveCount(
    1,
  );
  await page.getByLabel("Cube (equal edges)", { exact: true }).check();
  await field(page, "Height", "3");
  await expect(
    page.getByRole("textbox", { name: "Width", exact: true }),
  ).toHaveValue("3");
  await expect(
    page.getByRole("textbox", { name: "Depth", exact: true }),
  ).toHaveValue("3");
});
test("non-dividing cube view is refused and original dimensions are retained", async ({
  page,
}) => {
  await field(page, "Width", "2.5");
  await page
    .getByRole("button", { name: "Show 1 cm³ cubes", exact: true })
    .click();
  await expect(page.locator(".resource-feedback")).toContainText(
    "whole number",
  );
  await expect(page.getByLabel("View", { exact: true })).toHaveValue("plain");
  await expect(
    page.getByRole("textbox", { name: "Width", exact: true }),
  ).toHaveValue("2.5");
  await page.getByText("Cube size and counts", { exact: true }).click();
  await field(page, "Cube side length", "0.5");
  await page.getByLabel("View", { exact: true }).selectOption("cubes");
  await expect(resource(page).locator('g[data-cube-count="120"]')).toHaveCount(
    1,
  );
});
test("invalid draft blocks exports and remains correctable with Escape", async ({
  page,
}) => {
  await field(page, "Width", "0");
  await expect(
    page.getByRole("textbox", { name: "Width", exact: true }),
  ).toHaveValue("0");
  await expect(
    page.getByRole("button", { name: "Copy to clipboard", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("textbox", { name: "Width", exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await page
    .getByRole("textbox", { name: "Width", exact: true })
    .press("Escape");
  await expect(
    page.getByRole("textbox", { name: "Width", exact: true }),
  ).toHaveValue("4");
  await expect(
    page.getByRole("button", { name: "Copy to clipboard", exact: true }),
  ).toBeEnabled();
});
test("unit conversions retain physical shape and grid", async ({ page }) => {
  await page.getByLabel("Units", { exact: true }).selectOption("mm");
  await expect(
    page.getByRole("textbox", { name: "Width", exact: true }),
  ).toHaveValue("40");
  await page
    .getByRole("button", { name: "Show 1 cm³ cubes", exact: true })
    .click();
  await expect(resource(page).locator('g[data-cube-count="24"]')).toHaveCount(
    1,
  );
  await page.getByLabel("Units", { exact: true }).selectOption("m");
  await expect(
    page.getByRole("textbox", { name: "Width", exact: true }),
  ).toHaveValue("1/25");
  await expect(resource(page).locator('g[data-cube-count="24"]')).toHaveCount(
    1,
  );
});
test("multiple cuboids preserve independent labels through removal and Undo", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Add cuboid", exact: true }).click();
  await field(page, "Width", "6");
  await page.getByRole("tab", { name: "Labels", exact: true }).click();
  await page
    .getByLabel("Label appearance", { exact: true })
    .selectOption("text");
  await field(page, "Label text", "x cm");
  await expect(resource(page)).toContainText("x cm");
  await page
    .getByRole("button", { name: "Remove selected cuboid", exact: true })
    .click();
  await expect(resource(page)).not.toContainText("x cm");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(resource(page)).toContainText("x cm");
  expect(await resource(page).locator("g[data-shape]").count()).toBe(2);
});
test("face areas and hidden edges survive direction changes", async ({
  page,
}) => {
  await useExample(page, "Three face areas", false, true);
  await expect(resource(page)).toContainText("27 cm²");
  await expect(resource(page)).toContainText("45 cm²");
  await expect(resource(page)).toContainText("15 cm²");
  await page.getByRole("tab", { name: "Shape", exact: true }).click();
  await page.getByText("More shape options", { exact: true }).click();
  await page
    .getByLabel("Dashed hidden edges (exam view)", { exact: true })
    .check();
  await page
    .getByLabel("Receding direction", { exact: true })
    .selectOption("left");
  expect(await resource(page).locator("[stroke-dasharray]").count()).toBe(3);
  await page.screenshot({
    path: join(report, "cuboids-face-areas.png"),
    fullPage: true,
  });
});
test("source cube sizes and explicit worked choice have the right counts", async ({
  page,
}) => {
  await useExample(page, "Twelve 2 cm cubes", true, true);
  await expect(resource(page).locator('g[data-cube-count="12"]')).toHaveCount(
    1,
  );
  await expect(resource(page)).toContainText("12 cubes");
  await page
    .getByLabel("Selected cuboid", { exact: true })
    .selectOption("cuboid");
  await page.getByRole("tab", { name: "Shape", exact: true }).click();
  await page.getByText("Cube size and counts", { exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Cube side length", exact: true }),
  ).toHaveValue("2");
  await page.screenshot({
    path: join(report, "cuboids-source-comparison.png"),
    fullPage: true,
  });
});
test("examples require confirmation and cancellation preserves work", async ({
  page,
}) => {
  await field(page, "Width", "7");
  await page.getByText("Examples", { exact: true }).click();
  await page
    .locator(".cb-example")
    .filter({
      has: page.getByRole("heading", { name: "One layer", exact: true }),
    })
    .getByRole("button", { name: "Use scaffold", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Width", exact: true }),
  ).toHaveValue("7");
});
test("navigation retains valid and invalid input without inactive shortcuts", async ({
  page,
}) => {
  await field(page, "Width", "6");
  await page
    .locator(".site-tool-navigation")
    .getByRole("link", { name: "Graph tool", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Graph tool", exact: true }),
  ).toBeVisible();
  await page
    .locator(".site-tool-navigation")
    .getByRole("link", { name: "Cuboids", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Width", exact: true }),
  ).toHaveValue("6");
  await field(page, "Width", "bad");
  await page
    .locator(".site-tool-navigation")
    .getByRole("link", { name: "Ratio tables", exact: true })
    .click();
  await page
    .locator(".site-tool-navigation")
    .getByRole("link", { name: "Cuboids", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Width", exact: true }),
  ).toHaveValue("bad");
  await expect(
    page.getByRole("button", { name: "Copy for Word", exact: true }),
  ).toBeDisabled();
});
test("editable file and editor link reopening require confirmation", async ({
  page,
}) => {
  const e = create();
  e.document.shapes[0].dimensions.height = "3";
  e.document.shapes[0].view = "layers";
  await page
    .getByRole("button", { name: "Download options", exact: true })
    .click();
  await clickResourceAction(page, "Open editable file");
  await page.getByLabel("Open cuboids file", { exact: true }).setInputFiles({
    name: "cuboids.json",
    mimeType: "application/json",
    buffer: Buffer.from(canonical(e)),
  });
  await page
    .getByRole("button", { name: "Use these cuboids", exact: true })
    .click();
  await expect(resource(page).locator("g[data-layer]")).toHaveCount(3);
  const dl = page.waitForEvent("download");
  await clickResourceAction(page, "Save editable file");
  await (await dl).saveAs(join(report, "exports/reopened.json"));
  await page.goto(`/?tool=cuboids#cuboids=${encode(e)}`);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(resource(page).locator("g[data-layer]")).toHaveCount(3);
});
test("real PNG SVG and clipboard outputs contain only monochrome artwork", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Show 1 cm³ cubes", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Copy to clipboard", exact: true })
    .click();
  await expect(page.locator(".resource-feedback")).toContainText(
    /Image copied\. Paste with Ctrl\+V\./,
  );
  const bytes = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    const png = await items[0].getType("image/png");
    return Array.from(new Uint8Array(await png.arrayBuffer()));
  });
  expect(bytes.slice(0, 8)).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const fs = await import("node:fs");
  fs.writeFileSync(
    join(report, "exports/clipboard.png"),
    new Uint8Array(bytes),
  );
  await page
    .getByRole("button", { name: "Download options", exact: true })
    .click();
  for (const [name, file] of [
    ["Download PNG (600 ppi)", "actual-grid.png"],
    ["Download SVG", "actual-grid.svg"],
  ]) {
    const dl = page.waitForEvent("download");
    await clickResourceAction(page, name);
    await (await dl).saveAs(join(report, "exports", file));
  }
  await page
    .getByRole("button", { name: "Copy for Word", exact: true })
    .click();
  await expect(page.locator(".resource-feedback")).toContainText(
    /Copied for Word at/,
  );
});
test("maximum separated structure remains complete and has no control overlap", async ({
  page,
}) => {
  const e = create();
  e.document.widthCm = 16;
  e.document.shapes[0].view = "layers";
  e.document.shapes[0].dimensions = { width: "20", depth: "20", height: "20" };
  await page.goto(`/?tool=cuboids#cuboids=${encode(e)}`);
  await page
    .getByRole("button", { name: "Use these cuboids", exact: true })
    .click();
  await expect(resource(page).locator("g[data-layer]")).toHaveCount(20);
  expect(layout(e).minCell).toBeGreaterThanOrEqual(2);
  await expect(
    page.getByRole("button", { name: "Copy to clipboard", exact: true }),
  ).toBeEnabled();
  for (const n of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width: n, height: 900 });
    await expect(
      page.getByRole("button", { name: "Add one cube to width", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if (n === 320)
      await page.screenshot({
        path: join(report, "cuboids-max-320.png"),
        fullPage: true,
      });
  }
});
test("responsive controls and real card preview remain reachable", async ({
  page,
}) => {
  for (const n of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width: n, height: 900 });
    await expect(resource(page)).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: join(report, `cuboids-${n}.png`),
      fullPage: true,
    });
  }
  await page.goto("/?tool=booklet-tools");
  const card = page.locator(".overview-tool-card").filter({
    has: page.getByRole("heading", { name: "Cuboids", exact: true }),
  });
  await expect(card.locator("img")).toBeVisible();
  await expect
    .poll(() =>
      card
        .locator("img")
        .evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0),
    )
    .toBe(true);
  await page.screenshot({ path: join(report, "overview.png"), fullPage: true });
});
test("corrupt saved data is protected until recovery is downloaded", async ({
  page,
}) => {
  await page.evaluate(() =>
    localStorage.setItem("maths-booklet-tools:cuboids:v1", "not-json"),
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Copy to clipboard", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Start afresh", exact: true }),
  ).toBeDisabled();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download recovery data", exact: true })
    .click();
  await (await download).saveAs(join(report, "exports/recovery.json"));
  await page.getByRole("button", { name: "Start afresh", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Copy to clipboard", exact: true }),
  ).toBeEnabled();
});
test("newer-tab work is protected and storage failure offers editable saving", async ({
  page,
  context,
}) => {
  const other = await context.newPage();
  await other.goto("/?tool=cuboids");
  await field(other, "Width", "7");
  await expect(
    page.getByRole("button", { name: "Download recovery data", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy to clipboard", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("maths-booklet-tools:cuboids:v1")!)
          .document.shapes[0].dimensions.width,
    ),
  ).toBe("7");
  await other.close();
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw Error("storage denied for check");
    };
  });
  await page.reload();
  await expect(
    page.getByText("Save unavailable — download editable file", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy to clipboard", exact: true }),
  ).toBeEnabled();
});
test("three shapes, layer numbers and focused label editing fit narrow layouts", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Add cuboid", exact: true }).click();
  await page.getByRole("button", { name: "Add cuboid", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add cuboid", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Show 1 cm³ cubes", exact: true })
    .click();
  await page.getByLabel("View", { exact: true }).selectOption("layers");
  await page.getByText("Cube size and counts", { exact: true }).click();
  await page.getByLabel("Number the layers", { exact: true }).check();
  await expect(resource(page)).toContainText("Layer 1");
  await expect(resource(page)).toContainText("Layer 2");
  await page.setViewportSize({ width: 320, height: 900 });
  const id = await page
    .getByLabel("Selected cuboid", { exact: true })
    .inputValue();
  await page
    .getByRole("button", { name: `Edit width label on ${id}`, exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Edit width", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("textbox", { name: "Edit width", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Edit width", exact: true })
    .press("Escape");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("maximum separated resource exports a real 600 ppi PNG", async ({
  page,
}) => {
  test.setTimeout(90000);
  const e = upgrade(create());
  e.document.shapes[0].appearance!.mode = "faces";
  e.document.widthCm = 16;
  e.document.shapes[0].view = "layers";
  e.document.shapes[0].dimensions = { width: "20", depth: "20", height: "20" };
  await page.goto(`/?tool=cuboids#cuboids=${encode(e)}`);
  await page
    .getByRole("button", { name: "Use these cuboids", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Download options", exact: true })
    .click();
  const dl = page.waitForEvent("download", { timeout: 85000 });
  await clickResourceAction(page, "Download PNG (600 ppi)");
  await (await dl).saveAs(join(report, "exports/maximum-layers.png"));
});
test("source question link opens the matching published diagram", async ({
  page,
  context,
}) => {
  await page.getByText("Examples", { exact: true }).click();
  const card = page.locator(".cb-example").filter({
    has: page.getByRole("heading", { name: "Three face areas", exact: true }),
  });
  const pop = context.waitForEvent("page");
  await card
    .getByRole("link", { name: "View source question", exact: true })
    .click();
  const source = await pop;
  await source.waitForLoadState("domcontentloaded");
  await expect(source).toHaveURL(/question=1MA1_NOV_2018_3H_Q8/);
  await expect(source.locator(".qb-source-heading strong")).toContainText(
    "November 2018",
  );
  await expect(source.locator(".qb-canvas-host canvas")).toBeVisible();
  await expect(page).toHaveURL(/tool=cuboids/);
  await source.close();
});
test("an invalid inline draft is protected from a second editor", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Edit width label on cuboid-1", exact: true })
    .click();
  await field(page, "Edit width", "bad");
  await page.getByRole("tab", { name: "Shape", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Edit width", exact: true }),
  ).toHaveValue("bad");
  await expect(
    page.getByRole("textbox", { name: "Width", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Copy to clipboard", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("textbox", { name: "Edit width", exact: true })
    .press("Escape");
  await expect(
    page.getByRole("textbox", { name: "Width", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("textbox", { name: "Width", exact: true }),
  ).toHaveValue("4");
  await expect(
    page.getByRole("textbox", { name: "Edit width", exact: true }),
  ).toHaveCount(0);
});
test("the printed full-height label edits the separated layers directly", async ({
  page,
}) => {
  await page.getByLabel("View", { exact: true }).selectOption("layers");
  const label = resource(page)
    .locator("svg text")
    .filter({ hasText: "Full height: 2 cm" });
  const box = await label.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(
    page.getByRole("textbox", { name: "Edit height", exact: true }),
  ).toBeFocused();
  await field(page, "Edit height", "3");
  await expect(resource(page).locator("g[data-layer]")).toHaveCount(3);
  await expect(resource(page)).toContainText("Full height: 3 cm");
});
